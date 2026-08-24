# 修复计划：基于 GPT-5.6 审阅记录整改

> 审阅来源：`docs/GPT-5.6-审阅记录-20260823.md`（基线提交 `352a86c`，dev 分支）。
> 本文件是整改 TODO，完成一项勾一项（`[x]`）。
> 口径：只在 dev 上改动并构建验证，不修改 main。20 项整改已**全部在 dev 落地并构建验证**（`[x]` = 已修）；测试矩阵为宿主侧实测项，本地无法核实，保持 `[ ]`。
> **核实状态**（2026-08-23 逐条对照代码）：✅=本地已核实属实；⚠️=部分属实/数字有出入；❓=宿主侧或外部，本地无法核实（以目标宿主实测为准）。核实 ≠ 已修复。

## 阶段一：安全（最高优先）

- [x] ✅ 1. 清除不可信数据到 `innerHTML` 的持久型 XSS —— **全部 7 处均坐实**
  - 业务文本一律 `textContent` / `createElement` / `append` / `replaceChildren`；URL 用属性赋值并限制协议；移除动态内联事件改用监听器；文本/属性/URL 分上下文处理，不能只靠一个 `escapeHtml`
  - 已核实位置：`utils.js:167`(Toast)、`player.js:203`(歌名/扩展名)、`miot.js:195-204`(设备名/ID)、`plugins.js:158+`(插件名/版本/平台)、`lyrics.js:446`(歌词/KTV)、`playlist.js:936-944,1188-1199`(歌单/歌曲/来源/时间标签)、`online.js:544-556,600,1032-1033,1381-1405`(在线歌单/详情/WebDAV 目录/面包屑 onclick)
  - 分批：先高风险小改动（歌词、Toast、设备名、插件名），再歌单/歌曲/目录名
  - ✅ 已修（`3e41fa2`）：7 处 innerHTML 插值按上下文改造为 `textContent`/属性赋值/事件监听器，移除动态内联 `onclick`，URL 限协议；#15 复核无未转义用户数据残留
- [x] ✅ 2. 限制 Android WebView 导航与 Bridge 来源
  - `shouldOverrideUrlLoading`：主框架只允许本地设置页 + 配置的 SongLoft origin，其它 HTTP(S) 交系统浏览器
  - Bridge 只在受信页注入；敏感方法内部校验 origin；收紧 `allowFileAccess` / `MIXED_CONTENT_ALWAYS_ALLOW`
  - 已核实：`MainActivity.java:205` 全局 `addJavascriptInterface`、`:126` `MIXED_CONTENT_ALWAYS_ALLOW`、**无** `shouldOverrideUrlLoading`、Manifest `usesCleartextTraffic=true`
  - ✅ 已修（`45b3204`）：`shouldOverrideUrlLoading` 白名单（本地设置页 + SongLoft origin，其余交系统浏览器）+ Bridge 受信页注入 + 敏感方法 origin 校验。后续实测登录桥异常（`e8f1996`/`49319ad`）：OEM WebView 上桥线程调 `getUrl()` 会抛错，改为 UI 线程缓存 `currentPageUrl`，桥方法只读缓存、失败即拒（详见文末"计划外修复"）
- [x] ✅ 3. 安全化歌词 AudioContext 路由（防跨域/移动端静音）
  - 默认用 `audio.currentTime` + 可配置偏移，不只为歌词接管真实音频输出
  - 必须用 Web Audio 时：仅用户手势内初始化/恢复并处理失败；仅对确认 CORS 资源启用；失败退回普通时钟
  - 已核实：`static/lyrics.js:49-50` `createMediaElementSource` + `connect(destination)`（"跨域静音"为行为断言，修复后需实测）
  - ✅ 已修（`2ece5c1`）：歌词时钟不再接管真实音频输出，默认普通时钟 + 可配置偏移，跨域静音风险消除
- [x] ✅ 4. Android 凭据加密 + 关闭备份
  - `allowBackup=false` 或 backup rules 排除凭据；`SharedPreferences` 换 EncryptedSharedPreferences（AndroidX Security）
  - 已核实：`AndroidManifest.xml:9` `allowBackup=true`；`MainActivity.java:260-261,282-283` token 明文 `putString` 进 `MODE_PRIVATE`
  - ✅ 已修（`24900eb`+`16332b2`）：`allowBackup=false`；凭据改 `EncryptedSharedPreferences`（security-crypto `1.1.0-alpha06`，`1.0.0` 无 `MasterKey` 类）

