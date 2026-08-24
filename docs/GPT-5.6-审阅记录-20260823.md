# GPT-5.6 审阅记录 - 2026-08-23

## 0. 最新复审（更新至 2026-08-23）

### 0.1 更新范围与验证

- 插件仓库已从 `5402bc6` 快进更新至 dev `03b4843658a0f71fcb687cc903ec19c8843b1386`。
- SongLoft 服务端复核仓库已从 `4f5c804` 快进更新至 main `7147dc8c084be6039318539f68f03bc7b4766957`。本次服务端新增 `common.js` 的 `favorite` / `invokeHost` 公共出口，不改变本文已核实的歌曲、插件鉴权、存储与播放契约。
- 本地验证：`npm run typecheck`、`npm run build`、`node scripts/verify-build.mjs` 全部通过；构建产物为约 660.3 KB。`NODE_ENV=development npm ci && npm test` 通过，4 个测试文件、43 个用例全部通过。初次 `npm test` 未运行是当前 shell 的 `NODE_ENV=production` 令 npm 忽略 devDependencies，非测试失败。
- Android 本机仍未实际编译/安装验证；当前环境没有 JDK。CI 脚本已加入类型检查、单测、构建和产物校验，但没有设备/模拟器安装冒烟。

### 0.2 本轮仍未修复的问题

#### P1: 高性能模式依然没有按真实添加日期排序

**位置**：`src/main.ts:248-252,273-275`。

`action=meta_bulk` 在聚合每个歌单时构造 `cleanedSongs`，却遗漏了轻量路径 `playlist_songs` 已保留的 `added_at`（见 `src/main.ts:212-217`）。随后 `sortSongsByAddedAt()` 只能得到 0 时间戳，最终按 `id DESC` 排序。因此高性能模式仍违反“所有歌曲按添加日期倒序”的需求，且 `static/playlist.js:1530-1531` 的二次排序无法恢复被丢弃的数据。

修复应在 bulk `cleanedSongs` 同步加入 `added_at: toAddedAtMs(s.added_at)`，并增加覆盖真实 `added_at` 与同秒 `id` 次级键的 `meta_bulk -> chunk -> 前端重建` 集成测试。当前 `tests/main.test.ts` 只测试纯排序函数，无法覆盖这条实际数据流。

#### P1: IndexedDB 缓存提交非原子，部分写入会被当作完整缓存使用

**位置**：`static/playlist.js:1446-1454,1594-1608`，`static/idb.js:66-88`。

写入路径先执行 `putMeta('cache', cacheObj)`，再以 500 首为单位执行 `putSongs(songsPool)`。后者任一批失败时，代码虽将本轮回退写入 localStorage，但已写入的 IndexedDB 元数据与部分歌曲不会回滚或标记为未完成。下次启动读取路径只要看到 `idbMeta` 和数组便调用 `applyGlobalCache()`；该函数不校验 `playlistsMap` 所引用的歌曲是否齐全，结果会把缺歌缓存视为命中并跳过 localStorage 回退，直至后台同步结束。

应采用版本化/完成标记的双阶段提交：先写带新 generation 的歌曲批次，全部成功后才原子发布对应 meta；失败时删除该 generation。读取时还应验证每个引用 ID 都能在歌曲池中找到。增加“第二批写入失败后重启”的回归测试。

#### P2: “所有歌曲”仍依赖非内置歌单的并集，不是全局 Song 列表

**位置**：`src/main.ts:240-265` 与 `static/playlist.js:1561-1576`。

两种同步路径都只把 `!built_in` 歌单的成员加入 `songMap`，再将该 Map 作为“所有歌曲”。这依赖某个非内置歌单恰好包含整库；只存在于内置歌单或尚未加入任何非内置歌单的歌曲不会进入该视图。SongLoft v2.6.3 已提供返回全局 `Song.added_at` 且默认 `added_at DESC` 的 `songs.list({limit, offset})`，因此应以它作为“所有歌曲”的数据源，再单独加载歌单结构。

注意：宿主 SQL 对相同秒级 `added_at` 没有 `id` 次级键，offset 分页仍可能跨页重复或遗漏。维持 v2.6.3 兼容时，以充分大的单次 limit + 截断告警为保守方案；可扩展的完全正确分页需要宿主提供稳定 `(added_at, id)` 或 cursor 契约。

### 0.3 已确认有效的整改

