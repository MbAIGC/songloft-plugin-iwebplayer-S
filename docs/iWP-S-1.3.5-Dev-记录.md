# iWP-S 1.3.5 Dev 记录

> **本文件约定**：同一大版本（`1.3.5`）内的**所有改动**都记在这里，不再按主题另开文档。
> 每条一个二级标题 `## <构建号>-Dev　<提交>　<一句话目的>　<类型>`；下方先给一行紧凑元信息（日期 ｜ 提交 / 文件），再列要点。
> 类型标签：`⚙️ 功能` · `✅ 布局` · `🎨 外观` · `🐞 修复` · `🚀 性能·构建` · `🏗 重构` · `🧪 诊断` · `🧹 清理` · `📄 文档`。
> 专题深度分析（`分栏模式三栏工具栏改造总结.md`、`iwebplayer-s缓存问题分析.md` 等）保留为参考；本文件是**按版本的索引与结论**。

## 速查索引

| 构建 | 提交 | 一句话目的 | 类型 |
| :--: | :--: | --- | --- |
| 1 | `ba11b9c` | 版本基线提升到 1.3.5-dev，并把「跟进上游必须同步提版本号」写成规范 | 🚀 构建·规范 |
| 2 | `0e0e0db` | 构建期给 logo / PWA manifest 注入内容哈希，修「换 logo 后手机浏览器仍显示旧图」 | 🐞 修复·缓存 |
| 3 | `b60a2c1` | 宽屏「在线搜索」与「本地曲库搜索」合并为一个输入框；设备选择器并入工具栏 | ⚙️ 功能·布局 |
| 4 | `412bb4f` | 工具栏整体并入 header 那一行（原来本机/小爱音箱所在行）；字号还原；修下拉被裁 | ⚙️ 功能·布局 |
| 5 | `cc409e6` | 工具栏限制在右半栏、不越过中界线；允许点击合并后的搜索框 | 🐞 修复·布局 |
| 6 | `dca287d` | 歌单栏改为可收缩 + 音源改浮层按需展开 + 按宽度（1100）决定工具栏是否同行 | ⚙️ 功能·布局 |
| 7 | `5ad1675` | 音源浮层内引擎/平台改为芯片二级选择，并放入 WebDAV 检索行；提示词随引擎变化 | ⚙️ 功能 |
| 8 | `4f6e45d` | 搜索框内容随引擎切换同步 + 浮层内容自愈 + 浮层行距 | 🐞 修复 |
| 9 | `968ba8e` | 浮层芯片不再依赖先聚焦搜索框即可见；修宽屏下全局菜单被藏进隐藏容器 | 🐞 修复 |
| 10 | `09a8434` | 歌单名与（数量）的截断优先级：列窄时优先完整显示歌单名 | 🎨 外观·布局 |
| 11 | `606bf77` | 按宽度回退两行：阈值提到 1440 并实测搜索框可用宽度 | ⚙️ 功能·布局 |
| 12 | `e3a86ae` | 撤销「按宽度回退两行」：宽屏工具栏任何宽度都待在 header 那一行 | ⚙️ 功能·布局 |
| 13 | `783b807` | 半宽屏聚焦搜索框时收起「所有歌曲」栏给输入框腾宽（同时引入搜索框 min-width） | ⚙️ 功能·布局 |
| 14 | `784e279` | 半宽屏按钮标签精简为「歌 / 单 / 源」 | 🎨 外观 |
| 15 | `6bde095` | 按钮标签改为随聚焦切换长短 + 提示文字缩小一档 | 🎨 外观·布局 |
| 16 | `d94a26e` | 搜索按钮加放大镜图标；顺带把 MIoT 推送歌单改名 iWP-S推送 | 🎨 外观·⚙️ 功能 |
| 17 | `fc59a89` | 撤销搜索按钮图标（占宽度），回纯文字 | 🎨 外观 |
| 18 | `8519dff` | 搜索按钮改为「文字 + 底色」（无图标无边框，宽度几乎不变） | 🎨 外观 |
| 19 | `a4f812f` | MIoT 推送歌单改名改走宿主 PUT 接口 + 加载后自动迁移 | 🐞 修复 |
| 20 | `29a192e` | 推送歌单在宿主侧查找 + 回读验证 + 诊断日志 | 🐞 修复·诊断 |
| 21 | `837627f` | 移除推送相关诊断日志（保留改名逻辑） | 🧹 清理 |
| 22 | `aa518a1` | 启动优化 A+B+D：首帧就定分栏/主题（消闪）+ lz-string 改 defer | 🚀 性能 |
| 23 | `756b0a1` | 全屏播放页隐藏宽屏工具栏；分栏状态改为幂等自愈（加 matchMedia/RO 兜底） | 🐞 修复·布局 |
| 24 | `9666e86` | 临时诊断条（长按 logo 显示布局状态） | 🧪 诊断 |
| 25 | `0cd1dee` | GPT 版修复：<1440 回第二行、全屏锁滚动、播放页布局刷新；并修正两行模式列表偏移基准为 115px | 🐞 修复·布局 |
| 26 | `6c74d9e` | 删除搜索框 min-width（修窄分栏横向溢出） | 🐞 修复·布局 |
| 27 | `a42d098` | 撤销全部「聚焦即改布局」：聚焦收起栏 + 标签随聚焦切换（缩放失效的根因） | 🐞 修复·布局 |
| 28 | `91584d8` | 用静态压缩把搜索框宽度补回（歌单栏 76px、设备 68px、去掉按钮竖线） | 🎨 外观·布局 |
| 29 | `c754f1d` | 布局重构：唯一判据 matchMedia + 唯一执行者 syncLayout；安全版「聚焦放大搜索框」（状态挂工具栏自身） | 🏗 重构·布局 |
| 30 | `0677fee` | 宽屏工具栏改为「结构性」放在 header 内（任何宽度都一行）；删除两行模式与工具栏搬移 | 🏗 重构·布局 |
| 31 | `7d362f4` | 展开搜索框时恢复完整按钮文案与间距（搜歌 / 搜单 / 音源 ▾ + 竖线分隔） | 🎨 外观 |

