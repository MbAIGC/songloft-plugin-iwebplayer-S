import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// ---------------------------------------------------------------------------
// 播放竞态回归测试（跟进上游 v1.3.8「latest track selection wins」）
//
// 用 node:vm 起一个最小 DOM 沙盒，加载真实的 static/utils.js + static/player.js，
// 然后按“响应到达顺序”驱动异步，验证：
//   ① 连点切歌 = 最后一次点击胜出（与响应顺序无关）
//   ② 过期请求的失败 / 超时重试 / 预读结果一律不许影响新的选曲
//   ③ 预读缓存必须同时匹配「歌单 + 曲目身份」才算命中
//   ④ autoResume 总开关：off 时显式续播时间被丢弃，on / session 时生效
// ---------------------------------------------------------------------------

type Stub = {
    ctx: any;
    audio: any;
    requests: Array<{ url: string; resolve: (data: any) => void; reject: (err: any) => void }>;
    played: string[];
    notices: string[];
    uiCalls: string[];
    timers: Map<number, (...args: any[]) => void>;
    runTimers: () => void;
    element: (id: string) => any;
};

function createPlayer(options: { readyState?: number; autoResume?: boolean; resumeLocal?: string } = {}): Stub {
    const requests: Stub['requests'] = [];
    const played: string[] = [];
    const notices: string[] = [];
    const uiCalls: string[] = [];
    const timers = new Map<number, (...args: any[]) => void>();
    const storage = new Map<string, string>();
    const elements = new Map<string, any>();
    let timerId = 0;

    function element(id: string): any {
        if (elements.has(id)) return elements.get(id);
        const events = new Map<string, Set<(...args: any[]) => void>>();
        const classes = new Set<string>();
        const node: any = {
            id,
            dataset: {},
            style: { setProperty() {}, removeProperty() {} },
            value: '100',
            innerText: '',
            innerHTML: '',
            textContent: '',
            classList: {
                add(...names: string[]) { names.forEach(n => classes.add(n)); },
                remove(...names: string[]) { names.forEach(n => classes.delete(n)); },
                contains(n: string) { return classes.has(n); },
                toggle(n: string) { if (classes.has(n)) classes.delete(n); else classes.add(n); },
            },
            setAttribute() {}, removeAttribute() {}, scrollIntoView() {},
            querySelector() { return { setAttribute() {}, style: {}, classList: this.classList }; },
            querySelectorAll() { return []; },
            addEventListener(type: string, fn: (...args: any[]) => void) {
                if (!events.has(type)) events.set(type, new Set());
                events.get(type)!.add(fn);
            },
            removeEventListener(type: string, fn: (...args: any[]) => void) {
                events.get(type)?.delete(fn);
            },
            listenerCount(type: string) { return events.get(type)?.size ?? 0; },
            emit(type: string, extra: Record<string, any> = {}) {
                for (const fn of [...(events.get(type) || [])]) {
                    fn({ target: node, stopPropagation() {}, preventDefault() {}, ...extra });
                }
            },
            click() { this.emit('click'); },
            getBoundingClientRect() { return { left: 0, width: 300 }; },
        };
        elements.set(id, node);
        return node;
    }

    const audio = element('audio');
    let src = '/audio-A.mp3';
    Object.assign(audio, {
        currentTime: 60,
        duration: 240,
        readyState: options.readyState ?? 1,
        paused: false,
        ended: false,
        playbackRate: 1,
        buffered: { length: 0 },
        play() { this.paused = false; played.push(src); this.emit('play'); return Promise.resolve(); },
        pause() { this.paused = true; this.emit('pause'); },
        load() {},
        dataset: { playingPlaylist: 'Test', playingSongName: 'A - Artist', playbackRequest: '0', hasStarted: '1' },
    });
    Object.defineProperty(audio, 'src', {
        get: () => src,
        set: (value: string) => { src = value; audio.currentTime = 0; audio.paused = true; },
    });

    const nullIds = new Set(['np-title', 'mini-cover', 'fp-cover', 'mini-cover-img', 'fp-ambient-img']);

    class StubCustomEvent {
        type: string;
        detail: any;
        constructor(type: string, opts: { detail?: any } = {}) { this.type = type; this.detail = opts.detail; }
    }

    const ctx: any = {
        console,
        URL,
        URLSearchParams,
        CustomEvent: StubCustomEvent,
        navigator: {},
        location: { href: 'https://test.invalid/plugin/', host: 'test.invalid' },
        document: {
            getElementById: (id: string) => (nullIds.has(id) || id.startsWith('list-cover-')) ? null : element(id),
            querySelectorAll: () => [],
            addEventListener() {},
            body: { classList: element('body').classList, style: {} },
        },
        localStorage: {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => storage.set(key, String(value)),
            removeItem: (key: string) => storage.delete(key),
        },
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {},
        matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
        setTimeout(fn: (...args: any[]) => void) { const id = ++timerId; timers.set(id, fn); return id; },
        clearTimeout(id: number) { timers.delete(id); },
        setInterval: () => 0,
        clearInterval() {},
        fetch(url: string) {
            return new Promise((resolve, reject) => requests.push({
                url: String(url),
                resolve: (data: any) => resolve({ ok: true, json: async () => data }),
                reject,
            }));
        },
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    for (const file of ['utils.js', 'player.js']) {
        vm.runInContext(
            fs.readFileSync(path.join(__dirname, '..', 'static', file), 'utf8'),
            ctx,
            { filename: file },
        );
    }

    Object.assign(ctx, {
        songList: ['A', 'B', 'C'].map((title, i) => ({ id: i + 1, title, artist: 'Artist', _scrapedCover: '/cover.jpg' })),
        currentPlaylist: 'Test',
        currentIndex: 0,
        currentSongName: 'A - Artist',
        favoriteList: [],
        deadSongIndexes: {},
        consecutiveFailures: 0,
        playMode: 1,
        preloadCache: null,
        defaultCover: '/default.jpg',
        API: { info: '/info?id=' },
        localState: { playlist: '', songName: '' },
        showToast: (text: string) => notices.push(text),
        fetchSongLyric: async () => null,
        updateNpTitleUI() {},
        updatePlayButtonUI: (playing: boolean) => uiCalls.push(playing ? 'play' : 'pause'),
    });

    if (options.autoResume) ctx.savePreferences({ autoResume: true });
    if (options.resumeLocal) ctx.ConfigManager.set('config', 'playlist_configs', { Test: { resumeLocal: options.resumeLocal } });

    return {
        ctx, audio, requests, played, notices, uiCalls, timers, element,
        runTimers() {
            const fns = [...timers.values()];
            timers.clear();
            fns.forEach(fn => fn());
        },
    };
}

const tick = () => new Promise(resolve => setImmediate(resolve));

describe('播放竞态（跟随上游 v1.3.8）', () => {
    for (const order of [[0, 1], [1, 0]]) {
        it(`连点两首：最后一次点击胜出（响应顺序 ${order.join(',')}）`, async () => {
            const p = createPlayer();
            const b = p.ctx.playSong(1);
            const c = p.ctx.playSong(2);
            for (const i of order) {
                p.requests[i].resolve({ url: i === 0 ? '/audio-B.mp3' : '/audio-C.mp3' });
                await (i === 0 ? b : c);
            }
            expect(p.played).toEqual(['/audio-C.mp3']);
            expect(p.audio.src).toBe('/audio-C.mp3');
            expect(p.ctx.currentSongName).toBe('C - Artist');
        });
    }

    it('过期请求的失败：不提示、不标失效、不跳歌', async () => {
        const p = createPlayer();
        const b = p.ctx.playSong(1);
        const c = p.ctx.playSong(2);
        p.requests[1].resolve({ url: '/audio-C.mp3' });
        await c;
        p.requests[0].reject(new Error('B timed out'));
        await b;

        expect(p.notices).toEqual([]);
        expect(p.ctx.consecutiveFailures).toBe(0);
        expect(Object.keys(p.ctx.deadSongIndexes)).toEqual([]);
        expect(p.audio.paused).toBe(false);
    });

    it('B → C → B：按请求身份判定，而不是歌名或索引', async () => {
        const p = createPlayer();
        const selections = [p.ctx.playSong(1), p.ctx.playSong(2), p.ctx.playSong(1)];
        for (const i of [2, 1, 0]) {
            p.requests[i].resolve({ url: `/audio-request-${i}.mp3` });
            await selections[i];
        }
        expect(p.played).toEqual(['/audio-request-2.mp3']);
    });

    it('过期选曲的失败重试被作废（不跳歌）', async () => {
        const p = createPlayer();
        let nextCalls = 0;
        p.ctx.playNextSong = () => { nextCalls++; };

        const b = p.ctx.playSong(1);
        p.requests[0].reject(new Error('boom'));
        await b;

        // 当前选曲失败 → 注册了 1s 重试（另有列表滚动定时器）
        const before = p.timers.size;
        expect(before).toBeGreaterThanOrEqual(1);

        // 下一次选曲的起始动作会清掉全部「上一次选曲」的定时器
        p.ctx.invalidatePlaybackRequest();
        expect(p.timers.size).toBe(before - 1);

        // 端到端：新选曲后即便把残留定时器全部跑一遍，也不会触发跳歌
        const c = p.ctx.playSong(2);
        p.requests[1].resolve({ url: '/audio-C.mp3' });
        await c;
        p.runTimers();
        expect(nextCalls).toBe(0);
        expect(p.played).toEqual(['/audio-C.mp3']);
    });

    it('选曲进行中 isCurrentMedia 为假，直链落地后为真，再次选曲又为假', async () => {
        const p = createPlayer();
        const c = p.ctx.playSong(2);
        expect(p.ctx.isCurrentMedia(p.audio)).toBe(false);

        p.requests[0].resolve({ url: '/audio-C.mp3' });
        await c;
        expect(p.ctx.isCurrentMedia(p.audio)).toBe(true);

        p.ctx.playSong(1);
        expect(p.ctx.isCurrentMedia(p.audio)).toBe(false);
    });

    it('playSong(autoPlay=true) 立刻把按钮置为播放态（不等音频事件）', async () => {
        const p = createPlayer();
        const b = p.ctx.playSong(1);
        // 直链还没取到，图标已经翻转（慢网络下点击不再像没反应）
        expect(p.uiCalls).toEqual(['play']);
        p.requests[0].resolve({ url: '/audio-B.mp3' });
        await b;
        expect(p.played).toEqual(['/audio-B.mp3']);
    });

    it('playSong(autoPlay=false) 不抢按钮状态（启动定位不自动播放）', async () => {
        const p = createPlayer();
        const b = p.ctx.playSong(1, false);
        expect(p.uiCalls).toEqual([]);
        p.requests[0].resolve({ url: '/audio-B.mp3' });
        await b;
        expect(p.played).toEqual([]);
        expect(p.uiCalls).toEqual(['pause']);
    });

    it('预读缓存必须同时匹配歌单与曲目身份，过期缓存直接丢弃', async () => {
        const p = createPlayer();
        p.ctx.preloadCache = { playlist: 'Test', index: 1, trackKey: 'stale-key', data: { url: '/stale.mp3' } };
        const b = p.ctx.playSong(1);
        p.requests[0].resolve({ url: '/fresh-B.mp3' });
        await b;
        expect(p.audio.src).toBe('/fresh-B.mp3');
        expect(p.requests.length).toBe(1);
    });

    it('命中合法预读缓存时不再请求接口', async () => {
        const p = createPlayer();
        const preload = p.ctx.scoutNextSong(1);
        p.requests[0].resolve({ url: '/audio-B.mp3' });
        await preload;
        expect(p.ctx.preloadCache?.trackKey).toBeTruthy();

        const b = p.ctx.playSong(1);
        await b;

        expect(p.requests.length).toBe(1);
        expect(p.audio.src).toBe('/audio-B.mp3');
        expect(p.ctx.preloadCache).toBe(null);
    });

    it('过期的预读结果不会写入缓存', async () => {
        const p = createPlayer();
        const preload = p.ctx.scoutNextSong(1);
        const c = p.ctx.playSong(2);
        p.requests[1].resolve({ url: '/audio-C.mp3' });
        await c;
        p.requests[0].resolve({ url: '/audio-B.mp3' });
        await preload;

        expect(p.ctx.preloadCache).toBe(null);
        expect(p.ctx.isScouting).toBe(false);
    });

    it('过期的跨单预读不会覆盖更新的缓存', async () => {
        const p = createPlayer();
        const scout = p.ctx.scoutCrossPlaylistSong('Other', { id: 99, title: 'Old' });
        const c = p.ctx.playSong(2);
        p.requests[1].resolve({ url: '/audio-C.mp3' });
        await c;

        const latest = { playlist: 'Test', index: 0, trackKey: 'latest-key' };
        p.ctx.preloadCache = latest;
        p.ctx.isScouting = true;
        p.requests[0].resolve({ url: '/old.mp3' });
        await scout;

        expect(p.ctx.preloadCache).toBe(latest);
        expect(p.ctx.isScouting).toBe(true);
    });

    it('待播放的 metadata 监听随下一次选曲被清理', async () => {
        const p = createPlayer({ readyState: 0, autoResume: true });
        const b = p.ctx.playSong(1, false, 80);
        p.requests[0].resolve({ url: '/audio-B.mp3' });
        await b;
        expect(p.audio.listenerCount('loadedmetadata')).toBe(1);

        const c = p.ctx.playSong(2, false, 10);
        p.requests[1].resolve({ url: '/audio-C.mp3' });
        await c;
        expect(p.audio.listenerCount('loadedmetadata')).toBe(1);

        p.audio.emit('loadedmetadata');
        expect(p.audio.currentTime).toBe(10);
    });

    describe('autoResume 总开关（跟随上游 v1.3.8）', () => {
        it('关闭时：显式传入的续播时间被丢弃', async () => {
            const p = createPlayer({ readyState: 0 });
            const b = p.ctx.playSong(1, false, 90);
            p.requests[0].resolve({ url: '/audio-B.mp3' });
            await b;
            p.audio.emit('loadedmetadata');
            expect(p.audio.currentTime).toBe(0);
        });

        it('关闭时：歌单里记住的进度不再自动定位', async () => {
            const p = createPlayer({ readyState: 1 });
            p.ctx.ConfigManager.set('config', 'playback.positions.Test.currentSong', 'B - Artist');
            p.ctx.ConfigManager.set('config', 'playback.positions.Test.currentTime', 42);
            const b = p.ctx.playSong(1, false);
            p.requests[0].resolve({ url: '/audio-B.mp3' });
            await b;
            expect(p.audio.currentTime).toBe(0);
        });

        it('开启时：歌单里记住的进度会被定位', async () => {
            const p = createPlayer({ readyState: 1, autoResume: true });
            p.ctx.ConfigManager.set('config', 'playback.positions.Test.currentSong', 'B - Artist');
            p.ctx.ConfigManager.set('config', 'playback.positions.Test.currentTime', 42);
            const b = p.ctx.playSong(1, false);
            p.requests[0].resolve({ url: '/audio-B.mp3' });
            await b;
            expect(p.audio.currentTime).toBe(42);
        });

        it('会话恢复（resumeKind=session）不受总开关影响', async () => {
            const p = createPlayer({ readyState: 0 });
            const b = p.ctx.playSong(1, false, 90, { resumeKind: 'session' });
            p.requests[0].resolve({ url: '/audio-B.mp3' });
            await b;
            p.audio.emit('loadedmetadata');
            expect(p.audio.currentTime).toBe(90);
        });

        it('歌单级 resumeLocal=global 时，仍会读取云端进度', async () => {
            const p = createPlayer({ readyState: 0, resumeLocal: 'global' });
            const b = p.ctx.playSong(1, false);
            p.requests[0].resolve({ url: '/audio-B.mp3' });
            await tick();
            expect(p.requests.length).toBe(2);
            expect(p.requests[1].url).toContain('/sync?playlist=Test');
            p.requests[1].resolve({ data: { songName: 'B - Artist', time: 33 } });
            await b;
            p.audio.emit('loadedmetadata');
            expect(p.audio.currentTime).toBe(33);
        });

        it('歌单级 resumeLocal=off 时，不读取云端进度', async () => {
            const p = createPlayer({ readyState: 0 });
            const b = p.ctx.playSong(1, false);
            p.requests[0].resolve({ url: '/audio-B.mp3' });
            await b;
            expect(p.requests.length).toBe(1);
        });
    });
});