- XSS 文本输出、WebView Bridge 来源校验、凭据加密/关闭备份、WebDAV 同名目录与单目录失败处理、并发上限、歌词排序和 RAF 生命周期、TypeScript 适配、发布 URL/并发/质量门禁均已在本轮代码中存在。
- `probeAudioUrl()` 已针对 QuickJS 没有 `AbortController` 的运行时退化为直接下发 URL；v2.6.3 宿主本身支持 `HEAD /songs/{id}/play`。
- 分片缓存加入 generation，旧请求不能读取或销毁新会话；WebDAV 新扫描会让旧扫描在检查点自行退出。二者仍为同插件 VM 级状态，不是跨插件共享。
- `docs/修复计划-基于GPT5.6审阅记录.md` 将第 5 项标为“已修复”与当前 bulk 实现不符，应在修复并验证上述 P1 后再保留该勾选状态。

## 1. 审阅说明

### 1.1 范围

- 仓库：`songloft-plugin-iwebplayer-S-dev`（插件）
- 分支：`dev`
- 基线提交：`352a86c`
- 服务端交叉复核：SongLoft 服务端 main 提交 `4f5c804da74cdcab25a26c0131fc5ec3b1b8537e`；最新已发布变更记录对应版本 `v2.11.6`
- 版本口径：服务端结论基于当前 main；插件 `plugin.json` 声明 `minHostVersion: 2.6.3`，两者契约存在差异，结论按「已确认 / 被宿主缓解 / 依赖版本」归类
- 对象：`src/`、`static/`、`android/`、`.github/workflows/`、`scripts/`、`plugin.json`、`package.json`
- 方法：静态审阅、前后端与 Android 专项复核、插件构建、TypeScript 检查、发布配置核对，以及服务端源码交叉复核

本文只归档发现和建议，不表示问题已经修复。审阅期间未修改产品代码。

### 1.2 总体结论

当前 dev 版本可以成功打包，但不宜在缺少额外验证的情况下直接作为稳定版本发布。主要风险是：

1. 多条不可信数据到 `innerHTML` 的持久型 XSS 链路。
2. Android WebView Bridge 未隔离来源，放大前端注入和外部导航风险。
3. 新歌词引擎通过 Web Audio 接管输出，可能使跨域音源或移动端静音。
4. “所有歌曲按添加日期倒序”没有正确实现，两种同步模式均有错误。
5. WebDAV 有同名目录覆盖、单目录异常中断和全局状态竞争。
6. 曲库同步使用无界并发、本插件 VM 内共享缓存和同步 `localStorage` 压缩，存在性能和并发问题。
7. TypeScript 严格检查失败且没有测试，CI 仍可发布产物。
8. dev 下载地址、Release 版本计算和工作流并发存在发布风险。

修复顺序应是安全、数据正确性、播放可用性、性能、工程结构。

## 2. 验证结果

- `npm run build`：成功，生成约 654 KB 的 `dist/iwebplayer-s.jsplugin.zip`。
- 构建产物清单包含 `entryHash` 和 `zipHash`。
- `npx tsc --noEmit`：失败，共 38 个错误。
- 错误来源两类：① SDK 类型陈旧——`Playlist.labels`、`Song.added_at`、`songs.list` 的 `orderBy/order` 均未声明，`storage` 仅 `get/set/delete/keys`；② 真实问题——不存在的 `songloft.logger`、请求体类型转换、未知消息载荷、HTTP 类型引用。
- `npm run validate`：失败。它检查源码 `plugin.json`，其中两个 hash 始终为空；完成构建后仍不能通过。
- Android 本地构建未完成：环境缺少 JDK/`JAVA_HOME`。这不等于 Android 源码编译失败，但本次无法确认。
- 仓库中未发现前端、后端或 Android 自动化测试。

## 3. 服务端交叉复核（SongLoft 服务端）

本节结论基于 SongLoft 服务端 main `4f5c804da74cdcab25a26c0131fc5ec3b1b8537e` 与发布版本 `v2.11.6`，并逐条对照了 `v2.6.3`（提交 `3306c2c6551e`，为 main 的真实祖先）的契约。凡标注「Version-dependent」的能力必须在目标宿主版本实测后才能作为契约使用。

**重要**：`minHostVersion`（manifest `minHostVersion` / DB 列 `min_host_version`）在 2.6.3 与当前 main 中都只是**建议性元数据**——宿主**不会**在插件加载时按服务器版本做硬性拦截校验。因此声明 2.6.3 只有在该插件确实只用 2.6.3 已存在的契约时才安全；一旦误用后加入的契约，安装后即可能运行失败，且没有版本门禁兜底。

### 3.1 状态表

