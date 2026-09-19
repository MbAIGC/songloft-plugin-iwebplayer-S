# iWP-S 1.3.5 Dev 记录

> **本文件约定**：同一大版本（`1.3.5`）内的**所有改动**都记在这里，不再按主题另开文档。
> **每条格式**：三级标题 `### <构建号>-Dev　<提交短哈希>　　<类型标签>`，下面依次是
> `**概述**：`（一句话）、`**用户需求**：`（当时要解决什么）、`**改造思路**：`（怎么改的），末行灰色元信息（日期 ｜ 提交 ｜ 文件）。
> 类型标签：`⚙️ 功能` · `✅ 布局` · `🎨 外观` · `🐞 修复` · `🚀 性能·构建` · `🏗 重构` · `🧪 诊断` · `🧹 清理`。

## 速查索引

| 构建 | 提交 | 概述 | 类型 |
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

| 32 | `5cacb8e` | 修 768–959px 分栏带里「右栏歌单被氛围遮罩盖住」 | 🐞 修复·布局 |
> 共 **32** 条改动，其中布局相关 **17** 条。

---

## 阶段 1 · 版本基线与缓存修复（1.3.5.01 – 1.3.5.02）

### 1.3.5.01-Dev　ba11b9c　　🚀 构建·规范

**概述**：版本基线提升到 1.3.5-dev，并把「跟进上游必须同步提版本号」写成规范

**用户需求**：跟进上游一段时间后，需要把版本号基线与规则固定下来，避免每次跟进都靠记忆。

**改造思路**：把 base 版本提升到 1.3.5-dev，并在 AGENT.md 写成规则：跟进上游必须同步提升版本号。

> `2026-09-18` ｜ `chore: bump base version to 1.3.5-dev and codify upstream-follow version rule` ｜ 文件：`AGENT.md`、`DEV_RELEASE_NOTES.md`、`README.md`、`package-lock.json`…

### 1.3.5.02-Dev　0e0e0db　　🐞 修复·缓存

**概述**：构建期给 logo / PWA manifest 注入内容哈希，修「换 logo 后手机浏览器仍显示旧图」

**用户需求**：换新 logo 后，手机普通浏览器一直显示旧图（无痕模式正常），怀疑是缓存。

**改造思路**：定位为宿主对子资源发 immutable、max-age 1 年 → 构建期给 logo 与 PWA manifest 注入内容哈希（?v=sha256 前 8 位）：内容不变 URL 不变，内容一变自动失效。

> 只改构建目录；源码里的 `?v0.8.0` 等只是历史占位值。新增图片/字体等子资源必须纳入同一脚本。

> `2026-09-18` ｜ `fix(build): hash logo and PWA manifest URLs to bust immutable cache` ｜ 文件：`AGENT.md`、`docs/iwebplayer-s缓存问题分析.md`、`scripts/inject-version-hashes.mjs`

## 阶段 2 · 宽屏工具栏重排、搜索合并、音源浮层（1.3.5.03 – 1.3.5.09）

### 1.3.5.03-Dev　b60a2c1　　⚙️ 功能·布局

**概述**：宽屏「在线搜索」与「本地曲库搜索」合并为一个输入框；设备选择器并入工具栏

**用户需求**：宽屏下「在线搜索」与「本地曲库搜索」是两个输入框，占地方，想合并成一个。

**改造思路**：两个输入框移入同一栏、用「本地/在线」开关切换显示；搜索逻辑本身不动（本地仍走 performLocalSearch、在线仍走 tbsDoLxSearch），只做界面合并 + 来源记忆。

> 两种搜索逻辑本身不动（本地走 `performLocalSearch`、在线走 `tbsDoLxSearch`），只做界面合并 + 来源开关。

> `2026-09-18` ｜ `feat(ui): merge wide-mode local/online search into one input and move device selector into toolbar` ｜ 文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

### 1.3.5.04-Dev　412bb4f　　⚙️ 功能·布局

**概述**：工具栏整体并入 header 那一行（原来本机/小爱音箱所在行）；字号还原；修下拉被裁

**用户需求**：新工具栏位置不对：应该在原来「本机/小爱音箱」那一行；另外字号别缩小、设备下拉点不出来。

**改造思路**：工具栏整体并入 header 行（原设备行）；去掉缩字号的覆盖、改为压缩搜索框宽度；修 .tbs 的 overflow:hidden 裁掉下拉的问题。

