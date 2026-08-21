# iWebPlayer-S 静默更新优化方案

> 分析对象：`songloft-plugin-iwebplayer-S` 前端的静默更新机制（`reloadGlobalData` / `doBackgroundSync`）及"点歌触发静默更新"的高频路径。
> 结论来源：`static/playlist.js`、`static/player.js`、`static/miot.js` 源码。
> 日期：2026-08-18

---

## 问题一：静默更新（reloadGlobalData）的优化

### 1.1 现状链路

`reloadGlobalData()`（`static/playlist.js:1322`）：

```
读 localStorage 缓存 (global_cache) → 有缓存立即出首屏 (hasCache)
  → doBackgroundSync() 后台同步（不 await）：
       meta_bulk（服务端全量扫库建缓存）→ chunk 分页拉全库 → destroy 清服务端缓存
       → 重建 allPlaylists → LZString 压缩写 localStorage
  → 无条件 renderPlaylist() 重建整个列表 DOM
```

### 1.2 主要问题

| 问题 | 位置 | 影响 |
| --- | --- | --- |
| 同步完成后**无条件重建 DOM** | `playlist.js:1522-1524` | 即使数据没变也全量重建列表 + IntersectionObserver 重新触发 + 封面全部重新加载（"刷新时封面重新载入"的另一半原因） |
| **无并发去重/合并** | `reloadGlobalData` 整体 | 多处调用点短时间连续触发时，多次同时跑全库拉取 + 多次压缩写 localStorage，互相覆盖、白费带宽和主线程 |
| `_scrapedCover` 不持久化 | 全局 | 页面刷新后所有刮削封面丢失，需重新刮削（内嵌封面修复后重要性下降，但直链 `?v=<updated_at>` 仍会随重扫变化而重拉） |
| 全量拉取无增量 | `meta_bulk` + `chunk` | 每次同步都全量拉 600+ 首歌 + 全量 LZString 压缩 |
| 写缓存先删后写 | `playlist.js:1465-1466` | `removeItem` 后再 `setItem`，写失败时旧缓存也丢了，下次启动白屏走全量 |

### 1.3 优化方案

#### P0-A：同步后数据变更检测，无变化不重建 DOM

**思路**：同步前记录当前 `songList` 的指纹（长度 + id 序列），同步后比对，只有真实变化才 `renderPlaylist()`。

```js
// doBackgroundSync 之前
const beforeSig = (window.songList || []).map(s => s && s.id).join(',');

// ...doBackgroundSync 主体...

// 覆写内存后（原 playlist.js:1522-1524 处）
if (window.currentPlaylist && window.currentPlaylist !== '在线资源' && window.currentPlaylist !== '曲库搜索') {
    window.songList = window.getMergedSongList(window.currentPlaylist);
    const afterSig = window.songList.map(s => s && s.id).join(',');
    if (beforeSig !== afterSig && typeof window.renderPlaylist === 'function') {
        window.renderPlaylist();
    }
}
```

**效果**：歌曲无增删改时，静默同步只更新内存引用，DOM/封面零重建。

#### P0-B：reloadGlobalData 并发去重 + 合并

**思路**：加"进行中"标志，同步期间再被调用只打 pending 标记，结束后补跑一次。

```js
let _syncing = false, _pending = false;
async function reloadGlobalData() {
    if (_syncing) { _pending = true; return; }
    _syncing = true;
    try {
        /* 现有主体 */
    } finally {
        _syncing = false;
        if (_pending) { _pending = false; reloadGlobalData(); }
    }
}
```

**效果**：切歌/收藏/增删歌单/小爱推送等高频操作连续触发时，全库同步最多并发跑一轮。

#### P1-A：`_scrapedCover` 随 global_cache 持久化

**思路**：存缓存时附带 `coverMap`（歌名 → cover_url/直链），读缓存时贴回歌曲对象。