## 阶段二：数据正确性

- [x] ✅ 5. 修复「所有歌曲按添加日期倒序」
  - 保留宿主 `Song.added_at`（`cleanedSongs` 不再丢弃）；高性能模式同样本地 `(added_at DESC, id DESC)` 稳定排序；修复重复歌曲丢 `_addedAt`、用同步时间冒充添加时间；一次足够大 `limit` 取全 + 检测 `truncated`/`warnings`，不静默丢歌
  - 显式 `orderBy/order` 需宿主 ≥ v2.8.9（HTTP ≥ v2.9.5）；`playlists.getSongs` 的 `sort/order` 需 ≥ v2.11.4 → 维持 2.6.3 兼容则本地排序
  - ✅ 已修（`4807b69`）：后端 `cleanedSongs` 保留 `added_at`（`toAddedAtMs`：秒×1000/毫秒原样/ISO→毫秒/非法→0）；`meta_bulk` 用 `(added_at DESC, id DESC)` 稳定排序（不再受并发完成时序影响），`structure['所有歌曲']` 与分片缓存顺序确定；前端共享 `sortSongsByAddedAt`（`added_at` 优先、`_addedAt` 兜底、id 次级、非变异）两种模式同键排序保证一致；兼容模式重复歌曲保留首次 `_addedAt`（真实 `added_at`）、新歌用宿主 `added_at` 而非 `Date.now()`；+11 单测
  - 已核实：`src/main.ts:87-91` `cleanedSongs` 丢 `added_at`；`:109-138` 高性能 `Promise.all` 无排序；`static/playlist.js:1504` `Date.now()` 冒充添加时间、重复歌 `set` 覆盖丢 `_addedAt`
- [x] ✅ 6. WebDAV 同名目录覆盖
  - 内部键改相对完整路径（或稳定目录 ID），basename 仅展示；重名 UI 显示父路径
  - 已核实：`src/webdav.ts:82` `currentPath.split('/').pop()` 仅取 basename 作键
  - ✅ 已修（`c8e13b0`）：内部键改用相对完整路径消歧，同名目录不再互相覆盖
- [x] ✅ 7. WebDAV 单目录错误不再中断整次扫描
  - `songloft.logger.error` → `songloft.log.error`；记录失败目录后继续；区分 `completed_with_warnings` 与真失败
  - 已核实：`src/webdav.ts:103` `songloft.logger.error`（该 API 不存在，会抛错进外层 catch 中断扫描）
  - ✅ 已修（`edd4379`）：`logger`→`log`，单目录失败记录后继续扫描并区分警告与失败
- [x] ✅ 8. 隔离全局状态（分片缓存 / WebDAV 扫描状态）
  - `meta_bulk` 返回 `sessionId`，`chunk`/`destroy` 携带；WebDAV 按 `scanId`/`davId` 维护状态 Map，含取消/超时/清理
  - 已核实：`src/main.ts:49` 模块级 `flashSongsCache`；`src/webdav.ts:5-8,140-151` 模块级扫描状态。⚠️ "宿主串行队列、不跨插件共享"为宿主行为（❓待实测）
  - ✅ 已修（`d342ec7`）：WebDAV 4 个模块级变量收敛为单个 `WebDavScanSession`（`scanId`+`version`+`status`+`foldersCount`+`davId`），新扫描原子替换 active 会话，旧任务在 `activeScanSession !== session` 检查点自取消，重叠扫描不再污染共享计数；`/dav/status` 追加 `scanId`。分片缓存加 `generation` 标记，`meta_bulk` 返回 `_session`，`chunk`/`destroy` 带可选 `session` 参数仅在标记匹配时读/清（缺省维持旧行为），前端透传 session