> 共 **31** 条改动，其中布局相关 **16** 条。

---

> ### 阶段 1 · 版本基线与缓存修复（1.3.5.01 – 1.3.5.02）

## 1.3.5.01-Dev　ba11b9c　版本基线提升到 1.3.5-dev，并把「跟进上游必须同步提版本号」写成规范　🚀 构建·规范

`2026-09-18` ｜ `chore: bump base version to 1.3.5-dev and codify upstream-follow version rule`
文件：`AGENT.md`、`DEV_RELEASE_NOTES.md`、`README.md`、`package-lock.json`…


## 1.3.5.02-Dev　0e0e0db　构建期给 logo / PWA manifest 注入内容哈希，修「换 logo 后手机浏览器仍显示旧图」　🐞 修复·缓存

`2026-09-18` ｜ `fix(build): hash logo and PWA manifest URLs to bust immutable cache`
文件：`AGENT.md`、`docs/iwebplayer-s缓存问题分析.md`、`scripts/inject-version-hashes.mjs`

- 只改构建目录；源码里的 `?v0.8.0` 等只是历史占位值。新增图片/字体等子资源必须纳入同一脚本。

> ### 阶段 2 · 宽屏工具栏重排、搜索合并、音源浮层（1.3.5.03 – 1.3.5.09）

## 1.3.5.03-Dev　b60a2c1　宽屏「在线搜索」与「本地曲库搜索」合并为一个输入框；设备选择器并入工具栏　⚙️ 功能·布局

`2026-09-18` ｜ `feat(ui): merge wide-mode local/online search into one input and move device selector into toolbar`
文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

- 两种搜索逻辑本身不动（本地走 `performLocalSearch`、在线走 `tbsDoLxSearch`），只做界面合并 + 来源开关。

## 1.3.5.04-Dev　412bb4f　工具栏整体并入 header 那一行（原来本机/小爱音箱所在行）；字号还原；修下拉被裁　⚙️ 功能·布局

`2026-09-18` ｜ `fix(ui): move wide toolbar into the header row, keep normal font sizes, unclip dropdowns`
文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

- `.tbs{overflow:hidden}` 会裁掉下拉 → 设备栏与在线模式的引擎/插件改 `overflow:visible`。

