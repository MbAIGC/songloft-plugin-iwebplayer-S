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
| 33 | `66d5a99` | 补齐 768–959px 分栏带缺失的显示规则（列表内部滚动、氛围保护壳、偏移变量） | 🐞 修复·布局 |
| 34 | `596b0c0` | 分栏下右栏列表一律内部滚动（不再只在开启氛围背景时才生效） | 🐞 修复·布局 |
| 35 | `988223e` | 补齐 768–959px 段的层叠顺序（header / 底栏抬到左栏之上） | 🐞 修复·布局 |
| 36 | `bc09131` | 新增断点覆盖审计工具（npm run audit:breakpoints），并用它抓到并修掉 #loading 缺 z-index | 🧪 工具·修复 |
| 37 | `b552452` | 落实低风险优化 1–6（观察器过滤 / 布局签名早退 / rAF 合并 / 查询缓存），并纳入 GPT 评估文件 | 🚀 性能·重构 |
| 38 | `cee58ef` | 修 bug2（半宽屏露出手势箭头）、bug1.1（手机档切歌横向抖动）、bug1.3（手机沉浸页暗色未适配） | 🐞 修复·布局 |
| 39 | `2768d2e` | 回退 1.3.5.25 带来的"锁死页面滚动"回归（bug1.2 与 bug1.1 的真因），恢复 v1.3.3 既定行为 | 🐞 修复·布局 |
| 40 | `f1148a1` | 去掉手机沉浸页的"半透明暗色覆盖"（1.3.5.38 自伤），改用上游同源最小兜底；封面容器裁剪修切歌抖动 | 🐞 修复·布局 |
| 41 | `39ec50f` | 暗色沉浸页顶栏与状态栏改实色深底；给"整页横向位移"加两道保险（切歌抖动第 3 版尝试） | 🐞 修复·布局 |
| 42 | `9b00fcb` | 撤销自造暗色覆盖与抖动保险，沉浸页回到上游原方案（顶栏/底栏透明、上下底色由封面决定） | ♻️ 回退·外观 |
| 43 | `c32cc8f` | 暗色下给沉浸页顶栏叠深色遮罩（第 1 版，无条件；后被 1.3.5.44 改为条件压暗） | 🐞 修复·外观 |
| 44 | `65bc0ec` | 暗色沉浸页顶栏改为"仅当封面顶部为浅色时压暗"（复用上游 ambient-top-light-bg）；并把"以上游为对照基准"写成约定 | 🐞 修复·外观 |
> 共 **44** 条改动，其中布局相关 **29** 条。

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

## 阶段 7 · 回归定位与布局重构（1.3.5.25 – 1.3.5.44）

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

### 1.3.5.33-Dev　66d5a99　　🐞 修复·布局

**概述**：补齐 768–959px 分栏带缺失的显示规则（列表内部滚动、氛围保护壳、偏移变量）

**用户需求**：请你系统复核 1.3.5 涉及显示逻辑的判断，找出遗漏或未测试到的问题。

**改造思路**：建立「关注点 × 断点」覆盖矩阵（脚本只扫 CSS、并按大括号深度判定每条规则所属的 `@media` 段），发现 **768–959px** 段缺三样（与 1.3.5.32 同源）：① 右栏列表没有内部滚动（`max-height`/`overflow-y`）→ 变成整页滚动、列表顶部会滑到 sticky header 下；② 缺 `--split-list-top` 定义；③ 歌曲卡片与工具栏缺氛围态「实体化保护壳」（0.85 白底 + 25px 模糊 + 暗色变体）→ 直接透在模糊幕布上。已按 ≥960 段的写法在 768–959 段补齐，并复跑矩阵确认 6/6 关注点两端一致。

> `2026-09-19` ｜ `fix(ui): complete the 768-959 split band (list scrolling, ambient protection shell, offset var)` ｜ 文件：`static/index.html`

### 1.3.5.34-Dev　596b0c0　　🐞 修复·布局

**概述**：分栏下右栏列表一律内部滚动（不再只在开启氛围背景时才生效）