> `.tbs{overflow:hidden}` 会裁掉下拉 → 设备栏与在线模式的引擎/插件改 `overflow:visible`。

> `2026-09-18` ｜ `fix(ui): move wide toolbar into the header row, keep normal font sizes, unclip dropdowns` ｜ 文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

### 1.3.5.05-Dev　cc409e6　　🐞 修复·布局

**概述**：工具栏限制在右半栏、不越过中界线；允许点击合并后的搜索框

**用户需求**：工具栏越过了中界线、占用了左侧；另外合并后的搜索框点不进去、必须点一次开关才能输入。

**改造思路**：header 左半固定 50%，工具栏只占右半栏；放行输入框的 mousedown（旧防夺焦逻辑把本地输入框也吞了）。

> `.header-left-group{flex:0 0 50%}` 固定左半；输入框的 mousedown 不再被旧防夺焦逻辑吞掉。

> `2026-09-18` ｜ `fix(ui): keep wide toolbar inside the right half and allow focusing the merged search input` ｜ 文件：`static/index.html`

### 1.3.5.06-Dev　dca287d　　⚙️ 功能·布局

**概述**：歌单栏改为可收缩 + 音源改浮层按需展开 + 按宽度（1100）决定工具栏是否同行

**用户需求**：全屏勉强能接受但不理想；半宽屏时在线搜索会遮挡「所有歌曲」区域。

**改造思路**：量化常驻控件宽度后：歌单栏改可收缩（消除遮挡根因）+ 音源改浮层按需展开（省约 160px）+ 按宽度决定工具栏是否同行。

> 歌单栏不可收缩是「在线搜索遮挡所有歌曲」的根因。

> `2026-09-18` ｜ `feat(ui): shrinkable playlist column, on-demand source popover, and width-gated inline toolbar` ｜ 文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

### 1.3.5.07-Dev　5ad1675　　⚙️ 功能

**概述**：音源浮层内引擎/平台改为芯片二级选择，并放入 WebDAV 检索行；提示词随引擎变化

**用户需求**：音源里不该有三级菜单（应二级）；浮层里要能直接做网盘（WebDAV）检索；在线提示词应随引擎变化。

**改造思路**：引擎与平台/服务器改为芯片二级选择；加 WebDAV 代理输入行（复用原有「输入即搜」）；提示词按 PluginManager 当前引擎切换。

> WebDAV 检索走代理输入 → 复用原有「输入即搜」；聚焦代理框会自动切到 WebDAV 引擎。

> `2026-09-18` ｜ `feat(ui): source popover with 2-level chips and WebDAV search row, engine-aware placeholder` ｜ 文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

### 1.3.5.08-Dev　4f6e45d　　🐞 修复

**概述**：搜索框内容随引擎切换同步 + 浮层内容自愈 + 浮层行距

**用户需求**：切换 LXMusic / WebDAV 后，搜索框内容与提示词不对；反复点音源还会出现空浮层。

**改造思路**：把同步挂到 refreshOnlineUI（引擎/视图切换后必经）统一处理；浮层加内容自愈 + 行距；展开态把浮层内部点击排除在外部关闭之外。

> `2026-09-18` ｜ `fix(ui): engine-aware search box sync, popover self-heal and row spacing` ｜ 文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

### 1.3.5.09-Dev　968ba8e　　🐞 修复

**概述**：浮层芯片不再依赖先聚焦搜索框即可见；修宽屏下全局菜单被藏进隐藏容器

**用户需求**：不点搜索框直接点音源时，浮层里只有 WebDAV 那一行、看不到芯片；宽屏切在线资源后全局菜单消失。

**改造思路**：旧规则 .tbs-online #engine-container{display:none}（带 ID、特异性更高）把芯片压住了 → 用浮层内 ID 规则覆盖；全局菜单被塞进隐藏容器 → 在宽屏收回右栏 dropzone。

> 旧规则 `.tbs-online #engine-container{display:none}` 特异性更高，把芯片压住了。

> `2026-09-19` ｜ `fix(ui): show source popover chips without focusing search, restore wide-mode global menu` ｜ 文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

## 阶段 3 · 外观细节与宽度策略（1.3.5.10 – 1.3.5.11）

### 1.3.5.10-Dev　09a8434　　🎨 外观·布局

**概述**：歌单名与（数量）的截断优先级：列窄时优先完整显示歌单名

**用户需求**：歌单栏被压缩时，歌单名被截成「所有歌…」，而 (数量) 却始终完整显示。

