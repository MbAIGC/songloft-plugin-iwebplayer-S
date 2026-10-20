import { describe, it, expect, beforeEach } from 'vitest';

beforeEach(() => {
    (globalThis as any).window = globalThis;
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'static', 'utils.js'), 'utf8');
    (0, eval)(src);
});

describe('normalizeSong (utils.js #15)', () => {
    it('LXMusic 在线形态：songmid/name/singer → id/title/artist + 在线标记', () => {
        const s = (globalThis as any).normalizeSong({ songmid: 'abc123', name: '晴天', singer: '周杰伦', album: '叶惠美', duration: 269, img: 'http://x/c.jpg' }, { online: true });
        expect(s.id).toBe('abc123');
        expect(s.title).toBe('晴天');
        expect(s.artist).toBe('周杰伦');
        expect(s.album).toBe('叶惠美');
        expect(s.duration).toBe(269);
        expect(s.cover_url).toBe('http://x/c.jpg');
        expect(s._scrapedCover).toBe('http://x/c.jpg');
        expect(s._isOnlineObj).toBe(true);
        expect(s.source_data).toEqual({ songmid: 'abc123', name: '晴天', singer: '周杰伦', album: '叶惠美', duration: 269, img: 'http://x/c.jpg' });
    });

    it('通用形态：id/title/artist 直通 + 字段兜底', () => {
        const s = (globalThis as any).normalizeSong({ id: 42, title: '歌', artist: '人', album: '专辑', cover_url: 'http://c', duration: 100, dedup_key: 'k', plugin_entry_path: 'local' });
        expect(s.id).toBe(42);
        expect(s.title).toBe('歌');
        expect(s.artist).toBe('人');
        expect(s.album).toBe('专辑');
        expect(s.cover_url).toBe('http://c');
        expect(s.duration).toBe(100);
        expect(s.dedup_key).toBe('k');
        expect(s.plugin_entry_path).toBe('local');
        expect(s._isOnlineObj).toBeUndefined();
    });

    it('id 优先于 songmid', () => {
        const s = (globalThis as any).normalizeSong({ id: 7, songmid: 'abc' }, { online: true });
        expect(s.id).toBe(7);
    });

    it('空/无效输入 → 安全默认值', () => {
        const s = (globalThis as any).normalizeSong(null);
        expect(s.title).toBe('未知歌曲');
        expect(s.artist).toBe('未知歌手');
        expect(s.album).toBe('');
        expect(s.duration).toBe(0);
        expect(s.cover_url).toBeNull();
        expect(s.id).toBeUndefined();
    });

    it('duration 数字强制转换（字符串 → 数字）', () => {
        const s = (globalThis as any).normalizeSong({ duration: '300' });
        expect(s.duration).toBe(300);
    });
});

describe('sortSongsByAddedAt (utils.js #5)', () => {
    it('added_at 优先于 _addedAt，缺时间排末尾', () => {
        const sorted = (globalThis as any).sortSongsByAddedAt([
            { id: 1, added_at: 100, _addedAt: 999 }, // added_at=100 优先（非 999）
            { id: 2, _addedAt: 500 },                 // 无 added_at → _addedAt=500
            { id: 3, added_at: 200 },
            { id: 4 }                                 // 无时间 → 末尾
        ]);
        // 时间倒序：2(500) > 3(200) > 1(100) > 4(0)
        expect(sorted.map((s: any) => s.id)).toEqual([2, 3, 1, 4]);
    });

    it('同秒 → id 次级倒序确定', () => {
        const sorted = (globalThis as any).sortSongsByAddedAt([
            { id: 5, added_at: 100 },
            { id: 9, added_at: 100 },
            { id: 3, added_at: 100 }
        ]);
        expect(sorted.map((s: any) => s.id)).toEqual([9, 5, 3]);
    });

    it('不修改原数组（返回副本）', () => {
        const arr = [{ id: 1, added_at: 1 }, { id: 2, added_at: 2 }];
        const s = (globalThis as any).sortSongsByAddedAt(arr);
        expect(s).not.toBe(arr);
        expect(arr.map((x: any) => x.id)).toEqual([1, 2]);
    });
});

// ---------------------------------------------------------------------------
// 刮削并发控制器（跟随上游 v1.3.10）
//   · 浏览器同域只有 6 条连接，封面 404 连环抢救会挤占音频请求
//   · 这里把并发锁在 3，并保持先进先出
// ---------------------------------------------------------------------------
describe('ScrapeManager（刮削并发控制器）', () => {
    it('最多 3 个并发，且严格先进先出', async () => {
        const started: number[] = [];
        let active = 0;
        let peak = 0;
        (globalThis as any).fetch = () => {
            const id = started.length;
            started.push(id);
            active++;
            peak = Math.max(peak, active);
            return new Promise((resolve) => setTimeout(() => {
                active--;
                resolve({ ok: true, json: async () => ({ cover: 'cover-' + id }) });
            }, 5));
        };

        const tasks = Array.from({ length: 9 }, (_, i) =>
            (globalThis as any).fetchScrape({ id: i + 1, title: 'T' + i, artist: 'A' }, 'cover'));
        const results = await Promise.all(tasks);

        expect(peak).toBeLessThanOrEqual(3);
        expect(started).toEqual(Array.from({ length: 9 }, (_, i) => i));
        expect(results).toEqual(Array.from({ length: 9 }, (_, i) => 'cover-' + i));
    });

    it('单个任务失败 → 返回 null，且不卡住后续队列', async () => {
        let calls = 0;
        (globalThis as any).fetch = () => {
            calls++;
            return calls === 1
                ? Promise.reject(new Error('boom'))
                : Promise.resolve({ ok: true, json: async () => ({ cover: 'ok' }) });
        };

        const [first, second] = await Promise.all([
            (globalThis as any).fetchScrape({ id: 1, title: 'T' }, 'cover'),
            (globalThis as any).fetchScrape({ id: 2, title: 'T' }, 'cover'),
        ]);

        expect(first).toBeNull();
        expect(second).toBe('ok');
    });

    it('rawItem 为空时直接返回 null', async () => {
        expect(await (globalThis as any).fetchScrape(null, 'cover')).toBeNull();
    });
});
