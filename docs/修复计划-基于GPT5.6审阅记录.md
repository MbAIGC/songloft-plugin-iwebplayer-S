# 修复计划：基于 GPT-5.6 审阅记录整改

> 审阅来源：`docs/GPT-5.6-审阅记录-20260823.md`（基线提交 `352a86c`，dev 分支）。
> 本文件是整改 TODO，完成一项勾一项（`[x]`）。
> 口径：只在 dev 上改动并构建验证，不修改 main；排序问题（§5）用户此前表示暂缓，未确认前保持 `[ ]` 并标记 ⏸。
> **核实状态**（2026-08-23 逐条对照代码）：✅=本地已核实属实；⚠️=部分属实/数字有出入；❓=宿主侧或外部，本地无法核实（以目标宿主实测为准）。核实 ≠ 已修复。

## 阶段一：安全（最高优先）

- [ ] ✅ 1. 清除不可信数据到 `innerHTML` 的持久型 XSS —— **全部 7 处均坐实**
  - 业务文本一律 `textContent` / `createElement` / `append` / `replaceChildren`；URL 用属性赋值并限制协议；移除动态内联事件改用监听器；文本/属性/URL 分上下文处理，不能只靠一个 `escapeHtml`
  - 已核实位置：`utils.js:167`(Toast)、`player.js:203`(歌名/扩展名)、`miot.js:195-204`(设备名/ID)、`plugins.js:158+`(插件名/版本/平台)、`lyrics.js:446`(歌词/KTV)、`playlist.js:936-944,1188-1199`(歌单/歌曲/来源/时间标签)、`online.js:544-556,600,1032-1033,1381-1405`(在线歌单/详情/WebDAV 目录/面包屑 onclick)
  - 分批：先高风险小改动（歌词、Toast、设备名、插件名），再歌单/歌曲/目录名
- [ ] ✅ 2. 限制 Android WebView 导航与 Bridge 来源
  - `shouldOverrideUrlLoading`：主框架只允许本地设置页 + 配置的 SongLoft origin，其它 HTTP(S) 交系统浏览器
  - Bridge 只在受信页注入；敏感方法内部校验 origin；收紧 `allowFileAccess` / `MIXED_CONTENT_ALWAYS_ALLOW`
  - 已核实：`MainActivity.java:205` 全局 `addJavascriptInterface`、`:126` `MIXED_CONTENT_ALWAYS_ALLOW`、**无** `shouldOverrideUrlLoading`、Manifest `usesCleartextTraffic=true`
- [ ] ✅ 3. 安全化歌词 AudioContext 路由（防跨域/移动端静音）
  - 默认用 `audio.currentTime` + 可配置偏移，不只为歌词接管真实音频输出
  - 必须用 Web Audio 时：仅用户手势内初始化/恢复并处理失败；仅对确认 CORS 资源启用；失败退回普通时钟
  - 已核实：`static/lyrics.js:49-50` `createMediaElementSource` + `connect(destination)`（"跨域静音"为行为断言，修复后需实测）
- [ ] ✅ 4. Android 凭据加密 + 关闭备份
  - `allowBackup=false` 或 backup rules 排除凭据；`SharedPreferences` 换 EncryptedSharedPreferences（AndroidX Security）
  - 已核实：`AndroidManifest.xml:9` `allowBackup=true`；`MainActivity.java:260-261,282-283` token 明文 `putString` 进 `MODE_PRIVATE`

## 阶段二：数据正确性

- [ ] ⏸ ✅ 5. 修复「所有歌曲按添加日期倒序」（用户暂缓）
  - 保留宿主 `Song.added_at`（`cleanedSongs` 不再丢弃）；高性能模式同样本地 `(added_at DESC, id DESC)` 稳定排序；修复重复歌曲丢 `_addedAt`、用同步时间冒充添加时间；一次足够大 `limit` 取全 + 检测 `truncated`/`warnings`，不静默丢歌
  - 显式 `orderBy/order` 需宿主 ≥ v2.8.9（HTTP ≥ v2.9.5）；`playlists.getSongs` 的 `sort/order` 需 ≥ v2.11.4 → 维持 2.6.3 兼容则本地排序
  - 已核实：`src/main.ts:87-91` `cleanedSongs` 丢 `added_at`；`:109-138` 高性能 `Promise.all` 无排序；`static/playlist.js:1504` `Date.now()` 冒充添加时间、重复歌 `set` 覆盖丢 `_addedAt`
- [ ] ✅ 6. WebDAV 同名目录覆盖
  - 内部键改相对完整路径（或稳定目录 ID），basename 仅展示；重名 UI 显示父路径
  - 已核实：`src/webdav.ts:82` `currentPath.split('/').pop()` 仅取 basename 作键
- [ ] ✅ 7. WebDAV 单目录错误不再中断整次扫描
  - `songloft.logger.error` → `songloft.log.error`；记录失败目录后继续；区分 `completed_with_warnings` 与真失败
  - 已核实：`src/webdav.ts:103` `songloft.logger.error`（该 API 不存在，会抛错进外层 catch 中断扫描）
- [ ] ⚠️ 8. 隔离全局状态（分片缓存 / WebDAV 扫描状态）
  - `meta_bulk` 返回 `sessionId`，`chunk`/`destroy` 携带；WebDAV 按 `scanId`/`davId` 维护状态 Map，含取消/超时/清理
  - 已核实：`src/main.ts:49` 模块级 `flashSongsCache`；`src/webdav.ts:5-8,140-151` 模块级扫描状态。⚠️ "宿主串行队列、不跨插件共享"为宿主行为（❓待实测）
