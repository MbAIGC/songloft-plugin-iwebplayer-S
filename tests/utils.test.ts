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