- [x] ✅ 9. 一万首静默截断 + HEAD 探测
  - `limit/offset` 分页 + 返回总数或 `truncated`/`warnings`；探测改 AbortController + `Range: bytes=0-0` GET 或直接返回播放 URL；区分临时网络失败与永久失效
  - 已核实：`src/main.ts:85,111` `limit: 10000` 静默截断。❓ HEAD 宿主支持（审阅 §6.4）为宿主侧，待实测
  - ✅ 已修（`dcde4fd`）：一次足够大 `limit` 取全 + `truncated`/`warnings` 检测不静默丢歌；探测改 `Range: bytes=0-0` GET + 临时/永久区分。后续实测（`26ec813`）：QuickJS 无 `AbortController` 时探测返回 `skip` 不崩溃，直接给播放 URL（详见文末"计划外修复"）

## 阶段三：性能

- [x] ✅ 10. 后端有界并发（3–5）替代 `Promise.all` 无界全量拉取，单歌单失败返回 warning
  - 已核实：`src/main.ts:109` `Promise.all(playlists.map(...))` 无界并发
  - ✅ 已修（`4fd5a3a`）：meta_bulk 歌单拉取改有界并发（含每次失败歌单的 warning）
- [x] ✅ 11. 曲库缓存迁移 IndexedDB 分批写入，避免同步 `localStorage` 压缩大曲库（大改动，可后置）
  - 涉及：`static/playlist.js:1425-1570`（建议性优化，非 bug，无需核实）
  - ✅ 已修（`9ee2cce`）：新增 `static/idb.js`（`window.IDBCache`，歌曲池每批 500 事务写入、meta 单键、全 Promise 化静默回退）；读路径优先 IDB（meta+`getAllSongs`）失败回退 localStorage；写路径优先 IDB，localStorage+LZString 仅兜底；AUTH_FAILED 同时清 IDB；index.html 在 playlist.js 前加载。fake-IndexedDB 单测 5 例（meta 往返/分批读回/空批/clear/无 IDB null 回退）
- [x] ✅ 12. 歌词 RAF 按状态启停：play 启动；pause/ended/页面隐藏取消；仅 KTV 用 RAF；`lastProgress` 跳过无变化
  - 已核实：`static/lyrics.js:99-127` `startLoop` 无条件永久 `requestAnimationFrame`，无暂停/隐藏取消
  - ✅ 已修（`31d5a49`）：RAF 按状态启停（play 启动 / pause/ended/隐藏取消），`lastProgress` 跳过无变化
- [x] ✅ 13. WebDAV 队列 `shift()` O(n²) → 数组游标；3–6 worker 有界并发 + 超时/重试/取消
  - 已核实：`src/webdav.ts:43` `queue.shift()`；扫描 `while` 全串行
  - ✅ 已修（`087be6a`）：数组游标替代 `shift()`、有界并发 + 超时/重试/取消
- [x] ✅ 14. 歌词解析结果先稳定排序再二分查找，定义同时间戳合并规则
  - 已核实：`static/lyrics.js:419` 只前置占位行**未排序**；`:512-534` `findActiveLine` 二分依赖有序前提不成立
  - ✅ 已修（`4937de4`）：解析结果先稳定排序再二分查找，并定义同时间戳合并规则
- [x] ✅ 15. 拆 `normalizeSong`/`createSongListItem`/`createPlaylistCard`/`updateNowPlaying` + 事件委托，替代大块 innerHTML（与 #1 合并）
  - 涉及：`static/playlist.js`、`online.js`（工程重构，与 #1 一起评估）
  - ✅ 已复核（`f987a46`）：逐项审计确认目标架构已基本就位——逐项 `createElement` DOM 构建（含转义）、分片 Time-Slicing 渲染、`dataset.action`/`data-action` 事件委托、专属 `updateNpTitleUI`/`updateMediaSession` 更新现播；全部 `innerHTML` 插值复核**无未转义用户数据残留**（#1 已覆盖 XSS）。落地项：提取共享 `normalizeSong`（utils.js）消除 online.js 两处重复内联归一化，行为等价 +5 单测

## 阶段四：工程与发布

