import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAllPlaylistSongs, probeAudioUrl, mapWithConcurrency, bytesToStr, toAddedAtMs, sortSongsByAddedAt } from '../src/main';

// ---------------------------------------------------------------------------
// bytesToStr：字节/未知值 → 字符串
// ---------------------------------------------------------------------------
describe('bytesToStr', () => {
    it('字符串直通', () => {
        expect(bytesToStr('abc')).toBe('abc');
    });
    it('null/undefined → 空串', () => {
        expect(bytesToStr(null)).toBe('');
        expect(bytesToStr(undefined)).toBe('');
    });
    it('Uint8Array 解码', () => {
        expect(bytesToStr(new Uint8Array([104, 105]))).toBe('hi');
    });
    it('ArrayBuffer 解码', () => {
        expect(bytesToStr(new Uint8Array([0x61, 0x62]).buffer)).toBe('ab');
    });
});

// ---------------------------------------------------------------------------
// fetchAllPlaylistSongs：分页拉全 / 宿主忽略 offset 防死循环
// ---------------------------------------------------------------------------
describe('fetchAllPlaylistSongs', () => {
    let mockGetSongs: any;
    beforeEach(() => {
        mockGetSongs = vi.fn();
        vi.stubGlobal('songloft', { playlists: { getSongs: mockGetSongs } });
    });

    it('跨页拉全（PAGE 满 + 余量页）', async () => {
        const PAGE = 10000;
        const fullPage = Array.from({ length: PAGE }, (_, i) => ({ id: i + 1 }));
        mockGetSongs.mockImplementation(async (_id: number, opts: any) => {
            const offset = opts?.offset ?? 0;
            if (offset === 0) return fullPage;
            if (offset === PAGE) return [{ id: PAGE + 1 }];
            return [];
        });
        const r = await fetchAllPlaylistSongs(1);
        expect(r.songs).toHaveLength(PAGE + 1);
        expect(r.songs[0].id).toBe(1);
        expect(r.songs[PAGE].id).toBe(PAGE + 1);
        expect(r.truncated).toBe(false);
        expect(r.warnings).toHaveLength(0);
    });

    it('宿主忽略 offset（整页重复）→ truncated + warning，不死循环', async () => {
        const PAGE = 10000;
        const fullPage = Array.from({ length: PAGE }, (_, i) => ({ id: i + 1 }));
        mockGetSongs.mockResolvedValue(fullPage); // 永远同一整页 → offset 被忽略
        const r = await fetchAllPlaylistSongs(1);
        expect(r.songs).toHaveLength(PAGE);
        expect(r.truncated).toBe(true);
        expect(r.warnings.length).toBeGreaterThan(0);
    });

    it('空歌单返回空', async () => {
        mockGetSongs.mockResolvedValue([]);
        const r = await fetchAllPlaylistSongs(1);
        expect(r.songs).toHaveLength(0);
        expect(r.truncated).toBe(false);
        expect(r.warnings).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// probeAudioUrl：HEAD / Range GET 兜底 / 永久 vs 临时失败
// ---------------------------------------------------------------------------
describe('probeAudioUrl', () => {
    it('HEAD 200 → ok', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true }));
        expect(await probeAudioUrl('http://x/audio')).toBe('ok');
    });
    it('HEAD 206 → ok', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 206, ok: true }));
        expect(await probeAudioUrl('http://x/audio')).toBe('ok');
    });
    it('404 → dead（永久）', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 404, ok: false }));
        expect(await probeAudioUrl('http://x/audio')).toBe('dead');
    });
    it('403 → dead（永久）', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 403, ok: false }));
        expect(await probeAudioUrl('http://x/audio')).toBe('dead');
    });
    it('HEAD 405 → Range GET 兜底成功 → ok', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ status: 405, ok: false })
            .mockResolvedValueOnce({ status: 206, ok: true });
        vi.stubGlobal('fetch', fetchMock);
        expect(await probeAudioUrl('http://x/audio')).toBe('ok');
        const second = fetchMock.mock.calls[1];
        expect(second[1].method).toBe('GET');
        expect(second[1].headers.Range).toBe('bytes=0-0');
    });
    it('HEAD/GET 均 405 → transient（不误杀）', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 405, ok: false }));
        expect(await probeAudioUrl('http://x/audio')).toBe('transient');
    });
    it('网络错误 → transient（临时）', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
        expect(await probeAudioUrl('http://x/audio')).toBe('transient');
    });
    it('运行时无 AbortController → skip（不抛 ReferenceError，不误杀）', async () => {
        const realAbort = globalThis.AbortController;
        vi.stubGlobal('AbortController', undefined);
        vi.stubGlobal('fetch', vi.fn());
        try {
            expect(await probeAudioUrl('http://x/audio')).toBe('skip');
            expect(fetch).not.toHaveBeenCalled(); // 直接跳过，不做网络请求
        } finally {
            vi.stubGlobal('AbortController', realAbort);
            vi.unstubAllGlobals();
        }
    });
});