| 插件侧结论 / 依赖 | 服务端复核 | 判定 |
| --- | --- | --- |
| `Song.added_at` | `Song` 模型与 `songs.list` 均返回 `added_at`；2.6.3 已存在（`models.go:98`） | Confirmed at 2.6.3 |
| 歌单内歌曲关联时间 `added_at` | `playlist_songs.added_at` 记录歌曲加入某歌单的关联时间；2.6.3 已存在（`0001_init.sql`） | Confirmed at 2.6.3（语义与全局 `Song.added_at` 不同） |
| `Playlist.labels`（`built_in`/`auto_created`） | 2.6.3 已存在（`models.go:259`）；当前 main 新增 `hidden` 标签值（≥ v2.9.4）；本地 SDK 类型声明陈旧 | Confirmed at 2.6.3（SDK 类型过期） |
| `storage.getItem/setItem` 兜底 | 宿主 storage 2.6.3 起仅 `get/set/delete/keys`；`getItem/setItem` 不是运行时 API，插件现有 fallback 会走 `get/set` | Mitigated（fallback 可运行，类型需对齐） |
| `/debug`、`/store`、`/sync`、`/musiclist` 未认证 | 2.6.3 起所有 `/api/v1/jsplugin/{entryPath}/*` 默认 JWT 保护，插件未声明 `publicPaths`（2.6.3 尚无该机制），非未认证暴露 | Mitigated（对任一已认证用户仍是不必要披露且昂贵） |
| 全局 `flashSongsCache` 跨请求共享 | 2.6.3 起每插件独立 QuickJS VM（`envID=jsplugin-<entryPath>`）+ 每插件串行队列；不跨插件共享，但同插件所有请求/标签页共享，顺序交错仍互相覆盖 | Confirmed（范围收窄为本插件） |
| 用 HEAD 探测播放 URL | 2.6.3 起显式注册 `r.Head("/songs/{id}/play")`，处理器避免昂贵 seek/speed | Confirmed at 2.6.3（残留风险见 6.4，非宿主 bug） |
| WebDAV 凭据经 `/proxy` 传递 | `/proxy` 默认 JWT 保护，拦截私有/回环/链路本地地址（白名单除外），缓解开放代理/SSRF；拒绝/错误路径记录原始目标 URL（`proxy.go:142,346-377`），凭据可能进入应用日志（内置 access log 只记 path，见 10） | Mitigated with residual（凭据日志暴露仍在） |
| 期望宿主提供 WebDAV 服务端能力 | 宿主无原生 WebDAV 子系统；插件需组合 `dav` 插件 API 完成扫描/播放 | Confirmed（无宿主侧替代） |
| `songs.list` 显式 `orderBy/order` | 2.6.3 桥接仅解析 `limit/offset`，**忽略** `orderBy/order`；显式支持由 c9cf78e 引入 → 首个发布 v2.8.9（HTTP 版 v2.9.5） | Version-dependent（≥ 2.8.9 才可显式传参） |
| `songs.list` 默认顺序 | 2.6.3 起仓储查询固定 `ORDER BY added_at DESC`（`song_repository.go`），不传排序参数即按新增时间倒序 | Confirmed at 2.6.3 |
| `playlists.getSongs` 的 `sort/order` | 桥接仅 v2.11.4 起（CHANGELOG 658b3df）；HTTP 歌单排序 v2.8.2 起 | Version-dependent（minHostVersion 2.6.3 下不可依赖） |

### 3.2 对插件代码的影响

- 服务端复核把上一版「进程级缓存」「HEAD 误判」「/debug 未认证」「SDK 全错」等判断收紧：多数是 SDK 类型过期或宿主已缓解，真正需要插件自修的运行问题集中在 `songloft.logger`、请求体转换、凭据进日志、XSS 与 Android Bridge。
- 本插件的关键契约缺口是：宿主自 2.6.3 起就返回 `Song.added_at` 且 `songs.list` 默认按 `added_at DESC`，但插件 `cleanedSongs` 主动丢弃了 `added_at`，也没有利用该默认顺序做稳定排序；详见「所有歌曲按添加日期排序」。

## 4. 高优先级问题

### 4.1 不可信数据直接进入 `innerHTML`，存在持久型 XSS

**典型位置**

- `static/playlist.js:936-944,1188-1199`：歌单名、歌曲名和来源标签。
- `static/lyrics.js:440-466`：普通歌词和 KTV 逐字歌词。
- `static/online.js:544-556,600,1032-1033,1381-1405`：在线歌单、详情名和 WebDAV 目录名。
- `static/miot.js:179-189`：设备信息。
- `static/plugins.js:150-188`：第三方插件名称、版本和平台。
- `static/utils.js:163-176`：Toast 内容。
- `static/player.js:203`：当前歌曲信息。

歌名、歌词、文件名、目录、在线搜索结果和设备名均可能来自外部或用户可控数据。攻击脚本可在播放器同源页面执行，读取 `localStorage` 中的 `songloft-auth`、调用 SongLoft API，并进一步触发 Android Bridge。