**用户需求**：系统复核 1.3.5 的显示逻辑，找出遗漏或未测试到的问题。

**改造思路**：复核中发现「右栏列表内部滚动（`max-height` / `overflow-y`）」这条规则**只写在氛围态选择器里** → 用户若关掉氛围背景（偏好设置），分栏时会退化成整页滚动、列表顶部滑到 sticky header 下面。改为**按分栏统一生效**（`body.split-view-active .playlist / .playlist-grid`），与氛围开关无关。

> `2026-09-19` ｜ `fix(ui): give the right-column list internal scrolling in split mode regardless of ambient` ｜ 文件：`static/index.html`

### 1.3.5.35-Dev　988223e　　🐞 修复·布局

**概述**：补齐 768–959px 段的层叠顺序（header / 底栏抬到左栏之上）

**用户需求**：在 3/5 – 3/4 宽度（即 768–959px 分栏带）下，左上角设置菜单与 logo 不显示，并且歌词区压住了一部分播放进度条。

**改造思路**：做**层叠顺序审计**（逐元素比对两段的 z-index 值）后发现：≥960 段有一整块「分层防遮挡」规则，768–959 段完全没有 —— 其中 header 的 z-index:260 与底栏的 z-index:200 决定谁压谁。缺了它们之后：header 只有全局 150、底栏只有全局 170，**都低于左栏 .full-player 的 190** → ① 播放器盖住 header → **左上 logo / 设置菜单看不见**；② 歌词（在 .full-player 内）盖住底栏 → **进度条被压住**。已把该块（透明结界 + header 260 + 下拉 300 + 工具栏 220/210 + 底栏 200）按 ≥960 的写法镜像到 768–959 段。

> `2026-09-19` ｜ `fix(ui): mirror 960+ layering rules into 768-959 (header and player-bar above the player column)` ｜ 文件：`static/index.html`

### 1.3.5.36-Dev　bc09131　　🧪 工具·修复

**概述**：新增断点覆盖审计工具（npm run audit:breakpoints），并用它抓到并修掉 #loading 缺 z-index

**用户需求**：把这次连续定位同类问题所用的审计方法，固化成可复用的工具。

**改造思路**：
- 新建 `scripts/audit-breakpoints.mjs`：① 只扫 CSS、按大括号深度判定每条规则所属的 `@media` 段；② 逐条检查「关注点 × 分栏带」（`768–959` 与 `≥960` 必须成对）；③ 逐元素比对两段的 z-index（含防误报处理：多选择器需全部命中、过滤 `::before/::after`、目标须是选择器末尾元素）；④ `--strict` 有发现时退出码 1，可作为提交前门禁。
- 用它复扫时立刻抓到一处**真实漏项**：`body.split-view-active #loading { position: relative; z-index: 145 }` 只在 ≥960 段 → 在 768–959 段里「正在加载 / 登录失效 / 重新登录」提示会被氛围遮罩（135）盖住。已按 ≥960 的写法补进该段。
- 工具自检：在旧版本 `ea7c892` 上运行，能准确报出 1.3.5.35 修掉的那批缺失（header 260 / 工具栏 220 / 搜索框 210 / select-options 300）；在当前版本上 0 项问题、`--strict` 退出码 0。
- `package.json` 增加 `audit:breakpoints`；`AGENT.md` 增加**约定 13**（改 CSS 后先跑断点审计）。

> `2026-09-19` ｜ `feat(tooling): add breakpoint coverage audit (npm run audit:breakpoints); fix #loading z-index gap in 768-959` ｜ 文件：`scripts/audit-breakpoints.mjs`、`static/index.html`、`package.json`、`AGENT.md`

### 1.3.5.37-Dev　b552452　　🚀 性能·重构

**概述**：落实低风险优化 1–6（观察器过滤 / 布局签名早退 / rAF 合并 / 查询缓存），并纳入 GPT 评估文件

**用户需求**：感觉 1.3.5 里"闲杂判断很多"，担心影响性能；要求先与 GPT 的评估结论对比，再按其第 4 节 **1–6** 实施（第 7 项暂不做）。