**改造思路**：formatPlaylistText 里数量是 inline 的 flex-shrink:0（锁死）→ 用 !important 覆盖为「名字优先、数量先让位」。

> `formatPlaylistText` 里数量是 inline `flex-shrink:0`，必须 `!important` 覆盖。

> `2026-09-19` ｜ `ui: prioritize playlist name over song count when the column is narrow` ｜ 文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

### 1.3.5.11-Dev　606bf77　　⚙️ 功能·布局

**概述**：按宽度回退两行：阈值提到 1440 并实测搜索框可用宽度

**用户需求**：半宽屏仍挤在一行，位置看起来没修正。

**改造思路**：把同行阈值从 1100 提到 1440，并实测搜索框可用宽度（小于 160px 就回退两行）。

> `2026-09-19` ｜ `fix(ui): fall back to two rows on half-width screens (higher floor + measured search width)` ｜ 文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

## 阶段 4 · 分栏布局调整（此处引入「聚焦即改布局」回归）（1.3.5.12 – 1.3.5.15）

### 1.3.5.12-Dev　e3a86ae　　⚙️ 功能·布局

**概述**：撤销「按宽度回退两行」：宽屏工具栏任何宽度都待在 header 那一行

**用户需求**：上一版把工具栏按宽度回退到第二行，但需求是任何宽度都待在顶栏（方向错了）。

**改造思路**：撤销按宽度回退：分栏时工具栏始终并入 header 行。用户确认此版缩放正常，成为后续二分基准。

> **用户确认此版本缩放正常**，是后续二分定位的「已知良好」基准。

> `2026-09-19` ｜ `fix(ui): keep wide toolbar in the header row at every width (revert width-based two-row fallback)` ｜ 文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

### 1.3.5.13-Dev　783b807　　⚙️ 功能·布局

**概述**：半宽屏聚焦搜索框时收起「所有歌曲」栏给输入框腾宽（同时引入搜索框 min-width）

**用户需求**：半宽屏下搜索框被压得很小、输入文字都看不到，希望点搜索框时把「所有歌曲」栏让出来。

**改造思路**：聚焦搜索框时隐藏歌单栏（并给输入框加 min-width 80px）。⛔ 这引入了「聚焦瞬间改布局」的回归 → 见 1.3.5.27。

> ⛔ 引入回归：**聚焦瞬间改布局**（隐藏整栏）→ 平板浏览器为保持光标可见会平移/缩放页面。

> `min-width:80px` 另造成窄分栏横向溢出；1.3.5.26 单独删除后仍失败，说明主因是聚焦改布局。

> `2026-09-19` ｜ `feat(ui): collapse the playlist column while the search box is focused on half-width screens` ｜ 文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

### 1.3.5.14-Dev　784e279　　🎨 外观

**概述**：半宽屏按钮标签精简为「歌 / 单 / 源」

**用户需求**：「歌 / 单，搜歌 / 搜单」做成按钮风格是否更好；先用短标签省宽度。

**改造思路**：半宽屏按钮标签精简为「歌 / 单 / 源」；⛔ 与 13 一起构成回归的一部分。

> `2026-09-19` ｜ `ui: shorten toolbar button labels on half-width screens (歌/单/源)` ｜ 文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

### 1.3.5.15-Dev　6bde095　　🎨 外观·布局

**概述**：按钮标签改为随聚焦切换长短 + 提示文字缩小一档

**用户需求**：短标签在点开搜索框后应恢复成完整文字，且提示文字要小一档才协调。

**改造思路**：标签改为随下划线状态类切换长短 + placeholder 缩小。⛔ 又叠加一处「聚焦改布局」→ 见 1.3.5.27。

> ⛔ 又叠加一处「聚焦瞬间改布局」（按钮宽度随聚焦变化）。

> `2026-09-19` ｜ `ui: shorten toolbar labels only while the search box is unfocused; shrink placeholder on half-width` ｜ 文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

## 阶段 5 · 按钮外观打磨 + MIoT 推送歌单改名（1.3.5.16 – 1.3.5.21）

### 1.3.5.16-Dev　d94a26e　　🎨 外观·⚙️ 功能

**概述**：搜索按钮加放大镜图标；顺带把 MIoT 推送歌单改名 iWP-S推送

**用户需求**：按钮想要搜索按钮的风格；顺带把 MIoT 推送歌单名改短。

**改造思路**：按钮加放大镜图标 + 胶囊样式；推送歌单改名 iWP-S推送（当时用「删旧建新」迁移）。