**建议**

- 静态结构使用 `createElement`、`append`、`replaceChildren`。
- 业务文本只用 `textContent`。
- URL 使用属性赋值并限制协议。
- 移除动态内容中的内联事件，统一使用事件监听器。
- 文本、属性、URL 是不同上下文，不能只靠一个简单 `escapeHtml()`。
- 增加歌名、歌词、目录名、插件名和设备名注入测试。

### 4.2 Android Bridge 对 WebView 中所有来源开放

**位置**：`MainActivity.java:146-205,686-737`。

WebView 没有通过 `shouldOverrideUrlLoading` 限制主框架导航，却全局注册了 `Android` Bridge。任意加载到该 WebView 的页面都可能调用 `getServer()`、`getUsername()`、`login()`、`changeServer()`、`onAuthFailed()` 等接口。`allowFileAccess=true`、`MIXED_CONTENT_ALWAYS_ALLOW` 和局域网 HTTP 进一步扩大风险。

**建议**

- 主框架只允许本地设置页和配置的 SongLoft origin。
- 其他 HTTP(S) 地址交给系统浏览器。
- 只在受信页面添加 Bridge，离开前移除。
- Bridge 敏感方法内部再次验证当前 origin。
- 能在网页层完成的能力不要暴露到原生层。

### 4.3 歌词 AudioContext 路由可能导致静音

**位置**：`static/lyrics.js:44-56,99-127`、`static/player.js:659-695`。

歌词模块无条件执行：

```js
audioSource = audioCtx.createMediaElementSource(audioEl);
audioSource.connect(audioCtx.destination);
```

这会让真实声音依赖 Web Audio 图。LXMusic 可能返回第三方跨域直链；若响应没有允许播放器源的 CORS 头，媒体源节点可能输出静音。AudioContext 还可能在用户手势前处于 `suspended`，当前 RAF 调用 `resume()` 又没有处理失败。

**建议**

- 不要只为歌词补偿接管真实音频输出。
- 默认使用 `audio.currentTime` 加可配置偏移。
- 必须使用 Web Audio 时，只能在用户手势内初始化/恢复并处理失败。
- 仅对确认具备 CORS 的资源启用。
- 失败时必须退回普通时钟，不能影响播放。

### 4.4 WebDAV 同名目录覆盖导致丢歌

**位置**：`src/webdav.ts:81-84`。

扫描只取目录 basename 作为键。`/华语/精选` 和 `/欧美/精选` 都会写入 `精选`，后者覆盖前者，目录数和歌曲数同时失真。

应以相对完整路径或稳定目录 ID 作为内部键，basename 仅用于展示；重名时在 UI 显示父路径。

### 4.5 WebDAV 单目录错误可能终止整次扫描

**位置**：`src/webdav.ts:102-104`。

目录级 catch 调用了不存在的 `songloft.logger.error`。日志语句本身会抛错并进入外层 catch，单目录网络或解析错误可让整库扫描变成 `failed`。

应改用 `songloft.log.error`，记录失败目录后继续，并区分 `completed_with_warnings` 与真正失败。

## 5. 明确功能缺陷：所有歌曲按添加日期排序

### 5.1 结论

“所有歌曲按添加时间倒序”当前没有正确实现：

- 默认高性能模式根本没有按添加日期排序。
- 兼容模式记录的是本次同步时间，不是真实添加日期。
- 重复歌曲还会丢失临时 `_addedAt`。
- 两种模式、不同刷新和不同请求时序可能得到不同顺序。

服务端当前 main 已提供真实 `Song.added_at` 与排序能力，但插件未使用，因此该缺陷不是宿主缺失造成的。文档中的“最新添加排最前”与实际行为不一致。

### 5.2 高性能模式顺序由并发完成时序决定

**后端**：`src/main.ts:99-138`。

```ts
await Promise.all(playlists.map(async pl => {
  const songs = await songloft.playlists.getSongs(pl.id, { limit: 10000 });
  for (const song of songs) songMap.set(song.id, song);
}));
const allSongsArray = Array.from(songMap.values());
```

Map 的第一次插入顺序受各歌单请求完成时序影响，不代表歌曲添加时间。

**前端**：`static/playlist.js:1432-1470`。

```js
syncReconstructed[plName] = idArray
  .map(id => syncSongsMap.get(id))
  .filter(Boolean);
```

该分支既没有 `_addedAt`，也没有 `sort()`。`highPerf` 默认开启，因此这是大多数用户实际使用的路径。

### 5.3 兼容模式用同步时间冒充添加时间

**位置**：`static/playlist.js:1502-1509`。

```js
if (!syncSongsMap.has(s.id)) s._addedAt = Date.now();
syncSongsMap.set(s.id, s);
```