```js
// 压缩存盘前（playlist.js:1468 附近）
const coverMap = {};
for (const [plName, songs] of Object.entries(syncReconstructed)) {
    for (const s of songs) {
        const name = window.getSongNameObj(s);
        if (name && s._scrapedCover && s._scrapedCover !== window.defaultCover) {
            coverMap[name] = s._scrapedCover;
        }
    }
}
cacheObj.coverMap = coverMap;

// 读缓存时（playlist.js:1345 附近）
const coverMap = cache.coverMap || {};
cache.songsPool.forEach(s => {
    const name = window.getSongNameObj(s);
    if (name && coverMap[name]) s._scrapedCover = coverMap[name];
});
```

**效果**：页面刷新 / 静默同步后已刮封面或直链直接复用，避免 `<img>` 重新拉取。

#### P1-B：播放敏感路径不阻塞

- `player.js:312`（收藏）`await reloadGlobalData()` → 改为不 await 或加超时，让播放 UI 先走。
- `miot.js:437` 已是不 await（好），保持。

#### P2-A：增量拉取

- 前端存"最后成功同步时间"，短时间（如 60s）内跳过重复全量；
- 或后端 `main.ts` 增加 `?action=meta_bulk_since=<ts>` 增量接口，只返回变更歌曲。
- 成本稍高，需要前后端配合。

#### P2-B：localStorage 写入原子化

```js
// 现状：先删后写（playlist.js:1465-1466）
localStorage.removeItem('iwebplayer-s.global_cache_v2');
localStorage.removeItem('iwebplayer-s.global_cache');
localStorage.setItem('iwebplayer-s.global_cache', finalStorageStr);

// 建议：直接 setItem 覆盖旧值（失败时旧缓存仍在，下次仍可走缓存首屏）
localStorage.setItem('iwebplayer-s.global_cache', finalStorageStr);
```

---

## 问题二：点歌触发静默更新（MIoT 路径）

### 2.1 根因（代码确认）

连接小爱音箱（`MiotManager.currentDevice.type === 'miot'`）时，`playSong()` 走 MIoT 分流（`player.js:375-401`）：

```js
if (window.MiotManager && window.MiotManager.currentDevice.type === 'miot') {
    ...
    // 当前列表是"虚拟列表"（在线资源 / 曲库搜索 / WebDAV 等，playlistMeta 查不到真实 id）时：
    if (!targetPlId) {
        targetPlId = await window.MiotManager.syncListToPushPlaylist(window.songList);
    }
}
```

`syncListToPushPlaylist`（`miot.js:374-438`）每次被调用都会：

1. **删除**旧的 `iWebPlayer-S推送` 歌单（`miot.js:377-380`）；
2. **重建**同名歌单（`miot.js:383-390`）；
3. **把当前整个列表灌进去**（本地 `song_ids` + WebDAV 注册 + LXMusic 导入，`miot.js:392-433`）；
4. **`reloadGlobalData()` 全库静默同步**（`miot.js:435-438`）。

**结论：在虚拟列表里每点一首歌 → 每次删库重建推送歌单 + 全库静默更新。** 真实歌单（playlistMeta 能查到 id）不走此路径。

### 2.2 主要问题

| 问题 | 位置 | 影响 |
| --- | --- | --- |
| 每次点歌都**删库重建推送歌单** | `miot.js:377-390` | 600 首歌 DELETE + POST + 三通道灌库，慢且浪费 |
| 每次点歌都触发 **reloadGlobalData 全库同步** | `miot.js:435-438` | 全量拉取 + 压缩写 localStorage + 重建 DOM（叠加问题一的 P0-B 可缓解） |
| 无缓存 / 无 diff | `syncListToPushPlaylist` 整体 | 列表与上次完全相同时也全量重推 |

### 2.3 优化方案

#### P0-C：推送歌单增量更新，避免每次删库重建

**思路**：先拉取现有 `iWebPlayer-S推送` 歌单的歌曲 id，与当前列表 diff：
- 新增的 → POST；
- 消失的 → DELETE；
- 完全一致 → 直接返回现有 `plId`，跳过一切写操作。

