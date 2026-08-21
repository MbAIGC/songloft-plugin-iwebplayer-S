# iWebPlayer-S 代码 Review

> 审查范围：`src/`（main.ts / scraper.ts / webdav.ts）、`static/`（前端 8 个 JS + index.html 内联脚本）、`plugin.json` / `package.json` / manifest 等。
> 验证：`node --check` 全部通过；`npm run build` 构建成功（需先恢复 `node_modules/.bin` 与 esbuild/jsc 二进制执行位）；`tsc --noEmit` 报 40+ 类型错误。

## 总体评价

功能设计很全、防御性代码写得多，独立命名空间（`iwebplayer-s.*`、独立 entryPath）能与原版并行安装。前端有分片渲染、IntersectionObserver 懒加载刮削、预读缓存、401 容灾引导等扎实优化，锁屏歌词实现思路巧妙。

但存在几个确定的 bug、一块安全暴露面，以及一批类型/工程卫生问题。整体是"功能优先、能跑为先"的产物，清掉 P0/P1 后质量会明显上一个台阶。

## 构建与工具链现状

- 所有 `static/*.js` 通过 `node --check`；`npm run build` 成功。
- `node_modules/.bin/*` 及 esbuild/jsc 二进制缺失执行位，需重新 `npm install` 修复（或统一 chmod）。
- `npx tsc --noEmit` 报 40+ 类型错误：
  - `Playlist.labels`、`Song.file_path / cover_url` 不在 SDK 类型里；
  - `storage.getItem / setItem` 不在 `SongloftStorage` 类型里（运行时走了 `.get/.set` 兜底）；
  - `HTTPRequest / HTTPResponse` 不是全局类型，`onMessage` payload 是 `unknown`；
  - `@ts-expect-error` 有失效指令。
- builder 用 esbuild 不做类型检查，所以能出包；但 `npm run validate` 与 IDE 会一直红，且掩盖了真实 API 契约。
- **建议**：在 src 里定义本地扩展类型（如 `type PlaylistEx = Playlist & { labels?: string[] }`），并确认宿主运行时确实返回这些 snake_case 字段。

## P0 / P1：需要优先修的问题

### 1. 音量设置不持久（确定的 bug）

`iwebplayer-s.player_volume` 只被读取（`static/index.html:3886`、`static/miot.js:258`），没有任何地方写入。滑杆只写 `ConfigManager('config','player_state.volume')`（`static/index.html:3055`）。结果：调完音量刷新页面，必然回到旧值或默认 100。

修法：滑杆 input/change 时同步 `localStorage.setItem('iwebplayer-s.player_volume', vol)`，或 init 直接读 ConfigManager。

### 2. 封面 URL 拼接 `?` / `&` 不一致

- 歌曲列表与海报墙回退无条件用 `&access_token=`（`static/playlist.js:1059`、`static/playlist.js:855`）：若 `cover_url` 不带查询串，token 被拼进路径导致 404；
- 海报墙另一处无条件用 `?`（`static/playlist.js:836`）：若已有查询串会变成双 `?`；
- `static/player.js:440 / 553` 用 `sep` 判断是对的。

建议封装 `appendAccessToken(url)` 统一处理，否则部分封面（尤其无参直链）首载必挂，只能靠 onerror 刮削兜底。

### 3. `/debug` 后门默认开启

`src/main.ts:355` 的 `/debug` 路由里 `debugResult.songs = await songloft.songs.list(...)` 未注释，会 dump 全库歌曲含 `file_path`；`static/debug.html` 自己也叫它"后门接口"。若该路由无额外鉴权，任何能访问插件的人都能拉全库元数据。

建议：发布前默认关闭该模块，或加开关/权限校验。

### 4. PWA 安装链路存在 scope 不匹配

- `static/manifest.json:6` 的 `start_url` / `scope` 都是 `"../"`（指向插件根 `.../iwebplayer-s/`）；
- 页面注册的 SW 是 `./sw.js`（即 `.../static/sw.js`，`static/index.html:53`），SW scope 只在 `/static/` 内；
- Chromium 要求 manifest scope 必须落在 SW scope 内 → scope mismatch，Android 安装会被卡掉；
- `start_url` 指向的插件根路径在后端路由里没有 `/` 处理器，除非宿主把根路径映射到 static index，否则 404；
- `src/main.ts:35` 的 `/sw.js` 路由实际无人使用（页面注册的是静态文件），属冗余。

建议：统一注册插件根路径的 SW（路由 `/sw.js`），并把 manifest 的 `start_url` / `scope` 与 SW scope 对齐。