- [ ] ✅ 9. 一万首静默截断 + HEAD 探测
  - `limit/offset` 分页 + 返回总数或 `truncated`/`warnings`；探测改 AbortController + `Range: bytes=0-0` GET 或直接返回播放 URL；区分临时网络失败与永久失效
  - 已核实：`src/main.ts:85,111` `limit: 10000` 静默截断。❓ HEAD 宿主支持（审阅 §6.4）为宿主侧，待实测

## 阶段三：性能

- [ ] ✅ 10. 后端有界并发（3–5）替代 `Promise.all` 无界全量拉取，单歌单失败返回 warning
  - 已核实：`src/main.ts:109` `Promise.all(playlists.map(...))` 无界并发
- [ ] 11. 曲库缓存迁移 IndexedDB 分批写入，避免同步 `localStorage` 压缩大曲库（大改动，可后置）
  - 涉及：`static/playlist.js:1425-1570`（建议性优化，非 bug，无需核实）
- [ ] ✅ 12. 歌词 RAF 按状态启停：play 启动；pause/ended/页面隐藏取消；仅 KTV 用 RAF；`lastProgress` 跳过无变化
  - 已核实：`static/lyrics.js:99-127` `startLoop` 无条件永久 `requestAnimationFrame`，无暂停/隐藏取消
- [ ] ✅ 13. WebDAV 队列 `shift()` O(n²) → 数组游标；3–6 worker 有界并发 + 超时/重试/取消
  - 已核实：`src/webdav.ts:43` `queue.shift()`；扫描 `while` 全串行
- [ ] ✅ 14. 歌词解析结果先稳定排序再二分查找，定义同时间戳合并规则
  - 已核实：`static/lyrics.js:419` 只前置占位行**未排序**；`:512-534` `findActiveLine` 二分依赖有序前提不成立
- [ ] 15. 拆 `normalizeSong`/`createSongListItem`/`createPlaylistCard`/`updateNowPlaying` + 事件委托，替代大块 innerHTML（与 #1 合并）
  - 涉及：`static/playlist.js`、`online.js`（工程重构，与 #1 一起评估）

## 阶段四：工程与发布

- [ ] ⚠️ 16. 修复 TypeScript（实测 42 个错误，审阅记 38）
  - 真 bug（✅ 已核实）：`songloft.logger` → `songloft.log`（`src/webdav.ts:103`）；请求体转换（`src/webdav.ts:163` 已见 `JSON.parse(cache)` 无兜底；TextDecoder 改造点待落实）
  - SDK 类型陈旧：`Song.added_at`、`Playlist.labels`、`songs.list` 的 `orderBy/order`、`storage` 的 `getItem/setItem` → 同步本地类型声明；版本相关调用做能力检测或升 minHostVersion
- [ ] ✅ 17. 修复 `plugin.json` `download_url`（1.1.5-dev → 1.1.6-dev）+ README 引用
  - 已核实：`plugin.json` `download_url` 仍指向 `1.1.5-dev.jsplugin.zip`，`version` 为 `1.1.6-dev`
- [ ] ✅ 18. 两个 dev 工作流（APK/插件）同改一个 Release → 共享 concurrency group 或单一流程发布
  - 已核实：`build-apk-dev.yml:20` 有 concurrency(`build-apk-dev`)，`build-plugin-dev.yml` **无** concurrency → 可并发编辑同一 Release
- [ ] ⚠️ 19. 发布版本计算：`fetch-depth: 0`；稳定版只选非 prerelease `vX.Y.Z` 且单调递增；说明按标签范围生成
  - 已核实：`build-apk.yml:64` `gh release list --limit 1` 取最新 Release，dev 标签不匹配 `^v?X.Y.Z$` 会回退 `0.0.1`。⚠️ checkout `fetch-depth` 未专门核对，按默认浅克隆处理
- [ ] ✅ 20. CI 质量门禁：`npm ci` → `typecheck` → `test` → `build` → 产物/URL/版本一致性校验 → Android 安装冒烟
  - 已核实：`package.json` **无** `typecheck`/`test` 脚本、无测试；CI 仅 `npm run build`

## 测试矩阵（随各阶段补齐）

- [ ] 注入测试：歌词/歌名/歌单名/目录名/设备名/插件名
- [ ] 非受信 origin 不能访问 Android Bridge
- [ ] 排序：两模式一致、重复歌不丢时间、缓存/刷新后稳定、同秒 id 次级确定、新增置顶、>1万首不重不漏
- [ ] 歌词：普通/KTV/乱序时间戳、本地/同源代理/无 CORS 跨域、暂停/恢复/拖动/隐藏 RAF 停
- [ ] WebDAV：同名/深层/大型树、单目录失败继续、并发/取消/超时/损坏缓存
- [ ] Android/发布：多 API 安装、token 刷新/改服务器、dev 最新时稳定版本仍递增、并发构建不覆盖、产物 hash 一致

## 核实边界

- 本节 ✅/⚠️ 只覆盖「插件侧」代码（`src/`、`static/`、`android/`、`.github/workflows/`、`package.json`、`plugin.json`）。
- 审阅 §3「服务端交叉复核」全部（宿主契约、SQL 默认排序、VM/队列、HEAD 支持、v2.6.3/2.8.9/2.11.4 能力边界）引用 SongLoft 服务端仓库，**本地无法核实**，采信审阅者结论并按"以目标宿主实测为准"处理。