**改造思路**（六项全部**零行为变化**）：
1. `bodyClassObserver` 加 `attributeFilter: ['class']` —— 回调本来就只处理 class，此前 `data-layout` / `style` 等任何属性写入都会白跑一遍；
2. `dataset.layout` 仅在**变化时**写（它只服务诊断）；
3. `ResizeObserver` 回调 **rAF 合并**（一帧最多同步一次；原 `_syncingLayout` 只防同步重入）；
4. `syncLayout` 用**布局签名**早退：签名 = 模式 + `split-view-active` 实际状态 + 5 个关键控件的父节点 + `search-expand`；签名一致才早退，**自检发现问题即作废签名**，故自愈能力保留；
5. `moveToolbarControls` 加控件引用缓存（`isConnected` 失效自动重查），**不做 isSplit 早退**（它还要同步搜索模式/placeholder 并兜底自愈）；
6. `online.js` 滚动翻页：把 `scrollHeight` 等布局读取移出滚动回调，并 rAF 合并。

**自测发现（重要）**：第 4 项初版签名**没有包含 `split-view-active` 本身** → 外部把 class 清掉时会被早退、**丢失自愈** ✗；桩测试场景⑤抓到后已把 class 实际状态纳入签名，最终 5/5 通过（状态未变早退 / 控件被挪走自愈 / 外部清 class 纠正 / 自检报错连续重试 / 首次同步正常）。

**评估文件入库**：`docs/GPT－iWPS-S-1.3.5-优化方案的评估.md`（GPT 版评估 + 我的逐条核对）。双方结论 9 项中 6 项一致；GPT 纠正了我 3 处（`syncLayout` 早退不能只比 mode、`moveToolbarControls` 提早退不安全、**滚动监听其实早已是 passive**——我上次的"非 passive"是 grep 单行匹配导致的误报）。

**未做**：第 7 项「卡片 `backdrop-filter` A/B」—— 双方都认为收益最大但需真机对比观感，单独做。

> `2026-09-19` ｜ `perf(ui): implement low-risk layout/scroll optimizations 1-6 (observer filter, signature early-return, rAF coalescing, query cache); add GPT evaluation doc` ｜ 文件：`static/index.html`、`static/online.js`、`docs/GPT－iWPS-S-1.3.5-优化方案的评估.md`

---

## 待优化 / 待办登记（已登记，暂不实施）

> 登记用途：先记录、不实施；实施时按格式新增上方条目。

### ① 氛围卡片 `backdrop-filter` A/B（性能，收益最大）
- **内容**：把 `.song-item` / `.pl-card-b` 上的 `backdrop-filter: blur(25px)` 改为半透明纯色底（背景已被 `.fp-ambient-bg` 模糊过，观感接近）。
- **收益**：去掉"每张卡片实时重算背景模糊"，是滚动/切换时合成开销的大头（GPT 评估与我的复核都排第一）。
- **前置**：需真机 A/B 对比观感（临时关掉模糊出一版构建）。
- **状态**：暂不动（2026-09-19 登记）。

### ② 把分栏相关元素补齐登记进审计工具
- **内容**：`scripts/audit-breakpoints.mjs` 的 `CONCERNS` / `Z_TARGETS` 补入 `.up-arrow`、`.drawer-handle`、`.mini-cover` 等"仅手机版手势/沉浸元素"。
- **缘起**：bug「半宽屏显示手机版上下歌词箭头」正是因为这两条隐藏规则只写在 ≥960 段，而工具清单里没有它们 → 漏检（见下方 1.2 分析）。
- **状态**：登记待办。

### ③ `layoutSelfCheck` 异常红条的展示策略
- **内容**：把常驻红条改为"持续不一致 >2 秒才出现、10 秒后自动隐藏 + 同时 `console.warn`"。
- **缘起**：GPT 评估指出用户设备上常驻红条体验差；但当前无控制台时它是唯一可见信号，需权衡。
- **状态**：登记待办。

### ④ `player.js` 中 `isSplitHome` 的重复判断清理
- **内容**：`document.body.classList.contains('split-view-active')` 被重复写了两行（统一判据时留下的），逻辑等价，仅清理。
- **状态**：登记待办（可与其他改动一起做）。