问题包括：

1. `_addedAt` 是前端处理时间，不是歌曲入库时间。
2. 每次全量同步都会重建时间，排序不稳定。
3. 大量歌曲会落在同一毫秒，最终仍依赖遍历顺序。
4. 重复歌曲后续再次 `set` 时，新对象没有 `_addedAt`，会覆盖旧对象；排序值退化为 0。

### 5.4 后端丢弃了宿主已提供的时间元数据

**位置**：`src/main.ts:87-91,112-116`。

服务端自 2.6.3 起 `Song` 就返回 `added_at`，且 `songs.list` 的仓储查询固定 `ORDER BY added_at DESC`（不传排序参数即按新增时间倒序）。插件 `cleanedSongs` 构造时只保留标题、歌手、路径等字段，主动丢弃 `added_at`，也没有利用该默认顺序。SDK 类型同样未声明 `added_at` 与排序参数，但这是类型陈旧，不代表运行时缺失。

### 5.5 正确修复方向

- **保持 2.6.3 兼容的首选方案**：`songs.list({ limit, offset })` 只传 `limit/offset`（2.6.3 桥接忽略 `orderBy/order`，但仓储默认就是 `added_at DESC`），在 `cleanedSongs` 保留 `added_at`，对拉到的完整结果在前端本地按 `(added_at DESC, id DESC)` 稳定排序。**不要**在 2.6.3 上显式传 `orderBy/order`（2.6.3 不解析该参数，传了等于没传）。
- 若要显式依赖桥接 `orderBy/order`，最低宿主版本必须提升到 ≥ v2.8.9（HTTP `sort/order` 需 ≥ v2.9.5）；`playlists.getSongs` 的 `sort/order` 需 ≥ v2.11.4（HTTP 歌单排序 ≥ v2.8.2）。鉴于 `minHostVersion` 只是建议值、宿主不强制，选择任一更高契约时都必须实测目标宿主。
- **分页与同秒并列的固有问题**：宿主 SQL 只有 `ORDER BY added_at DESC`，**没有 `id` 次级键**，且 `added_at` 是秒级精度。大批量扫描在单事务内顺序 INSERT，成百上千首歌 `added_at` 完全相同；跨 `offset` 分页时，同秒分组在页边界处可能重复或遗漏。因此：
  - 2.6.3 兼容方案建议用一次足够大的 `limit` 取全 + 本地稳定排序，并显式检测/上报截断（`truncated`/`warnings`），避免静默丢歌；
  - 真正可扩展的正确分页需要宿主提供 `(added_at, id)` 稳定排序或游标/键集分页契约，否则不要对「所有歌曲」做裸 offset 分页。
- 前端保留稳定 `id` 次级比较：宿主 `added_at` 为秒级精度且宿主 SQL 无次级排序，同秒内需要确定性（`b.added_at - a.added_at || b.id - a.id`）。
- 时间语义：`Song.added_at` 是歌曲全局入库/扫描时间（跨歌单稳定）；`playlist_songs.added_at` 是歌曲加入某歌单的关联时间（按歌单不同）。「所有歌曲」排序应使用全局 `Song.added_at`；单歌单内排序才考虑关联时间。
- 若最终只能使用首次发现时间，必须持久化并保留旧值（见下），并明确它不是真实添加日期。

```js
const existing = syncSongsMap.get(song.id);
const addedAt = persistedAddedAt[song.id]
  ?? existing?._addedAt
  ?? Date.now();

syncSongsMap.set(song.id, { ...existing, ...song, _addedAt: addedAt });
```

### 5.6 排序回归测试

- 两种模式返回相同顺序。
- 同一歌曲存在于多个歌单时排序值不丢失。
- 刷新、全量同步、缓存恢复后顺序稳定。
- 秒级时间戳相同时，`id` 次级排序确定。
- 新增歌曲正确出现在顶部。
- 大批量同秒入库（批量扫描）时，本地稳定排序结果确定，且页边界/offset 分页不重复、不遗漏。
- 拉取被截断（超过单次 `limit`）时能检测并返回 `truncated`/`warnings`，不静默丢歌。
- 多标签页并发同步不改变结果。

## 6. 中优先级功能与并发问题

### 6.1 曲库分片缓存是本插件 VM 内全局单例

**位置**：`src/main.ts:48-50,99-163`。

宿主按插件创建独立 QuickJS VM，`flashSongsCache` 不跨插件共享，但同一插件的所有请求/标签页仍共享它。宿主对单个插件的 HTTP 处理器按串行队列调度，能避免同一时刻的 JS 并发修改，但跨请求顺序交错仍会发生会话覆盖：一个标签页的 `destroy` 会清掉另一个标签页正在拉取的分片。