> `2026-09-19` ｜ `ui: search-button style for 搜歌/搜单, rename MIoT push playlist to iWP-S推送` ｜ 文件：`DEV_RELEASE_NOTES.md`、`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`、`static/miot.js`

### 1.3.5.17-Dev　fc59a89　　🎨 外观

**概述**：撤销搜索按钮图标（占宽度），回纯文字

**用户需求**：放大镜图标太占宽度、有违省空间的初衷，要简约些。

**改造思路**：撤销图标，回纯文字按钮；保留免费的对齐修复（inline-flex 居中）。

> `2026-09-19` ｜ `ui: revert search buttons to minimal text style (icons cost too much width)` ｜ 文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

### 1.3.5.18-Dev　8519dff　　🎨 外观

**概述**：搜索按钮改为「文字 + 底色」（无图标无边框，宽度几乎不变）

**用户需求**：能不能做成「文字 + 底色」的按钮风格。

**改造思路**：三个按钮统一小胶囊底色（--bg-color），无图标无边框，宽度几乎不变。

> `2026-09-19` ｜ `ui: search buttons use text + background tint (no icon, width unchanged)` ｜ 文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

### 1.3.5.19-Dev　a4f812f　　🐞 修复

**概述**：MIoT 推送歌单改名改走宿主 PUT 接口 + 加载后自动迁移

**用户需求**：推送歌单改名并未修改成功。

**改造思路**：查实宿主支持 PUT /api/v1/playlists/{id} 重命名 → 改为直接改名（不删歌单）并在加载后自动迁移；同步内存并重绘下拉。

> 改名对象是**本插件自己写死的字符串**（`static/miot.js`），与 SongLoft 宿主、miot-helper 都无关。

> `2026-09-19` ｜ `fix(miot): rename push playlist via PUT and auto-migrate legacy name on load` ｜ 文件：`DEV_RELEASE_NOTES.md`、`docs/分栏模式三栏工具栏改造总结.md`、`static/miot.js`

### 1.3.5.20-Dev　29a192e　　🐞 修复·诊断

**概述**：推送歌单在宿主侧查找 + 回读验证 + 诊断日志

**用户需求**：改名仍不生效，怀疑名字来源、或歌单不在 meta 里。

**改造思路**：加宿主侧查找（meta 查不到就直接问宿主）+ 改名后回读验证 + 启动诊断日志，先把事实拿全。

> `2026-09-19` ｜ `fix(miot): look up push playlists on the host side, verify rename and log diagnostics` ｜ 文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/miot.js`

### 1.3.5.21-Dev　837627f　　🧹 清理

**概述**：移除推送相关诊断日志（保留改名逻辑）

**用户需求**：诊断日志已完成使命，需要收尾。

**改造思路**：删除猴补丁与诊断日志，只保留「改名 + 宿主侧查找 + 新旧名一并清理」。

> `2026-09-19` ｜ `chore(miot): drop speculative diagnostics, keep push playlist rename as the only fix` ｜ 文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/miot.js`

## 阶段 6 · 启动优化与诊断工具（1.3.5.22 – 1.3.5.24）

### 1.3.5.22-Dev　aa518a1　　🚀 性能

**概述**：启动优化 A+B+D：首帧就定分栏/主题（消闪）+ lz-string 改 defer

**用户需求**：启动 APK 或网页时，先闪一下手机端界面再变宽屏；深色模式还先白后黑。

**改造思路**：在 body 开标签后立即用同一媒体查询加首帧状态（分栏 + 主题），并让 lz-string 改 defer（不再阻塞首帧）。

> `<body>` 后立即用同一媒体查询加 `split-view-active` 并设 `data-theme`；`lz-string` 不再阻塞渲染。

> `2026-09-19` ｜ `perf(boot): set split/theme before first paint and stop lz-string blocking render` ｜ 文件：`static/index.html`

### 1.3.5.23-Dev　756b0a1　　🐞 修复·布局

**概述**：全屏播放页隐藏宽屏工具栏；分栏状态改为幂等自愈（加 matchMedia/RO 兜底）

**用户需求**：全屏播放界面里会露出新工具栏；窗口缩放后布局不自动恢复。

**改造思路**：全屏时隐藏工具栏（补 playlist-row 与 header 两处）；分栏判定改为幂等自愈并加 matchMedia / ResizeObserver 兜底。

> 工具栏搬进 header 后，旧版「播放页隐藏 #playlist-row」的规则管不到它了。