## 1.3.5.05-Dev　cc409e6　工具栏限制在右半栏、不越过中界线；允许点击合并后的搜索框　🐞 修复·布局

`2026-09-18` ｜ `fix(ui): keep wide toolbar inside the right half and allow focusing the merged search input`
文件：`static/index.html`

- `.header-left-group{flex:0 0 50%}` 固定左半；输入框的 mousedown 不再被旧防夺焦逻辑吞掉。

## 1.3.5.06-Dev　dca287d　歌单栏改为可收缩 + 音源改浮层按需展开 + 按宽度（1100）决定工具栏是否同行　⚙️ 功能·布局

`2026-09-18` ｜ `feat(ui): shrinkable playlist column, on-demand source popover, and width-gated inline toolbar`
文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

- 歌单栏不可收缩是「在线搜索遮挡所有歌曲」的根因。

## 1.3.5.07-Dev　5ad1675　音源浮层内引擎/平台改为芯片二级选择，并放入 WebDAV 检索行；提示词随引擎变化　⚙️ 功能

`2026-09-18` ｜ `feat(ui): source popover with 2-level chips and WebDAV search row, engine-aware placeholder`
文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

- WebDAV 检索走代理输入 → 复用原有「输入即搜」；聚焦代理框会自动切到 WebDAV 引擎。

## 1.3.5.08-Dev　4f6e45d　搜索框内容随引擎切换同步 + 浮层内容自愈 + 浮层行距　🐞 修复

`2026-09-18` ｜ `fix(ui): engine-aware search box sync, popover self-heal and row spacing`
文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`


## 1.3.5.09-Dev　968ba8e　浮层芯片不再依赖先聚焦搜索框即可见；修宽屏下全局菜单被藏进隐藏容器　🐞 修复

`2026-09-19` ｜ `fix(ui): show source popover chips without focusing search, restore wide-mode global menu`
文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

- 旧规则 `.tbs-online #engine-container{display:none}` 特异性更高，把芯片压住了。

> ### 阶段 3 · 外观细节与宽度策略（1.3.5.10 – 1.3.5.11）

## 1.3.5.10-Dev　09a8434　歌单名与（数量）的截断优先级：列窄时优先完整显示歌单名　🎨 外观·布局

`2026-09-19` ｜ `ui: prioritize playlist name over song count when the column is narrow`
文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

- `formatPlaylistText` 里数量是 inline `flex-shrink:0`，必须 `!important` 覆盖。

## 1.3.5.11-Dev　606bf77　按宽度回退两行：阈值提到 1440 并实测搜索框可用宽度　⚙️ 功能·布局

`2026-09-19` ｜ `fix(ui): fall back to two rows on half-width screens (higher floor + measured search width)`
文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`


> ### 阶段 4 · 分栏布局调整（此处引入「聚焦即改布局」回归）（1.3.5.12 – 1.3.5.15）

## 1.3.5.12-Dev　e3a86ae　撤销「按宽度回退两行」：宽屏工具栏任何宽度都待在 header 那一行　⚙️ 功能·布局

`2026-09-19` ｜ `fix(ui): keep wide toolbar in the header row at every width (revert width-based two-row fallback)`
文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

- **用户确认此版本缩放正常**，是后续二分定位的「已知良好」基准。

## 1.3.5.13-Dev　783b807　半宽屏聚焦搜索框时收起「所有歌曲」栏给输入框腾宽（同时引入搜索框 min-width）　⚙️ 功能·布局

`2026-09-19` ｜ `feat(ui): collapse the playlist column while the search box is focused on half-width screens`
文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

- ⛔ 引入回归：**聚焦瞬间改布局**（隐藏整栏）→ 平板浏览器为保持光标可见会平移/缩放页面。
- `min-width:80px` 另造成窄分栏横向溢出；1.3.5.26 单独删除后仍失败，说明主因是聚焦改布局。

## 1.3.5.14-Dev　784e279　半宽屏按钮标签精简为「歌 / 单 / 源」　🎨 外观

`2026-09-19` ｜ `ui: shorten toolbar button labels on half-width screens (歌/单/源)`
文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`