```js
syncListToPushPlaylist: async function(currentList) {
    const pushName = 'iWebPlayer-S推送';
    let pushPl = window.playlistMeta ? window.playlistMeta.find(p => p.name === pushName) : null;

    // 现有歌单的歌曲 id 集合
    let existingIds = new Set();
    if (pushPl) {
        const res = await fetch(`/api/v1/playlists/${pushPl.id}/songs`);
        if (res.ok) {
            const songs = await res.json();
            existingIds = new Set(songs.map(s => s.id).filter(Boolean));
        }
    }

    const targetIds = new Set(
        currentList
            .filter(s => !s._isOnlineObj)
            .map(s => s.id)
            .filter(Boolean)
    );

    // 完全一致 → 直接复用，零写操作
    if (pushPl && existingIds.size === targetIds.size && [...targetIds].every(id => existingIds.has(id))) {
        return pushPl.id;
    }

    // 不一致 → 增量同步（新增 POST，删除 DELETE），最后 reloadGlobalData
    // ...（WebDAV / LXMusic 通道按需处理）
}
```

**效果**：同一虚拟列表内点歌，推送歌单零重建；跨列表才增量同步。

#### P0-D：配合问题一的 P0-B（去重锁 + 变更检测）

即使 `syncListToPushPlaylist` 仍触发 `reloadGlobalData()`，去重锁保证并发只跑一轮，变更检测保证无变化不重建 DOM。

#### P1-C：虚拟列表点歌缓存复用

**思路**：首次打包后缓存 `{ songListIds: [...], plId }` 到内存/`localStorage`，下次点歌先比对 id 序列，一致直接复用 `targetPlId`，彻底跳过 `syncListToPushPlaylist`。

#### P1-D：服务端侧（可选）

- `main.ts` 的 `meta_bulk` 服务端缓存（`flashSongsCache`，60s TTL）已存在，前端高频触发时可在 60s 内复用，无需重复扫库（`src/main.ts:49-50,138-142`）。
- 若增量同步落地，可进一步减小每次点歌的同步体积。

---

## 三、实施优先级

| 优先级 | 方案 | 对应体验问题 | 改动位置 |
| --- | --- | --- | --- |
| **P0** | A：变更检测不重建 DOM | 静默刷新时封面/列表重新载入 | `playlist.js` |
| **P0** | B：reloadGlobalData 去重合并 | 高频触发时重复全库同步 | `playlist.js` |
| **P0** | C：推送歌单增量更新 | 点歌删库重建 + 静默更新 | `miot.js` |
| P1 | A：_scrapedCover 持久化 | 页面刷新后封面重刮/重拉 | `playlist.js` |
| P1 | B：播放敏感路径不阻塞 | 点歌/收藏卡顿 | `player.js` |
| P1 | C：虚拟列表点歌缓存复用 | 点歌全量重推 | `miot.js` |
| P2 | A：增量拉取 / B：localStorage 原子写 | 同步体积与写失败风险 | `playlist.js` + `main.ts` |

---

## 附：关键证据索引

| 证据 | 位置 |
| --- | --- |
| reloadGlobalData 主体（读缓存 → 后台同步 → 无条件重建） | `static/playlist.js:1322-1566` |
| 无条件 renderPlaylist | `static/playlist.js:1522-1524` |
| 先删后写 localStorage | `static/playlist.js:1465-1466` |
| 封面状态继承（仅同页面会话有效） | `static/playlist.js:1492-1509` |
| 点歌绑定 → playSong | `static/playlist.js:1200-1208` |
| MIoT 分流（虚拟列表 → 打包推送） | `static/player.js:375-401` |
| syncListToPushPlaylist（删库重建 + 灌库 + reloadGlobalData） | `static/miot.js:374-438` |
| reloadGlobalData 调用点（收藏/增删/小爱推送/初始化） | `player.js:312`、`playlist.js:67,134,215,303,356`、`miot.js:437`、`index.html:3179,3889` |
| 服务端 meta_bulk 缓存（60s TTL） | `src/main.ts:49-50,138-142` |

---

## 四、整改记录（dev 分支）

### 4.1 第一阶段：曲库静默同步去重与变更检测

**提交：** `e1f646e`

**问题：** `reloadGlobalData()` 被收藏、添加歌曲、删除歌曲和 MIoT 推送等路径重复触发；同步完成后无论歌曲是否变化都会重建列表 DOM；缓存写入前先删除旧缓存，写入失败时会丢失可用缓存。