// ---------------------------------------------------------------------------
// mapWithConcurrency：结果保序 + 并发受限
// ---------------------------------------------------------------------------
describe('mapWithConcurrency', () => {
    it('结果顺序保持，且并发数不超过 limit', async () => {
        let active = 0;
        let maxActive = 0;
        const items = [1, 2, 3, 4, 5, 6, 7, 8];
        const r = await mapWithConcurrency(items, 3, async (x) => {
            active++;
            maxActive = Math.max(maxActive, active);
            await new Promise((res) => setTimeout(res, Math.random() * 10));
            active--;
            return x * 2;
        });
        expect(r).toEqual(items.map((x) => x * 2));
        expect(maxActive).toBeLessThanOrEqual(3);
        expect(maxActive).toBeGreaterThan(1); // 确实并发了
    });
});

// ---------------------------------------------------------------------------
// toAddedAtMs / sortSongsByAddedAt（#5 排序）
// ---------------------------------------------------------------------------
describe('toAddedAtMs', () => {
    it('秒级数值 ×1000', () => {
        expect(toAddedAtMs(1700000000)).toBe(1700000000000);
    });
    it('毫秒级数值原样保留', () => {
        expect(toAddedAtMs(1700000000000)).toBe(1700000000000);
    });
    it('ISO 字符串解析为毫秒', () => {
        expect(toAddedAtMs('2023-11-14T22:13:20Z')).toBe(Date.parse('2023-11-14T22:13:20Z'));
    });
    it('非法/缺失 → 0（排末尾）', () => {
        expect(toAddedAtMs(undefined)).toBe(0);
        expect(toAddedAtMs(null)).toBe(0);
        expect(toAddedAtMs('')).toBe(0);
        expect(toAddedAtMs('not-a-date')).toBe(0);
    });
});

describe('sortSongsByAddedAt（后端）', () => {
    it('added_at 倒序', () => {
        const songs = [{ id: 1, added_at: 100 }, { id: 2, added_at: 300 }, { id: 3, added_at: 200 }];
        expect(sortSongsByAddedAt(songs).map((s) => s.id)).toEqual([2, 3, 1]);
    });
    it('同秒（秒级精度无次级键）→ id 次级倒序确定', () => {
        const songs = [{ id: 5, added_at: 100 }, { id: 9, added_at: 100 }, { id: 3, added_at: 100 }];
        expect(sortSongsByAddedAt(songs).map((s) => s.id)).toEqual([9, 5, 3]);
    });
    it('缺时间戳排末尾', () => {
        const songs = [{ id: 1, added_at: 500 }, { id: 2, added_at: 0 }, { id: 3 }];
        const sorted = sortSongsByAddedAt(songs);
        expect(sorted[0].id).toBe(1);
        expect(sorted[2].id).toBe(2);
        expect(sorted[1].id).toBe(3);
    });
    it('不修改原数组（返回稳定副本）', () => {
        const songs = [{ id: 1, added_at: 1 }, { id: 2, added_at: 2 }];
        sortSongsByAddedAt(songs);
        expect(songs.map((s) => s.id)).toEqual([1, 2]);
    });
});