## 1.3.5.15-Dev　6bde095　按钮标签改为随聚焦切换长短 + 提示文字缩小一档　🎨 外观·布局

`2026-09-19` ｜ `ui: shorten toolbar labels only while the search box is unfocused; shrink placeholder on half-width`
文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

- ⛔ 又叠加一处「聚焦瞬间改布局」（按钮宽度随聚焦变化）。

> ### 阶段 5 · 按钮外观打磨 + MIoT 推送歌单改名（1.3.5.16 – 1.3.5.21）

## 1.3.5.16-Dev　d94a26e　搜索按钮加放大镜图标；顺带把 MIoT 推送歌单改名 iWP-S推送　🎨 外观·⚙️ 功能

`2026-09-19` ｜ `ui: search-button style for 搜歌/搜单, rename MIoT push playlist to iWP-S推送`
文件：`DEV_RELEASE_NOTES.md`、`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`、`static/miot.js`


## 1.3.5.17-Dev　fc59a89　撤销搜索按钮图标（占宽度），回纯文字　🎨 外观

`2026-09-19` ｜ `ui: revert search buttons to minimal text style (icons cost too much width)`
文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`


## 1.3.5.18-Dev　8519dff　搜索按钮改为「文字 + 底色」（无图标无边框，宽度几乎不变）　🎨 外观

`2026-09-19` ｜ `ui: search buttons use text + background tint (no icon, width unchanged)`
文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`


## 1.3.5.19-Dev　a4f812f　MIoT 推送歌单改名改走宿主 PUT 接口 + 加载后自动迁移　🐞 修复

`2026-09-19` ｜ `fix(miot): rename push playlist via PUT and auto-migrate legacy name on load`
文件：`DEV_RELEASE_NOTES.md`、`docs/分栏模式三栏工具栏改造总结.md`、`static/miot.js`

- 改名对象是**本插件自己写死的字符串**（`static/miot.js`），与 SongLoft 宿主、miot-helper 都无关。

## 1.3.5.20-Dev　29a192e　推送歌单在宿主侧查找 + 回读验证 + 诊断日志　🐞 修复·诊断

`2026-09-19` ｜ `fix(miot): look up push playlists on the host side, verify rename and log diagnostics`
文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/miot.js`


## 1.3.5.21-Dev　837627f　移除推送相关诊断日志（保留改名逻辑）　🧹 清理

`2026-09-19` ｜ `chore(miot): drop speculative diagnostics, keep push playlist rename as the only fix`
文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/miot.js`


> ### 阶段 6 · 启动优化与诊断工具（1.3.5.22 – 1.3.5.24）

## 1.3.5.22-Dev　aa518a1　启动优化 A+B+D：首帧就定分栏/主题（消闪）+ lz-string 改 defer　🚀 性能

`2026-09-19` ｜ `perf(boot): set split/theme before first paint and stop lz-string blocking render`
文件：`static/index.html`

- `<body>` 后立即用同一媒体查询加 `split-view-active` 并设 `data-theme`；`lz-string` 不再阻塞渲染。

## 1.3.5.23-Dev　756b0a1　全屏播放页隐藏宽屏工具栏；分栏状态改为幂等自愈（加 matchMedia/RO 兜底）　🐞 修复·布局

`2026-09-19` ｜ `fix(ui): hide wide toolbar in full player, make split switching self-healing`
文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

- 工具栏搬进 header 后，旧版「播放页隐藏 #playlist-row」的规则管不到它了。

## 1.3.5.24-Dev　9666e86　临时诊断条（长按 logo 显示布局状态）　🧪 诊断

`2026-09-19` ｜ `chore(debug): add long-press layout diagnostic badge (temporary)`
文件：`static/index.html`


> ### 阶段 7 · 回归定位与布局重构（1.3.5.25 – 1.3.5.31）

## 1.3.5.25-Dev　0cd1dee　GPT 版修复：<1440 回第二行、全屏锁滚动、播放页布局刷新；并修正两行模式列表偏移基准为 115px　🐞 修复·布局

`2026-09-19` ｜ `fix(ui): apply reviewed local fix (two-row toolbar fallback, player scroll lock, full-player layout refresh); correct two-row list offset to 115px`
文件：`static/index.html`、`static/player.js`