修复不变：`meta_bulk` 返回 `sessionId`，`chunk`/`destroy` 携带该 ID；更理想的是无状态数据库分页。

### 6.2 大歌单固定截断在一万首

**位置**：`src/main.ts:85,111`。

`limit: 10000` 会静默截断更大的歌单。应按 `limit/offset` 分页，并返回总数或 `truncated`/`warnings`。

### 6.3 WebDAV 扫描状态是本插件 VM 内全局单例

**位置**：`src/webdav.ts:5-8,140-151`。

与分片缓存同口径：状态不跨插件，但同插件所有页面共享版本、状态、活动节点和计数，新任务会取消旧任务。应按 `scanId` 或 `davId` 维护状态 Map，并提供取消、超时和清理。

### 6.4 HEAD 探测：确认宿主支持，剩余风险在插件侧与部署环境

**位置**：`src/main.ts:173-199`。

自 2.6.3 起宿主就显式注册 `r.Head("/songs/{id}/play")`（`routers.go:195`），且处理器对 HEAD 跳过昂贵的 seek/speed，因此 HEAD **不是宿主侧 bug**。剩余风险全部在插件或部署环境：

- 插件的 3 秒竞速超时不会中止底层 fetch（`Promise.race` 只能触发 reject，底层请求仍在跑），对慢速但有效的源可能误判失效。
- 前置反向代理若不透传 HEAD（如只放行 GET）可能返回 405，被统一标记为链接失效。

建议探测改为可中止（AbortController + `Range: bytes=0-0` GET）或直接返回播放 URL；区分临时网络失败与永久资源失效。

### 6.5 Android 认证与返回链路不一致

- 设置页拆分 URL 时会丢反向代理路径。
- 原生偏好和网页 `localStorage` 同时持有认证状态。
- 页面重新登录后原生 refresh token 可能未同步。
- 边缘手势未向 WebView 补发取消事件。
- 后台未暂停非播放必要定时器。

应定义单一认证状态所有者，并使用标准 URI 解析保存完整服务器地址。

### 6.6 Android 凭据明文保存且允许备份

普通 SharedPreferences 保存 access/refresh token，同时 `allowBackup=true`。应关闭或排除凭据备份，并使用 Android Keystore 支持的加密存储。

### 6.7 APK 实际仅支持 Android 15/API 35

`android/app/build.gradle:18` 设置 `minSdk 35`，但 README 只描述 Android/平板直装。无明确 API 35 依赖时应降低最低版本并多版本测试；若是有意限制，应在文档和 Release 明示。

## 7. 性能与资源使用

### 7.1 后端无界并发读取所有歌单

`src/main.ts:107-132` 使用 `Promise.all(playlists.map(...))`，会同时执行全部 `getSongs(limit: 10000)`，形成数据库查询、对象分配和 JSON 序列化峰值。

建议使用 3 到 5 的有界并发池、分页读取，并对单歌单失败返回 warning，不能空 catch 后伪装为完整成功。

### 7.2 曲库数据被多次全量复制

```text
数据库结果 -> cleanedSongs -> songMap -> allSongsArray
-> JSON 分片 -> 前端 Map -> 重建数组 -> JSON.stringify
-> LZString -> localStorage
```

曲库越大，内存峰值和主线程阻塞越明显。应使用稳定分页和 IndexedDB 分批写入，避免同步 `localStorage` 保存完整曲库。

### 7.3 歌词 RAF 永久运行

`static/lyrics.js:99-127` 初始化后永久递归 RAF，暂停、无歌词和页面隐藏时仍每帧唤醒。

- `play` 时启动。
- `pause`、`ended`、隐藏时取消。
- 普通歌词使用 `timeupdate` 或下一时间点定时。
- 只有播放中且可见的 KTV 歌词使用 RAF。
- 使用 `lastProgress` 跳过无变化的 CSS 写入。

### 7.4 WebDAV 队列 `shift()` 会退化

`src/webdav.ts:38,43-46` 使用数组 `shift()`，大目录树下接近 O(n²)。应改为数组游标。

### 7.5 WebDAV 扫描完全串行

远端延迟会按目录数线性累加。建议使用 3 到 6 个 worker 的有界并发，并增加单请求超时、最大深度、失败清单、有界重试和用户取消。

### 7.6 歌词二分查找依赖排序，但解析结果未排序

`static/lyrics.js:512-534` 使用二分查找，前提是 `parsedLyrics` 按时间递增；解析后没有排序。应在构建 DOM 前稳定排序，并定义相同时间戳的合并规则。

### 7.7 列表渲染和快照依赖大块 HTML