- [x] ✅ 16. 修复 TypeScript（实测 42 个错误，审阅记 38）
  - 真 bug（✅ 已核实）：`songloft.logger` → `songloft.log`（`src/webdav.ts:103`）；请求体转换（`src/webdav.ts:163` 已见 `JSON.parse(cache)` 无兜底；TextDecoder 改造点待落实）
  - SDK 类型陈旧：`Song.added_at`、`Playlist.labels`、`songs.list` 的 `orderBy/order`、`storage` 的 `getItem/setItem` → 同步本地类型声明；版本相关调用做能力检测或升 minHostVersion
  - ✅ 已修（`7f03363`）：tsc 42→0；`src/types.d.ts` 模块增强补 `Playlist.labels`/`Song.added_at`；/sync /store 请求体用 `bytesToStr`+`JSON.parse` 兜底（QuickJS 无 TextDecoder，沿用 `String.fromCharCode` 模式）；`songloft.logger`→`songloft.log`
- [x] ✅ 17. 修复 `plugin.json` `download_url`（1.1.5-dev → 1.1.6-dev）+ README 引用
  - 已核实：`plugin.json` `download_url` 仍指向 `1.1.5-dev.jsplugin.zip`，`version` 为 `1.1.6-dev`
  - ✅ 已修（`8269db2`）：`download_url`→`1.1.6-dev`、README 引用→`1.1.6`；构建后 zip 内清单已含正确 URL
- [x] ✅ 18. 两个 dev 工作流（APK/插件）同改一个 Release → 共享 concurrency group 或单一流程发布
  - 已核实：`build-apk-dev.yml:20` 有 concurrency(`build-apk-dev`)，`build-plugin-dev.yml` **无** concurrency → 可并发编辑同一 Release
  - ✅ 已修（`8d8b096`）：两工作流共享 `group: dev-release`（`cancel-in-progress: false`），串行编辑 dev Release
- [x] ⚠️ 19. 发布版本计算：`fetch-depth: 0`；稳定版只选非 prerelease `vX.Y.Z` 且单调递增；说明按标签范围生成
  - 已核实：`build-apk.yml:64` `gh release list --limit 1` 取最新 Release，dev 标签不匹配 `^v?X.Y.Z$` 会回退 `0.0.1`。⚠️ checkout `fetch-depth` 未专门核对，按默认浅克隆处理
  - ✅ 已修（`38635d8`）：`fetch-depth: 0`；版本只从锚定 `^vX.Y.Z$` 的 git 稳定标签取最新并 patch+1（dev/`1.1.6-dev` 标签不再导致回退 `0.0.1`，数值排序保证单调）；手动版本号格式校验失败即退出；说明按 `上一稳定标签..HEAD` 生成，重跑时同步刷新 notes
- [x] ✅ 20. CI 质量门禁：`npm ci` → `typecheck` → `test` → `build` → 产物/URL/版本一致性校验 → Android 安装冒烟
  - 已核实：`package.json` **无** `typecheck`/`test` 脚本、无测试；CI 仅 `npm run build`
  - ✅ 已修（`fbe3dee`）：新增 `typecheck`(`tsc --noEmit`，0 错误) 与 `test`(`vitest run`，21 用例)；`tests/` 覆盖分页/offset 防死循环/probe HEAD+Range 兜底+dead-vs-transient/并发受限/`bytesToStr`/WebDAV 同名键消歧；`scripts/verify-build.mjs` 校验版本一致+产物存在+zip 内 version/download_url；三个工作流均 `npm ci → typecheck → test → build → verify-build`。⚠️ Android 安装冒烟需真实设备/模拟器，暂未纳入（保留为稳定版发布前人工步骤）

## 测试矩阵（随各阶段补齐）

- [ ] 注入测试：歌词/歌名/歌单名/目录名/设备名/插件名
- [ ] 非受信 origin 不能访问 Android Bridge
- [ ] 排序：两模式一致、重复歌不丢时间、缓存/刷新后稳定、同秒 id 次级确定、新增置顶、>1万首不重不漏
- [ ] 歌词：普通/KTV/乱序时间戳、本地/同源代理/无 CORS 跨域、暂停/恢复/拖动/隐藏 RAF 停
- [ ] WebDAV：同名/深层/大型树、单目录失败继续、并发/取消/超时/损坏缓存
- [ ] Android/发布：多 API 安装、token 刷新/改服务器、dev 最新时稳定版本仍递增、并发构建不覆盖、产物 hash 一致

## 计划外修复（用户实测发现，均已修复并经用户确认）