> `2026-09-19` ｜ `fix(ui): hide wide toolbar in full player, make split switching self-healing` ｜ 文件：`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

### 1.3.5.24-Dev　9666e86　　🧪 诊断

**概述**：临时诊断条（长按 logo 显示布局状态）

**用户需求**：需要能在没有控制台的情况下看到布局现场。

**改造思路**：加长按 logo 显示的诊断条（视口宽、class、工具栏归属、底部空隙）。

> `2026-09-19` ｜ `chore(debug): add long-press layout diagnostic badge (temporary)` ｜ 文件：`static/index.html`

## 阶段 7 · 回归定位与布局重构（1.3.5.25 – 1.3.5.32）

### 1.3.5.25-Dev　0cd1dee　　🐞 修复·布局

**概述**：GPT 版修复：<1440 回第二行、全屏锁滚动、播放页布局刷新；并修正两行模式列表偏移基准为 115px

**用户需求**：问题仍在，需要一次较全面的修复（GPT 本地版）。

**改造思路**：GPT 版：1440 以下回第二行、全屏锁滚动（body.player-open 锁 overflow）、播放页布局刷新（visualViewport / 横竖屏）；我补：两行模式列表偏移基准改回 115px。

> `body{overflow:visible!important}` 被替换为 `body.player-open{overflow:hidden}`（全屏锁滚动）；若 iOS 滚动乱跳复发，优先回退这一处。

> `2026-09-19` ｜ `fix(ui): apply reviewed local fix (two-row toolbar fallback, player scroll lock, full-player layout refresh); correct two-row list offset to 115px` ｜ 文件：`static/index.html`、`static/player.js`

### 1.3.5.26-Dev　6c74d9e　　🐞 修复·布局

**概述**：删除搜索框 min-width（修窄分栏横向溢出）

**用户需求**：窄分栏仍有横向溢出、缩放异常。

**改造思路**：删除搜索框 min-width 80px（它让工具栏最小宽度超过半栏）。❌ 实测无效 → 说明主因是「聚焦瞬间改布局」。

> 实测无效 → 说明主因不是它，而是「聚焦瞬间改布局」。

> `2026-09-19` ｜ `fix(ui): drop search-input min-width that forced horizontal overflow on narrow split widths (regression since 1.3.5.13)` ｜ 文件：`static/index.html`

### 1.3.5.27-Dev　a42d098　　🐞 修复·布局

**概述**：撤销全部「聚焦即改布局」：聚焦收起栏 + 标签随聚焦切换（缩放失效的根因）

**用户需求**：窗口缩放失效、底部黑块仍在（已二分出 1.3.5.12 正常、13 起失败）。

**改造思路**：撤销全部「聚焦即改布局」：聚焦收起栏（CSS + JS 全撤）+ 标签改回静态。用户确认恢复 ✓。

> **用户确认此版本恢复正常** ✓。代价：点搜索框不再自动让位。

> `2026-09-19` ｜ `fix(ui): remove all focus-triggered layout shifts (revert focus-collapse and make compact labels static)` ｜ 文件：`static/index.html`

### 1.3.5.28-Dev　91584d8　　🎨 外观·布局

**概述**：用静态压缩把搜索框宽度补回（歌单栏 76px、设备 68px、去掉按钮竖线）

**用户需求**：撤掉聚焦让位后，搜索框又被压得很小。

**改造思路**：改用静态压缩（与聚焦无关）：歌单栏 76px、设备 68px、去掉按钮竖线，把宽度稳定让给搜索框。

> 静态压缩与聚焦状态无关 → 不会在光标下方改布局。

> `2026-09-19` ｜ `fix(ui): static compaction for narrow split widths; codify no-focus-layout-shift rule` ｜ 文件：`AGENT.md`、`docs/分栏模式三栏工具栏改造总结.md`、`static/index.html`

### 1.3.5.29-Dev　c754f1d　　🏗 重构·布局

**概述**：布局重构：唯一判据 matchMedia + 唯一执行者 syncLayout；安全版「聚焦放大搜索框」（状态挂工具栏自身）

**用户需求**：按你指出的方向重构：判据要唯一、搬运要收敛、不要多个观察者各改布局；同时把「聚焦放大」安全地做回来。

**改造思路**：① 唯一判据改为 768px 的 matchMedia（与 CSS 同源）；② 唯一执行者 syncLayout；③ 事件源全部只调它；④ 删掉 body-class 观察者与实测回退；⑤ 聚焦放大状态挂 toolbar-split 的 search-expand 类（不挂 body）。

> 删掉 `applySplitByWidth`、`splitObserver`（body class 观察者）、`wideInlineBlockedAt` 实测回退；

> 事件源（resize / orientationchange / mq.change / visualViewport / RO）全部只调 `syncLayout()`；

> 聚焦放大挂在 `#toolbar-split.search-expand`（**不挂 body**），且只在 <1100px 生效；