### 1.3.5.38-Dev　cee58ef　　🐞 修复·布局

**概述**：修 bug2（半宽屏露出手势箭头）、bug1.1（手机档切歌横向抖动）、bug1.3（手机沉浸页暗色未适配）

**用户需求**：修复这三个问题；**手机界面显示效果以上游为主**，改动要便于后续跟进上游；bug1.2 继续分析。

**改造思路**（全部为**追加式最小改动，不改上游规则本体**）：
1. **bug2（半宽屏露出手机手势箭头）**：上游把 `body.split-view-active .drawer-handle{display:none}` 与 `.up-arrow{visibility:hidden}` **只写在 `@media (min-width: 960px)`** → 768–959 无人隐藏。按上游写法原样补进 768–959 段；并把这两个元素登记进 `scripts/audit-breakpoints.mjs` 的 `CONCERNS`（工具此前漏检，正因为它们不在清单里）。
2. **bug1.1（手机档切歌左右抖动）**：手机档是 ≥600 的 480px 居中框，原为 `body{overflow-x:visible}`；切歌时封面呼吸动画 `scale(1.03)` + 随机播放 `scrollIntoView({behavior:'smooth'})` 会短暂撑出横向溢出 → 整框左右抖。改为 `overflow-x: clip`（**不创建滚动容器**，不影响 sticky/fixed，也不像 `hidden` 那样改变滚动模型），并给 `.fp-cover-wrapper` 同样裁剪。原版同样存在（用户已确认），属 pre-existing。
3. **bug1.3（手机沉浸页暗色未适配）**：上游暗色沉浸规则**全部带 `body.ambient-active` 前置条件** → 未开启「氛围背景」或封面取色缺失时，暗色模式下沉浸页仍是亮色。追加一组**不依赖 ambient** 的 `:root:not([data-theme="light"]) body.player-open:not(.split-view-active)` 兜底（沉浸层/顶栏/歌词文字/画报压暗），保留封面画报只做压暗。

> `2026-09-19` ｜ `fix(ui): hide mobile gesture arrows in 768-959, clip phone-frame horizontal overflow, dark fallback for mobile immersive page` ｜ 文件：`static/index.html`、`scripts/audit-breakpoints.mjs`

### ⑤ bug1.2 手机沉浸页顶部丢失（分析中，待修）
- **现象**：进入歌词页后，顶部左侧菜单/logo、右侧设备切换按钮不显示；**关闭沉浸后也不恢复**，且列表顶部一段同样看不到（间歇性，有时正常）。
- **已排除**：没有规则隐藏这些元素（两版都没有）；`scrollToCurrent()` 用 `translateY` 不滚动页面；`applyThemeMode` 不会因 `data-theme` 已存在而跳过；z-index 上 header(150) 高于 full-player(140)。
- **当前结论（证据链）**：`.header` 是 `position: sticky; top:0`；而进入手机沉浸页时 `player.js` 会 `document.body.style.overflow='hidden'`（上游行为，我们的 `syncLayout` 也会在 class 变化时补设一次）。**sticky 的吸附参照是最近的滚动容器** → body 一旦 `overflow:hidden` 而实际滚动发生在 html/页面层，header 会**随内容一起滚走**；而随机播放会触发 `playlist.js:575` 的 `scrollIntoView({behavior:'smooth', block:'center'})` 把页面滚到列表中段 → 「列表大幅滚动」正是触发条件（与 bug1.1 同一触发源）→ 表现为间歇性顶部丢失、关闭沉浸也停在滚动位置。
- **拟修法（待确认）**：① 移除 `syncLayout` 里对 `body.style.overflow` 的副写；② 手机进入/退出沉浸页时保存并恢复 `window.scrollY`（或在打开时改锁页面为 `position: fixed` + 还原滚动）；③ 关闭沉浸时把滚动位置复位到进入前。
- **状态**：✅ **已在 1.3.5.39 修复**（根因＝1.3.5.25 带回了被 `7c8cc72` 回退的"锁死页面滚动"实验；已整段回退到 v1.3.3 行为）。