- `body{overflow:visible!important}` 被替换为 `body.player-open{overflow:hidden}`（全屏锁滚动）；若 iOS 滚动乱跳复发，优先回退这一处。

## 1.3.5.26-Dev　6c74d9e　删除搜索框 min-width（修窄分栏横向溢出）　🐞 修复·布局

`2026-09-19` ｜ `fix(ui): drop search-input min-width that forced horizontal overflow on narrow split widths (regression since 1.3.5.13)`
文件：`static/index.html`

- 实测无效 → 说明主因不是它，而是「聚焦瞬间改布局」。

## 1.3.5.27-Dev　a42d098　撤销全部「聚焦即改布局」：聚焦收起栏 + 标签随聚焦切换（缩放失效的根因）　🐞 修复·布局

`2026-09-19` ｜ `fix(ui): remove all focus-triggered layout shifts (revert focus-collapse and make compact labels static)`
文件：`static/index.html`

- **用户确认此版本恢复正常** ✓。代价：点搜索框不再自动让位。

## 1.3.5.28-Dev　91584d8　用静态压缩把搜索框宽度补回（歌单栏 76px、设备 68px、去掉按钮竖线）　🎨 外观·布局

`2026-09-19` ｜ `fix(ui): static compaction for narrow split widths; codify no-focus-layout-shift rule`
文件：`AGENT.md`、`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

- 静态压缩与聚焦状态无关 → 不会在光标下方改布局。

## 1.3.5.29-Dev　c754f1d　布局重构：唯一判据 matchMedia + 唯一执行者 syncLayout；安全版「聚焦放大搜索框」（状态挂工具栏自身）　🏗 重构·布局

`2026-09-19` ｜ `refactor(layout): single source of truth (matchMedia + syncLayout); re-add focus-expand scoped to the toolbar`
文件：`static/index.html`、`static/player.js`

- 删掉 `applySplitByWidth`、`splitObserver`（body class 观察者）、`wideInlineBlockedAt` 实测回退；
- 事件源（resize / orientationchange / mq.change / visualViewport / RO）全部只调 `syncLayout()`；
- 聚焦放大挂在 `#toolbar-split.search-expand`（**不挂 body**），且只在 <1100px 生效；
- 新增布局自检：只在真的不一致时 `console.warn` 并显示红条（平时零观察者、零定时器）。

## 1.3.5.30-Dev　0677fee　宽屏工具栏改为「结构性」放在 header 内（任何宽度都一行）；删除两行模式与工具栏搬移　🏗 重构·布局

`2026-09-19` ｜ `ui: put the wide toolbar structurally in the header (always one row), drop two-row mode and toolbar moving`
文件：`static/index.html`

- **问题** —— 半宽屏下工具栏又回到第二行（沿用 1.3.5.25 的「<1440 回第二行」策略），而需求是任何宽度都在顶栏。
- **做法** —— 把 `#toolbar-split` 在 **HTML 里直接放进 `.header`**，不再用 JS 搬来搬去；`syncLayout` 只保留 `split` / `narrow` 两态；删除 `placeToolbar`、`_toolbarHome`、`WIDE_INLINE_MIN` 与 `wide-toolbar-inline` 类。
- CSS 门控由 `body.wide-toolbar-inline` 改为 `body.split-view-active`；`--split-list-top` 基准统一为 `58px`。
- **收益** —— ① 任何宽度都在顶栏；② 启动时不再有「先第二行、再跳到顶栏」的闪动；③ 布局自检的不变量简化为「工具栏必须待在 `.header` 内」。

## 1.3.5.31-Dev　7d362f4　展开搜索框时恢复完整按钮文案与间距（搜歌 / 搜单 / 音源 ▾ + 竖线分隔）　🎨 外观

`2026-09-19` ｜ `ui: restore full button labels and separators in the expanded search state`
文件：`static/index.html`

- 展开态（`#toolbar-split.search-expand`）用 **ID 选择器**覆盖 ≤1099 的紧凑规则，回到「宽敞态」外观：完整文案 + 按钮间竖线 + 2px 间隙。