`playlist.js`/`online.js` 将业务判断、SVG、HTML 和事件绑定混在一起，并保存 `innerHTML` 快照，导致整块重建、监听器丢失风险、XSS 边界难审计和测试困难。

无需立即引入框架，可先拆为 `normalizeSong`、`createSongListItem`、`createPlaylistCard`、`updateNowPlaying`，配合事件委托和 `textContent`。

## 8. 代码结构与可维护性

### 8.1 请求体和存储兼容代码重复且不可靠

`/sync`、`/store`、`/dav/scan` 分别手工解析请求体。`String(Uint8Array)` 不是 UTF-8 JSON，`String.fromCharCode.apply` 对大请求可能爆栈。

集中实现：

```ts
parseJsonBody(req)
storageGet(key)
storageSet(key, value)
```

请求体使用 `TextDecoder`。旧宿主兼容逻辑应集中在适配层。

### 8.2 大量空 catch 隐藏不完整结果

歌单聚合、刮削、广播和网络逻辑存在大量 `catch {}`，会把权限、网络和数据错误表现为少歌或配置没保存。应使用结构化日志并返回 warnings。

### 8.3 使用歌曲显示名作为业务主键

续播、收藏、封面缓存和当前歌曲多处按 `songName` 关联。同名歌曲、不同来源和音质版本可能互相覆盖。应使用 `id`、`dedup_key` 或来源稳定 ID；显示名仅用于 UI。

### 8.4 超大脚本和全局状态

- `static/index.html` 超过 4,000 行。
- `static/lyrics.js` 接近 1,200 行。
- `static/playlist.js` 超过 1,600 行。
- 大量状态直接挂在 `window`。

建议渐进拆分 API、存储、模型、歌词解析、歌词时钟、DOM 渲染和曲库加载，并引入明确的 `AppState`。最后再考虑 ES modules 或框架迁移。

### 8.5 TypeScript 错误：区分 SDK 类型陈旧与真实契约问题

- `Playlist.labels` 是真实运行字段，仅本地安装的 SDK 类型声明陈旧。
- `storage.getItem/setItem` 不是运行时 API；插件现有 `typeof` 兜底会走 `get/set`，因此当前代码可运行，不是运行时 bug，只是类型未对齐。
- `songloft.logger` 是真实运行时 bug（宿主与 SDK 均只有 `songloft.log`），会导致 WebDAV 目录级日志抛错并可能中断扫描。
- SDK 类型遗漏 `Song.added_at` 与 `songs.list` 的 `orderBy/order`。前者是版本错位：`added_at`、`labels` 自 2.6.3 起就是真实运行字段，只是本地 SDK 类型陈旧；后者则是能力错位：显式 `orderBy/order` 仅 v2.8.9 起可用，若插件维持 2.6.3 兼容就不应在调用中依赖它。
- 应基于实际宿主契约与所选 `minHostVersion` 更新本地类型声明，而不是继续用散落的 `typeof` 绕过类型系统；同时为版本相关的调用（如显式排序参数）加运行期能力检测或提升最低版本。

## 9. 发布与 CI

### 9.1 dev 下载地址版本错误

`plugin.json` 是 `1.1.6-dev`，`download_url` 仍指向 `1.1.5-dev`；构建后仍保留旧 URL，README 也引用 1.1.5。dev prerelease 还不应复用稳定版 `releases/latest`。

### 9.2 稳定 APK 版本可能被 dev Release 干扰

若最新 Release 是 `dev-*`，稳定工作流可能不匹配版本正则并退回初始版本，使 versionCode 回退。应只选择非 prerelease 的 `vX.Y.Z` 并保证单调递增。

### 9.3 两个 dev 工作流竞争同一 Release

插件和 APK 工作流都上传插件 zip、编辑同一 Release 和说明，但没有共享并发组。应由单一流程发布或使用同一 concurrency group。

### 9.4 Release 历史可能不完整

默认浅克隆下 `git log -10` 可能只有当前提交。发布工作流应使用 `fetch-depth: 0` 并按明确标签范围生成说明。

### 9.5 CI 缺少质量门禁

当前没有强制类型检查、测试、构建产物验证、URL/版本一致性检查和 Android 安装冒烟。建议至少执行：

```text
npm ci
npm run typecheck
npm test
npm run build
validate-built-artifact
verify-release-metadata
```

## 10. 其他细节