### 1.3.5.39-Dev　2768d2e　　🐞 修复·布局

**概述**：回退 1.3.5.25 带来的"锁死页面滚动"回归（bug1.2 与 bug1.1 的真因），恢复 v1.3.3 既定行为

**用户需求**：bug1.2（手机歌词页顶部丢失）在原版正常 → 判定为我们引入，要求定位并修复。

**定位过程**：拿**真正的上个发布版 `v1.3.3`** 做 diff（而不是 1.3.5 前的提交），立刻命中三处：

```
-  body { overflow: visible !important; }                      ← v1.3.3（正常）
+  body.player-open { overflow: hidden; }                       ← 1.3.5.25 引入
+  body.split-view-active:not(.player-open) { overflow: visible; }
-  html { overflow-y: scroll; scrollbar-gutter: stable; }        ← v1.3.3
+  html { overflow-y: auto; scrollbar-gutter: auto; }            ← 1.3.5.25 引入
```

并且 `git log` 证明 **`7c8cc72`（2026-08-29）就是 `Revert "fix(scroll): unify list scrolling into #scroll-wrapper; kill page-level scrollbar entirely"`** —— 团队当初**故意**把"锁死页面滚动"那套实验回退掉，并在源码里留下「终极护盾：用最高权限强制可见，彻底废掉底层 JS 强制锁屏的命令，根除 iOS 乱跳」。**1.3.5.25 的修复等于把被回退的实验又带了回来** ✗。

**两个 bug 同一根因**：
- **bug1.2**：`body.player-open{overflow:hidden}` 让 body 成为滚动容器 → **sticky header 的吸附参照失效** → 随机播放触发 `playlist.js:575` 的 `scrollIntoView({behavior:'smooth'})` 把页面滚到列表中段后，顶部（菜单/logo/设备）随内容一起被滚走，关闭沉浸也停在滚动位置、列表顶部一段看不到 → 表现为间歇性"顶部不显示"；
- **bug1.1**：`scrollbar-gutter: auto` 使滚动条出现/消失时内容宽度变化 → 480px 居中框左右抖（随机播放大幅滚动时最明显）。

**修复（整段回退到 v1.3.3 既定行为）**：① 恢复 `body { overflow: visible !important; }` 护盾；② 恢复 `html { overflow-y: scroll; scrollbar-gutter: stable; }`；③ 回退 1.3.5.38 里我给手机档加的 `overflow-x: clip`（真因已在①②解决，保持与上游一致）；④ 移除 `syncLayout` 里对 `body.style.overflow` 的副写（护盾 `!important` 下本无效果，去掉以免与上游行为混淆）。核对：三项与 `v1.3.3` 逐条一致 ✓。

> `2026-09-19` ｜ `fix(ui): revert the 1.3.5.25 scroll-lock regression (restore body overflow shield and stable scrollbar gutter)` ｜ 文件：`static/index.html`

### 1.3.5.40-Dev　f1148a1　　🐞 修复·布局

**概述**：去掉手机沉浸页的"半透明暗色覆盖"（1.3.5.38 自伤），改用上游同源最小兜底；封面容器裁剪修切歌抖动

**用户需求**：① 关闭沉浸后，暗色下歌词/封面变透明、底部透出歌曲列表；② 切歌抖动仍在；③ 暗色沉浸页观感不如原版浅色协调。

**根因与修法**：
1. **①③ 是 1.3.5.38 那组兜底自己造成的**：当时给 `.full-player`/`.player-bar` 写了**半透明**深色底 `rgba(17,24,39,0.35)`，还给 `.header` 半透明底、强行把封面压暗（`brightness(0.85)`）、强制白字 —— 结果沉浸页把**下面一层（歌曲列表）透出来**，且破坏了上游"封面取色"的沉浸体系（观感不协调）。
   → **删除整组覆盖**，只留一条与上游同源的最小兜底：暗色下给 `#fp-ambient-bg` **实底** `#0b1220`（防封面未就绪时透出下层）；其余一律交给上游既有的 `prefers-color-scheme: dark` / `:root[data-theme="dark"]` 规则处理。