**思路：**

1. 用共享 Promise 合并并发同步，让多个调用方复用同一轮全量同步；
2. 同步前后比较当前歌单签名，签名包含歌曲 ID、歌曲名称、来源和顺序；
3. 只有列表实际变化时才调用 `renderPlaylist()`；
4. 直接覆盖写入 `localStorage`，保留写入失败时的旧缓存；
5. 保留有缓存时首屏立即返回的行为，不牺牲启动速度。

**结果：** 已落地到 `static/playlist.js`。无变化的后台同步不再重建 DOM，连续触发不会重复发起同步请求。

### 4.2 第二阶段：封面缓存持久化

**问题：** `_scrapedCover` 只存在当前页面内存。页面重新打开或全量同步后，已成功刮取的封面可能再次请求。

**思路：** 将可持久化的封面 URL 写入 global cache 的 `coverMap`，优先使用歌曲 ID，缺少 ID 时使用歌曲名称；排除默认封面、`data:` 大图和超过 4096 字符的异常值，并限制最多 500 条。

**实现：** `static/playlist.js` 在读取 `songsPool` 时恢复 `coverMap`，写入缓存时通过 `collectCoverCache()` 采集当前歌单和当前列表中的封面。

**风险控制：** 不保存 base64/data URL，不无限增长 localStorage；封面缓存只是加速数据，缺失或失效时仍可按原流程重新刮取。

### 4.3 第二阶段：MIoT 虚拟列表重复推送抑制

**问题：** 同一虚拟列表内连续点歌时，`syncListToPushPlaylist()` 每次都会删除并重建 `iWebPlayer-S推送` 歌单。

**思路：** 为当前虚拟列表生成稳定签名，内存中仍持有相同的推送歌单 ID 时直接复用，跳过删除、创建和重复灌库；列表发生变化时继续使用原有完整重建流程，避免本地、WebDAV、LXMusic 三种来源的增量语义不一致。

**实现：** `static/miot.js` 增加 `_pushPlaylistSignature` 和 `_pushPlaylistId`，并按歌曲 ID、来源、source_data、名称生成签名；复用前还检查 `playlistMeta` 中的歌单 ID 和名称，服务端歌单被外部删除后不会错误复用旧 ID。

**边界：** 这是安全的“相同列表复用”，不是完整的服务端增量更新。列表变化时仍保留旧的删除重建流程，后续可在分别验证三类来源后继续优化。

### 4.4 第二阶段：插件代码版本探针

**问题：** 原探针使用 `reload(true)`，现代浏览器不保证强制绕过缓存；只记录一个版本字符串，刷新失败后容易过早停止自动尝试；版本号不变但静态 JS 内容哈希变化时也无法发现更新。

**思路：** 使用随机查询参数和 `cache: 'no-store'` 请求最新 HTML；同时比较远端 `APP_VERSION` 与构建脚本注入的静态 JS `?v=` 哈希；按远端版本记录有限次数和时间窗口；刷新时使用带时间参数的 URL；达到上限后提示用户手动刷新，避免无限刷新循环。

**实现：** `static/index.html` 的 `checkLocalVersionUpdate()` 现在最多自动尝试 2 次，3 秒内去重，刷新使用 `window.location.replace()` 加 `iwp_reload` 参数；远端版本恢复一致后清除尝试记录。

**注意：** 该探针只能确认 HTML 中的 `APP_VERSION`，不能替代构建脚本中的 JS 内容哈希。插件构建仍需执行 `scripts/inject-version-hashes.mjs`，确保静态 JS 内容变化时 URL 变化。

### 4.5 验证记录

本轮整改完成后应执行：

- `playlist.js`、`miot.js`、`index.html` 内联脚本 JavaScript 语法检查；
- `git diff --check`（仓库文件使用 CRLF 时需允许 CR 作为行尾）；
- 检查 dev workflow 仅监听 `dev`，main workflow 仅监听 `main`；
- 手动验证相同虚拟列表连续点歌不会重复创建推送歌单；
- 手动验证页面重新加载后可从 `coverMap` 恢复封面。