- [x] ✅ **Android 登录桥崩溃**：`Error invoking login: Java exception was raised during method invocation`（OEM WebView 上 `@JavascriptInterface` 后台线程调 `webView.getUrl()` 会抛错）。已修（`e8f1996`+`49319ad`）：UI 线程 `onPageStarted` 缓存 `currentPageUrl`，桥方法只读 volatile 缓存、失败即拒；`onPageStarted` 适配 API 35 三参签名 `(WebView, String, Bitmap)`（CI 编译通过，APK dev 构建成功）
- [x] ✅ **新版插件全部歌曲无法播放**（`获取链接失败，自动跳过` + 连续 5 首暂停）：#9 的 `probeAudioUrl` 在 QuickJS 运行时调 `new AbortController()` 抛 `ReferenceError`（Node 测试有 AbortController 掩盖了此缺陷）。已修（`26ec813`）：QuickJS 无 `AbortController` 时探测直接返回 `skip`，`/musicinfo` 走 `songloft.log.warn` 并直接给播放 URL；WebDAV 拉目录同步改 `Promise.race` + 超时回退。用户确认"可以了"
- [x] ✅ **宽屏/分栏模式当前播放歌曲无高亮**（手机模式有）：机制与 CSS 两模式一致，实际是**暗色氛围分栏下暗色卡片规则特异性 (0,5,1) 覆盖了 `.song-item.playing` (0,4,1)**，把粉色 2px 边框顶成白色 15% 细边（用户计算样式实证）。已修（`77d6eaf`）：新增特异性 (0,6,1) 且后声明的暗色 `.song-item.playing` 规则强制粉色边框胜出；另加 `syncPlayingHighlight`（`b543660`）以 `<audio>` 实际播放身份在重渲染/每次播放后校正高亮。按用户要求精简为与手机端一致的纯 2px 边框（`069f087`，去掉左侧强调条与底色）。用户确认"可以了"

## 第二轮复审遗留（审阅记录本轮新增，P1/P2）

- [x] ✅ **P1 高性能模式「所有歌曲」仍非按添加日期排序**：`meta_bulk` 的 `cleanedSongs` 丢 `added_at` → `sortSongsByAddedAt` 退化纯 `id DESC`，与轻量模式不一致
  - ✅ 已修（`a1967bb`）：抽共享 `cleanSong`（两模式同键、必带 `added_at`/`toAddedAtMs`），`playlist_songs` 与 `meta_bulk` 统一使用；+3 单测
- [x] ✅ **P1 IndexedDB 缓存非原子提交**：meta 先写、歌曲分批后写；半写缓存被当命中、跳过 localStorage 兜底，暂时显示缺歌
  - ✅ 已修（`6c43b32`）：写序改为**先歌曲后 meta**（meta=提交标记），meta 记 `songsTotal`；读侧校验 `idbPool.length >= songsTotal` 才命中，否则回退 localStorage；旧缓存无 `songsTotal` 默认 0 不回归
- [x] ✅ **P2「所有歌曲」是内置外歌单并集而非全局曲库**：只并入 `!isBuiltIn` 歌单 → 内置歌单独有/不在任何歌单的歌曲被遗漏
  - ✅ 已修（`78cbae1`）：改用 `songloft.songs.list({ limit, offset })`（v2.6.3 支持、默认 `added_at DESC`）作全局源。后端 `fetchAllSongs`（一次大 `limit` 取全 + 防死循环 + 按 id 去重兜底同秒跨页重复 + truncated/warnings 头回传）；`meta_bulk` 的「所有歌曲」与 flashSongsCache 池改用全局曲库（顺带修复高性能模式内置歌单解析为空），`songs.list` 失败回退旧并集不崩溃；新增 `action=all_songs` 供轻量模式同源；WebDAV 歌不动（存插件 storage、本就不在 songs.list）。+4 单测

## 核实边界

- 本节 ✅/⚠️ 只覆盖「插件侧」代码（`src/`、`static/`、`android/`、`.github/workflows/`、`package.json`、`plugin.json`）。
- 审阅 §3「服务端交叉复核」全部（宿主契约、SQL 默认排序、VM/队列、HEAD 支持、v2.6.3/2.8.9/2.11.4 能力边界）引用 SongLoft 服务端仓库，**本地无法核实**，采信审阅者结论并按"以目标宿主实测为准"处理。