2. **② 切歌抖动的真正溢出源**：`.fp-cover { animation: cover-breath }` 的 `transform: scale(1.03)`，在 `.fp-cover-wrapper`（flex、未裁剪）里放大后，于手机档 480px 居中框内短暂撑出**横向溢出**；而 v1.3.3 的护盾 `body{overflow:visible!important}` 不会拦它 → 整框左右抖（随机播放大幅滚动时最明显，**原版同样存在**）。
   → 只给 `.fp-cover-wrapper` 加 `overflow-x: clip; overflow-y: visible`：裁掉这一层的横向溢出，纵向阴影与布局不受影响，**不改变页面滚动模型**（1.3.5.38 那次误加在 `body` 上，已随 1.3.5.39 一并回退）。

> 教训：给沉浸页加"兜底色"时必须用**实色**；半透明会让下层内容穿帮。

> `2026-09-19` ｜ `fix(ui): drop translucent dark override on mobile immersive page; clip cover-breath overflow to stop horizontal jitter` ｜ 文件：`static/index.html`

### 1.3.5.41-Dev　39ec50f　　🐞 修复·布局

**概述**：暗色沉浸页顶栏与状态栏改实色深底；给"整页横向位移"加两道保险（切歌抖动第 3 版尝试）

**用户需求**：① 关闭沉浸后透明问题已修复；② 切歌抖动依旧；③ 暗色沉浸页顶栏整条是白底，观感割裂。

**③ 暗色顶栏发白（已修，两处根因）**：
- 上游沉浸页顶栏取**封面主色** `body.ambient-active.player-open .header { background: var(--top-color) }` → 暗色下遇到亮封面就是一条白底；
- 更上面那条**状态栏色**同样来自封面：封面 onload 里 `metaThemeEl.content = topColor.rgbString`。
→ 暗色下分别改为实色深底 `#111827`（顶栏 CSS）与深色 meta（JS），其余仍交回上游。

**② 切歌抖动（第 3 版尝试）**：逐一排查并**排除**了三个假设——封面呼吸动画（已裁剪）、滚动条槽位（`scrollbar-gutter: stable` 已恢复）、播放条滚动标题跑马灯（`.np-text-group` / `.now-playing-title` 本身已有 `overflow: hidden`）。本轮改为**从机制上杜绝"整页横向位移"**：
- `html { overflow-x: hidden }`（手机档是 480px 居中框，页面横向滚动在本插件里没有用途）；
- `.playlist { overflow-x: clip }`（`scrollIntoView` 默认 `inline: nearest`，会连带横向滚动 → 从源头去掉列表的横向溢出）。
若仍存在，需用户区分：是**整页**位移（连底部播放条内容一起动）还是**仅列表**位移、列表短时是否也抖、是一次性跳变还是持续抖动 —— 三条中任一即可定位。

> `2026-09-19` ｜ `fix(ui): dark immersive header and status bar use solid dark; forbid page-level horizontal displacement (jitter guards)` ｜ 文件：`static/index.html`

### 1.3.5.42-Dev　9b00fcb　　♻️ 回退·外观

**概述**：撤销自造暗色覆盖与抖动保险，沉浸页回到上游原方案（顶栏/底栏透明、上下底色由封面决定）

**用户需求**：① 说明"抖动"的实测环境是 **Pad 分屏各占 50%** —— 此时手机界面不是铺满、左右各留一段空白，"抖动"指的就是这两段空白；真机手机端铺满是好的。② 暗色沉浸页**沿用上游原方案**：原版顶栏与底部控制区都是**透明**的、上下底色由歌曲封面决定，这个方案更好。

**结论与处理**：
- **① 抖动不是溢出 bug**：Pad 分屏 50% 时窗口约 640px（**≥600**），命中上游「≥600px 即 480px 居中手机框」规则：
  `@media (min-width: 600px) { html{background:#e5e7eb} body{width:480px!important; margin:0 auto!important} }`
  → 左右两段灰底即用户所指；真机手机端窗口 <600px 时铺满、无此现象。故撤销 1.3.5.41 的两道"横向位移保险"（`html{overflow-x:hidden}` / `.playlist{overflow-x:clip}`）与 1.3.5.40 的封面容器裁剪。