### 5. `songloft.logger.error` 可能炸掉 WebDAV 扫描

`src/webdav.ts:103` 用 `songloft.logger.error`，SDK 类型只有 `songloft.log.*`，其余代码也统一用 `songloft.log`。若运行时没有 `logger` 别名，任何目录读取错误都会在 catch 块二次抛错，外层 catch 把整个扫描标记为 failed。

建议改成 `songloft.log.error`。

### 6. WebDAV 扫描是模块级单例状态

`scanStatus / currentScanVersion / activeDavId` 是全局变量（`src/webdav.ts:3`），同一插件实例同时只能有一个扫描，多用户/多标签页会互相覆盖状态。单用户自托管可接受，但要知道该限制。

### 7. 小爱推送歌单"先删后建"

`static/miot.js:345` 先 DELETE `iWebPlayer-S推送` 再创建，创建失败时旧歌单已丢；且直接读 `newData.id`，若宿主返回 `data.id` 会静默失败。

建议：先创建成功再删旧的，并对响应结构做兼容。

## 健壮性与安全加固

- **innerHTML 注入面较广**：歌曲名/歌单名/搜索历史/Toast 大量直接拼进 HTML（`static/player.js:147`、`static/playlist.js` 渲染、`static/utils.js` showToast）。数据源是本地文件名、在线 API、用户输入——恶意命名的本地文件或在线歌单标题可注入 HTML。建议统一 escape 或用 textContent。
- **预读失败即标"失效"**：`static/player.js` `scoutNextSong` 预读失败（网络抖动/限流）就 `markSongAsDead` 并跳过，可能误伤可播放歌曲；建议只对真正的 404/403 标死。
- **音箱状态 WS 无重连**：`static/miot.js` `onclose` 只清 ping 定时器，断线后虚拟时钟基于旧基准继续漂移。建议加退避重连。
- **每次播放都改写 LXMusic 音质配置**：`static/utils.js` `fetchLxMusicUrl` 每次播放都 POST 覆盖 `enablePlayQuality/playQuality`，会覆盖用户在 LXMusic 里的设置并多一次请求；建议只在检测到不一致时写。
- **分页判定不一致**：`static/online.js` 请求 `page_size:30` 但 `hasMore` 用 `>= 20`，末尾 20~29 条会误判；歌单详情只取第 1 页，大歌单被截断且无"加载更多"。
- **删歌乐观更新无回滚**：`static/playlist.js` `executeRemoveSong` 先 splice 再 DELETE，失败后 UI 与后端不一致，刷新才恢复。
- **`playSong` MIoT 分支**：`handleCoverError` 引用声明在后的 `listImg`，运行期 OK 但易错，建议把 `listImg` 提前声明。
- **`init()` 里 `defaultCover = window.defaultCover` 是自赋值**：无实际作用，属残留代码。
- **`/musiclist` 的 catch 吞掉真实错误**：统一返回"后端核心引擎崩溃"，排障困难，建议带上错误日志。

## 项目卫生

- `static/index.html:1441` 引用 `./static/lz-string.min.js`，但 static/ 与 dist 里都没有该文件。所有使用点有 `window.LZString ?` 兜底，所以只是每次加载 404 + 失去压缩收益；要么补文件要么删引用。
- **没有 .gitignore**：`node_modules/`、`dist/`、5 张未跟踪截图（`IMG_20260815_*.jpg`）都会在 `git add -A` 时被提交；`dist/` 里还混着旧版 `iwebplayer.jsplugin.zip` / `iwebplayer.json`，容易与 -S 版混淆。建议补 .gitignore（node_modules、dist）并移走截图。
- `OPTIMIZATION_RECORD.md` 说 validate 只因 hash 为空失败，实际还有 tsc 类型错误，记录略过时。
- `plugin.json` 的 `homepage` / `updateUrl` 仍为空，发布前要补。

## 亮点

- 命名空间隔离（`iwebplayer-s.*` 前缀、独立 entryPath）设计干净，能与原版并行安装。
- 前端分片渲染、IntersectionObserver 懒加载刮削、预读缓存、401 容灾引导等优化扎实。
- `updateMediaSession` 锁屏歌词（歌词做 title、歌名做 artist）实现思路巧妙。

## 优先级建议

1. 修 P0/P1：音量持久化、封面 token 封装、`/debug` 默认关闭、PWA scope 对齐、`songloft.log.error`。
2. 清理工程卫生：补 lz-string 或删引用、加 .gitignore、整理未提交产物、修 tsc 类型债。
3. 按需加固：innerHTML 转义、WS 重连、预读标死策略、LXMusic 配置改写。