> 新增布局自检：只在真的不一致时 `console.warn` 并显示红条（平时零观察者、零定时器）。

> `2026-09-19` ｜ `refactor(layout): single source of truth (matchMedia + syncLayout); re-add focus-expand scoped to the toolbar` ｜ 文件：`static/index.html`、`static/player.js`

### 1.3.5.30-Dev　0677fee　　🏗 重构·布局

**概述**：宽屏工具栏改为「结构性」放在 header 内（任何宽度都一行）；删除两行模式与工具栏搬移

**用户需求**：半宽屏下工具栏又跑到第二行；而需求是任何宽度都在顶栏。

**改造思路**：把宽屏工具栏在 HTML 里直接放进 header，不再用 JS 搬移；删除两行模式相关的一切（wide-toolbar-inline、placeToolbar、WIDE_INLINE_MIN），列表顶部偏移统一 58px。

> **问题** —— 半宽屏下工具栏又回到第二行（沿用 1.3.5.25 的「<1440 回第二行」策略），而需求是任何宽度都在顶栏。

> **做法** —— 把 `#toolbar-split` 在 **HTML 里直接放进 `.header`**，不再用 JS 搬来搬去；`syncLayout` 只保留 `split` / `narrow` 两态；删除 `placeToolbar`、`_toolbarHome`、`WIDE_INLINE_MIN` 与 `wide-toolbar-inline` 类。

> CSS 门控由 `body.wide-toolbar-inline` 改为 `body.split-view-active`；`--split-list-top` 基准统一为 `58px`。

> **收益** —— ① 任何宽度都在顶栏；② 启动时不再有「先第二行、再跳到顶栏」的闪动；③ 布局自检的不变量简化为「工具栏必须待在 `.header` 内」。

> `2026-09-19` ｜ `ui: put the wide toolbar structurally in the header (always one row), drop two-row mode and toolbar moving` ｜ 文件：`static/index.html`

### 1.3.5.31-Dev　7d362f4　　🎨 外观

**概述**：展开搜索框时恢复完整按钮文案与间距（搜歌 / 搜单 / 音源 ▾ + 竖线分隔）

**用户需求**：展开搜索框后，按钮应显示完整文案（搜歌 / 搜单 / 音源），且三个按钮要有间距。

**改造思路**：展开态用 ID 选择器覆盖紧凑档规则：恢复完整标签 + 竖线分隔 + gap 2px。

> 展开态（`#toolbar-split.search-expand`）用 **ID 选择器**覆盖 ≤1099 的紧凑规则，回到「宽敞态」外观：完整文案 + 按钮间竖线 + 2px 间隙。

> `2026-09-19` ｜ `ui: restore full button labels and separators in the expanded search state` ｜ 文件：`static/index.html`

### 1.3.5.32-Dev　5cacb8e　　🐞 修复·布局

**概述**：修 768–959px 分栏带里「右栏歌单被氛围遮罩盖住」

**用户需求**：宽屏设备上 1/3 是手机界面、2/3 是半宽屏、全屏是宽屏都正常；但在约 **3/5 – 3/4** 宽度时，左栏完整、右栏只剩顶部工具栏，**工具栏下面的歌单不显示**。

**改造思路**：氛围背景层 `.fp-ambient-bg` 是 `z-index:135` 的**不透明全屏层**，而「把右栏 `.playlist / .playlist-grid` 抬到 `z-index:140`」的规则原先**只写在 `@media (min-width: 960px)`** 里。于是在 **768–959px** 这一段（1280 宽屏幕的 3/5–3/4 恰好是 768–960）：左栏 `.full-player`(190) 与顶栏 header(150/260) 都在遮罩之上，唯独右栏歌单没有 z-index → 被遮罩盖住。已在 768–959 段补上同样的抬升规则。

> 这是 768–959 分栏带原有的规则空缺（并非本轮工具栏改动引入），之前没被注意到是因为很少停在这个宽度。

> `2026-09-19` ｜ `fix(ui): raise right-column list above the ambient layer in the 768-959px split band` ｜ 文件：`static/index.html`
