// static/idb.js — IndexedDB 曲库缓存（审阅 #11）
// 目标：替代「同步 localStorage + LZString 压缩大曲库」——大曲库 JSON.stringify +
// 压缩是同步阻塞操作，且 localStorage 约 5MB 配额容易写爆。
// 设计：歌曲池分批事务写入（每批 500 条），meta（playlistsMap/封面/元信息）单键写入；
// 全部 Promise 化，失败静默回退（由 playlist.js 决定是否回落 localStorage）。
(function (global) {
    'use strict';

    var DB_NAME = 'iwebplayer-s';
    var DB_VERSION = 1;
    var STORE_SONGS = 'songs'; // keyPath: 'id'
    var STORE_META = 'meta';   // key 为任意字符串

    var _dbPromise = null;

    function open() {
        if (!_dbPromise) {
            _dbPromise = new Promise(function (resolve, reject) {
                if (typeof indexedDB === 'undefined') { reject(new Error('no-idb')); return; }
                var req;
                try {
                    req = indexedDB.open(DB_NAME, DB_VERSION);
                } catch (e) { reject(e); return; }
                req.onupgradeneeded = function () {
                    var db = req.result;
                    if (!db.objectStoreNames.contains(STORE_SONGS)) {
                        db.createObjectStore(STORE_SONGS, { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains(STORE_META)) {
                        db.createObjectStore(STORE_META);
                    }
                };
                req.onsuccess = function () { resolve(req.result); };
                req.onerror = function () { reject(req.error || new Error('idb-open-failed')); };
                req.onblocked = function () { reject(new Error('idb-blocked')); };
            });
            // 打开失败后复位，允许下次调用重试（而不是永久缓存 reject）
            _dbPromise.catch(function () { _dbPromise = null; });
        }
        return _dbPromise;
    }

    function getMeta(key) {
        return open().then(function (db) {
            return new Promise(function (resolve, reject) {
                var t = db.transaction(STORE_META, 'readonly');
                var req = t.objectStore(STORE_META).get(key);
                req.onsuccess = function () { resolve(req.result || null); };
                req.onerror = function () { reject(req.error); };
            });
        }).catch(function () { return null; });
    }

    function putMeta(key, value) {
        return open().then(function (db) {
            return new Promise(function (resolve, reject) {
                var t = db.transaction(STORE_META, 'readwrite');
                t.objectStore(STORE_META).put(value, key);
                t.oncomplete = function () { resolve(true); };
                t.onerror = function () { reject(t.error); };
                t.onabort = function () { reject(t.error); };
            });
        }).catch(function () { return null; });
    }

    // 歌曲池分批写入：每批一个事务；全部成功 resolve true，任一失败 resolve null
    function putSongs(songs, batchSize) {
        var BATCH = batchSize || 500;
        if (!Array.isArray(songs) || songs.length === 0) return Promise.resolve(true);
        var chain = Promise.resolve(true);
        for (var i = 0; i < songs.length; i += BATCH) {
            (function (chunk) {
                chain = chain.then(function (prevOk) {
                    if (!prevOk) return null;
                    return open().then(function (db) {
                        return new Promise(function (resolve, reject) {
                            var t = db.transaction(STORE_SONGS, 'readwrite');
                            var store = t.objectStore(STORE_SONGS);
                            for (var j = 0; j < chunk.length; j++) store.put(chunk[j]);
                            t.oncomplete = function () { resolve(true); };
                            t.onerror = function () { reject(t.error); };
                            t.onabort = function () { reject(t.error); };
                        });
                    }).catch(function () { return null; });
                });
            })(songs.slice(i, i + BATCH));
        }
        return chain;
    }

    function getAllSongs() {
        return open().then(function (db) {
            return new Promise(function (resolve, reject) {
                var t = db.transaction(STORE_SONGS, 'readonly');
                var req = t.objectStore(STORE_SONGS).getAll();
                req.onsuccess = function () { resolve(req.result || []); };
                req.onerror = function () { reject(req.error); };
            });
        }).catch(function () { return null; });
    }

    // 一次性清空（鉴权失败强制重建缓存时调用）
    function clear() {
        return open().then(function (db) {
            return Promise.all([
                new Promise(function (res) {
                    var t = db.transaction(STORE_SONGS, 'readwrite');
                    t.objectStore(STORE_SONGS).clear();
                    t.oncomplete = res; t.onerror = res; t.onabort = res;
                }),
                new Promise(function (res) {
                    var t = db.transaction(STORE_META, 'readwrite');
                    t.objectStore(STORE_META).clear();
                    t.oncomplete = res; t.onerror = res; t.onabort = res;
                })
            ]);
        }).catch(function () { return null; });
    }

    global.IDBCache = {
        isAvailable: function () { return typeof indexedDB !== 'undefined'; },
        getMeta: getMeta,
        putMeta: putMeta,
        putSongs: putSongs,
        getAllSongs: getAllSongs,
        clear: clear
    };
})(window);