- `src/scraper.ts` 超时不会中止底层 fetch，应使用 AbortController，并增加缓存和速率限制。
- `src/webdav.ts:162-163` 直接 `JSON.parse` 缓存，损坏缓存会返回 500。
- `scripts/inject-version-hashes.mjs` 直接依赖 `jszip`，但未在 `package.json` 直接声明。
- hash 注入正则只覆盖有限的双引号 script 写法，格式变化可能静默漏注入。
- `publish:release` 需确认当前 CLI 是否实现对应命令。
- WebDAV 凭据：插件 `static/player.js` 把 WebDAV 基本凭据嵌入目标 URL 的 userinfo 并作为查询参数传给 `/proxy`。服务端在上游请求前剥离 userinfo 并设置 `Authorization`，缓解了直连泄露；但凭据仍可能在以下位置暴露：① 插件页面地址栏/浏览器可见的完整 URL；② `/proxy` 拒绝（`proxy.go:142`）与请求失败（`proxy.go:346-377`）的应用日志记录原始目标 URL；③ 前置反向代理若记录完整请求 URI。SongLoft 内置 access log 只记录 `URL.Path` 不记录 query（`internal/app/access_log.go:27-39`），不会直接带出 userinfo。建议改用凭据句柄或服务端侧 header 机制，不要把凭据放入 URL；若地址校验与拨号解析分离，仍需评估 DNS rebinding 残留（如适用）。
- `/debug`：动态插件路由默认 JWT 保护，插件未声明 `publicPaths`，因此不是未认证暴露；但仍会向任一已认证用户返回最多一万首歌曲元数据且开销大，建议关闭或受严格权限控制。

## 11. 推荐修复顺序

### 第一阶段：安全和播放

1. 清除不可信 `innerHTML`。
2. 限制 WebView 导航和 Bridge 来源。
3. 回退或安全化 AudioContext 路由。
4. 加密 Android 凭据并关闭备份。

### 第二阶段：数据正确性

1. 修复“所有歌曲”排序：保留宿主 `added_at`，利用 `songs.list` 默认 `added_at DESC` 一次取全（显式 `orderBy/order` 需 ≥ v2.8.9，歌单 `sort/order` 需 ≥ v2.11.4，随所选 `minHostVersion` 而定），前端本地按 `(added_at DESC, id DESC)` 稳定排序，统一两种模式。
2. 修复 WebDAV 同名覆盖和单目录中断（`songloft.logger` → `songloft.log.error`）。
3. 隔离分片缓存和扫描状态（`sessionId`/`scanId`）。
4. 修复一万首截断（检测并上报 `truncated`，同秒页边界不重复/遗漏）；探测改为可中止（AbortController）并兼容不透传 HEAD 的反向代理（宿主 2.6.3+ 本身支持 HEAD）。

### 第三阶段：性能

1. 后端分页和有界并发。
2. 曲库缓存迁移 IndexedDB。
3. 歌词 RAF 按状态启停。
4. WebDAV 游标队列和有界并发。
5. DOM 构造与事件委托替代大块 HTML。

### 第四阶段：工程和发布

1. 基于实际宿主契约与所选 `minHostVersion` 修复 TypeScript 错误（`songloft.logger`、请求体转换；同步 SDK 类型声明，含 `added_at`、`labels` 与排序参数，并对版本相关调用做能力检测或升最低版本）。
2. 添加核心测试和并发回归测试。
3. 修复 Release URL、版本计算和发布竞争。
4. 将类型检查、测试、产物验证和 Android 冒烟加入 CI。
5. 渐进拆分超大脚本和全局状态。

## 12. 建议测试矩阵

### 安全

- 歌词、歌名、歌单名、目录名、设备名和插件名注入。
- 非受信 origin 不能访问 Android Bridge。

### 所有歌曲排序

- 高性能与兼容模式顺序一致。
- 重复歌曲不丢添加时间。
- 缓存恢复、刷新和全量同步后顺序稳定。
- 秒级时间戳相同时，`id` 次级排序确定。
- 新增歌曲正确置顶。
- 大批量同秒入库（批量扫描）时本地稳定排序结果确定，offset 分页/页边界不重复、不遗漏。
- 超过单次拉取上限时能检测并上报 `truncated`，不静默丢歌。
- 多标签页并发不改变结果。

### 歌词与播放

- 普通 LRC、KTV A/B、相对/绝对、重复/乱序时间戳。
- 本地、同源代理和无 CORS 跨域音频。
- 暂停、恢复、拖动、锁屏、耳机和后台恢复。
- 页面隐藏时 RAF 停止。

### WebDAV

- 同名、深层和大型目录树。
- 单目录失败后继续。
- 并发扫描、取消、超时和损坏缓存。
- 一万首以上分页边界。

### Android 与发布

- 多 API 级别安装启动。
- HTTP/HTTPS、反向代理路径、token 刷新和修改服务器。
- dev 为最新 Release 时稳定版本仍正确递增。
- APK/插件并发构建不覆盖资产。
- 产物版本、文件名、URL 和 hash 一致。
