import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// 极简 fake IndexedDB：所有回调 setTimeout(0) 异步触发（贴近真实 IDB 语义），
// 足够驱动 idb.js 的 open/事务/put/get/getAll/clear
// ---------------------------------------------------------------------------
function createFakeIndexedDB() {
    const stores = { songs: new Map(), meta: new Map() };
    const later = (fn: () => void) => setTimeout(fn, 0);

    const open = () => {
        const req: any = {};
        const db: any = {
            objectStoreNames: { contains: () => true },
            transaction: (storeName: string) => {
                const t: any = { _done: false, _fail: false, oncomplete: null, onerror: null, onabort: null };
                t.objectStore = () => {
                    const map = stores[storeName];
                    return {
                        put: (value: any, key?: any) => {
                            if (storeName === 'songs') map.set(value.id, value);
                            else map.set(key, value);
                        },
                        get: (key: any) => {
                            const r: any = {};
                            later(() => {
                                r.result = map.has(key) ? map.get(key) : undefined;
                                if (r.onsuccess) r.onsuccess();
                            });
                            return r;
                        },
                        getAll: () => {
                            const r: any = {};
                            later(() => {
                                r.result = Array.from(map.values());
                                if (r.onsuccess) r.onsuccess();
                            });
                            return r;
                        },
                        clear: () => { map.clear(); }
                    };
                };
                later(() => {
                    if (t._done) return;
                    t._done = true;
                    // 真实 IDB 只在真出错时触发 onerror/onabort；正常情况始终走 oncomplete
                    if (t._fail) { if (t.onerror) t.onerror(); return; }
                    if (t.oncomplete) t.oncomplete();
                });
                return t;
            }
        };
        later(() => {
            req.result = db;
            if (req.onsuccess) req.onsuccess();
        });
        return req;
    };

    return { open };
}

let fake: ReturnType<typeof createFakeIndexedDB> | null = null;

beforeEach(() => {
    (globalThis as any).window = globalThis;
    fake = createFakeIndexedDB();
    (globalThis as any).indexedDB = fake;
    delete (globalThis as any).IDBCache;
    const fs = require('node:fs');
    const src = fs.readFileSync(require('node:path').join(__dirname, '..', 'static', 'idb.js'), 'utf8');
    (0, eval)(src);
});

afterEach(() => {
    fake = null;
    delete (globalThis as any).indexedDB;
});

const tick = () => new Promise((r) => setTimeout(r, 10));

describe('IDBCache (idb.js)', () => {
    it('putMeta/getMeta 往返', async () => {
        const IDB: any = (globalThis as any).IDBCache;
        await IDB.putMeta('cache', { playlistsMap: { 收藏: [1, 2] }, coverMap: {} });
        await tick();
        const meta = await IDB.getMeta('cache');
        await tick();
        expect(meta).toEqual({ playlistsMap: { 收藏: [1, 2] }, coverMap: {} });
    });

    it('putSongs 分批写入 + getAllSongs 全量读回', async () => {
        const IDB: any = (globalThis as any).IDBCache;
        const songs = Array.from({ length: 1200 }, (_, i) => ({ id: i + 1, title: `s${i}` }));
        const ok = await IDB.putSongs(songs, 500);
        await tick();
        expect(ok).toBe(true);
        const all = await IDB.getAllSongs();
        await tick();
        expect(all).toHaveLength(1200);
        expect(all[0].id).toBe(1);
        expect(all[1199].id).toBe(1200);
    });

    it('putSongs 空数组直接成功', async () => {
        const IDB: any = (globalThis as any).IDBCache;
        expect(await IDB.putSongs([], 500)).toBe(true);
    });

    it('clear 清空 songs + meta', async () => {
        const IDB: any = (globalThis as any).IDBCache;
        await IDB.putMeta('cache', { x: 1 });
        await IDB.putSongs([{ id: 1 }, { id: 2 }], 500);
        await tick();
        await IDB.clear();
        await tick();
        const m = await IDB.getMeta('cache');
        const all = await IDB.getAllSongs();
        await tick();
        expect(m).toBeNull();
        expect(all).toHaveLength(0);
    });

    it('无 indexedDB 时全部静默返回 null（回落路径）', async () => {
        delete (globalThis as any).indexedDB;
        const IDB: any = (globalThis as any).IDBCache;
        expect(IDB.isAvailable()).toBe(false);
        expect(await IDB.getMeta('cache')).toBeNull();
        expect(await IDB.putMeta('cache', {})).toBeNull();
        expect(await IDB.getAllSongs()).toBeNull();
        expect(await IDB.clear()).toBeNull();
    });
});