- **② 沉浸页回到上游原方案**：撤销 1.3.5.38 / 40 / 41 三版「自造暗色覆盖」（半透明深色底 → 改实底 → 顶栏实底 + 改状态栏色），恢复上游"顶栏/底栏透明 + 封面取色（`--top-color` / `--bottom-color`）+ 状态栏用封面主色"。核对：与 `v1.3.3` 的沉浸页规则一致。

**经验**：1.3 这条"暗色适配"的最终结论是**不要自造底色** —— 上游"透明 + 封面取色"本身是协调的，自加实底只会割裂。

> `2026-09-19` ｜ `revert(ui): restore upstream immersive colour scheme (transparent header/bar driven by cover); drop self-made dark overrides and jitter guards` ｜ 文件：`static/index.html`

### 1.3.5.43-Dev　c32cc8f　　🐞 修复·外观

**概述**：暗色下给沉浸页顶栏叠一层深色遮罩，让"顶栏亮条"与已压暗的背景一致（**第 1 版：无条件**，后被 1.3.5.44 改为条件压暗）。

**用户需求**：暗色模式下 logo 栏好像不是透明。

**做法与复盘**：把 `var(--top-color)`（封面主色，实色）上叠 `rgba(17,24,39,0.6)` 遮罩。核对上游后（见 1.3.5.44）发现两点：① 上游顶栏规则与本条改动的**目标**一致（都是"跟随封面"），② 但**无条件**压暗会连深色封面一起压暗，偏离上游行为 → 故 1.3.5.44 收敛为"仅封面顶部为浅色时才压暗"。

> `2026-09-19` ｜ `fix(ui): dim the immersive header in dark mode (cover hue + dark overlay) to match the dimmed ambient backdrop` ｜ 文件：`static/index.html`

### 1.3.5.44-Dev　65bc0ec　　🐞 修复·外观

**概述**：暗色沉浸页顶栏改为"仅当封面顶部为浅色时压暗"（复用上游 `ambient-top-light-bg` 判据）；并把"以上游为对照基准"固化为约定。

**用户需求**：① 纠正对照基准 —— 应对比**上游**而不是我们自己的 `v1.3.3`；② 暗色下沉浸页 logo 栏"好像不是透明"。

**上游核对（基准修正后）**：`git show upstream/main:static/index.html`（上游 main = v1.3.5，`21b4615`）逐条对比：
- 沉浸页顶栏规则与上游**逐字一致**：`background: var(--top-color, var(--bg-color)) !important` —— 顶栏底色 = **封面顶部主色**（实色），这正是"看起来透明/跟随封面"的来源；
- 上游暗色块只压暗**画报层**与 **`.full-player` / `.player-bar`**，**没有压暗顶栏** → "顶栏亮、背景暗"是**上游自身的缺口**，不是我们引入的。

**修法（上游风格、最小改动）**：仅当封面顶部为浅色时（复用上游已有的 `ambient-top-light-bg` 类）给顶栏叠深色遮罩 —— 保留封面色相、与背景同步压暗，深色封面完全不受影响。

**顺带用上游基准复核了 1.2/1.1 的结论**：上游**有** `body { overflow: visible !important }`、**没有** `body.player-open { overflow: hidden }`、使用 `scrollbar-gutter: stable` —— 与我们回退后的状态**完全一致** ✓，即 1.2/1.1 的修复正是"回到上游行为"，1.3.5.25 那次才是偏离。

**约定固化**：`AGENT.md` 新增 **约定 14** —— 判断"是不是我们引入的 / 原版行为"时基准是**上游仓库**（`upstream` remote；`git show upstream/main:<路径>`）；**不要拿我们自己的历史 tag 当原版基准**（分栏/宽屏等我们独有功能除外）。

> `2026-09-19` ｜ `fix(ui): dim immersive header in dark only when the cover top is light (upstream-idiomatic); document upstream as the comparison baseline` ｜ 文件：`static/index.html`、`AGENT.md`
