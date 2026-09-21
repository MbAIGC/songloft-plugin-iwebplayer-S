# iWP-S 1.3.6 Dev 记录

> **本文件约定**：同一大版本（`1.3.6`）内的**所有改动都记在这里**。每条用三级标题 `### <构建号>-Dev　<提交短哈希>　　<类型标签>`，
> 下面依次 `**概述**：` / `**用户需求**：` / `**改造思路**：`，末行引用式元信息（日期 ｜ 提交 ｜ 文件）。
> 类型标签：`⚙️ 功能` · `✅ 布局` · `🎨 外观` · `🐞 修复` · `🚀 性能·构建` · `🏗 重构` · `🧪 工具` · `♻️ 回退` · `📄 文档`。
> 1.3.5 及更早见 `iWP-S-1.3.5-Dev-记录.md`；上游跟进评估见 `IWP-1.3.5-1.3.6上游跟进评估.md`。

## 速查索引

| 构建 | 提交 | 概述 | 类型 |
| :--: | :--: | --- | --- |
| 1 | `47920a3` | 跟进上游 v1.3.6 的 A（图标重构）+ B（手机端头部快捷图标），base 升到 1.3.6-dev | ⚙️ 功能·跟进上游 |
| 2 | `d59acaf` | 同步所有版本号引用到 1.3.6-dev（修 APK 版本一致性门禁） | 🚀 构建 |
| 3 | `8a2086d` | 跟进上游 v1.3.6-C1：智能跳转源歌单（仅非分栏） | ⚙️ 功能·跟进上游 |
| 4 | `54b6ece` | 跟进上游 v1.3.6-C3：我的歌单过滤 + 漏斗入口（仅非分栏） | ⚙️ 功能·跟进上游 |
| 5 | `7640b5f` | 半宽屏沉浸页封面/歌曲信息偏上 → 左栏主列垂直居中（仅 768–959） | 🐞 修复·布局 |
| 6 | `01b9674` | 半宽屏沉浸页「仍偏上」 → 居中时补上底部播放条占位的抵消（仅 768–959） | 🐞 修复·布局 |
| 7 | `625cc25` | 半宽屏沉浸页内容整体贴顶 → 给左栏补上「确定高度」（仅 768–959） | 🐞 修复·布局 |
| — | `76a06aa` | APK 界面陈旧 → 插件 URL 加「每进程一次」的缓存破除查询串（**仅 APK，未产生插件构建号**） | 🐞 修复·构建 |
| 8 | `ed9b83c` | 统一视口高度口径 `--vh100`（dvh + vh 回落），并把补偿改为按视口比例（A+B） | 🐞 修复·布局 |
| — | `2b0b22f` | 回退 Android「每次启动加缓存破除查询串」（真因是视口单位，不是 WebView 缓存；**仅 APK**） | ♻️ 回退 |
| 9 | `c76a4b2` | 分栏首页封面**下移 10%**（方案 ①，仅视觉位移，歌词行数不变） | 🎨 外观·布局 |
| 10 | `843cb11` | 首页封面位移 10% → **8%**；并给**半宽屏沉浸播放页**补上同样的 8% 下移 | 🎨 外观·布局 |
| 11 | `f1f27c3` | 半宽屏沉浸页位移改为**视口基准**（1.5% ≈36px，替代不可预测的 8%） | 🎨 外观·布局 |
| 12 | `c6b16f3` | 两处位移改为**仅 App 生效**（`window.Android` → `html.iwp-app`），网页端恢复原样 | 🐞 修复·外观 |
| 13 | `1dd2a31` | 修正沉浸页位移计算：改为 **8% 视口（192px）**（上一版 1.5%=36px 是反向错修） | 🐞 修复·外观 |
| 14 | `ed3f4ea` | 修 App 标记未生效（改三重判据 + DOMContentLoaded 补检），两条位移在 App 内恢复生效 | 🐞 修复·外观 |
| 15 | `30faf82` | 沉浸页位移临时移出媒体查询（排查用）+ App 判据增补（纯前端四重） | 🐞 修复·外观 |
| 16 | `56fb562` | 沉浸页位移**改回仅 768–959**（半宽屏下移正好；宽屏不得跟着下移）| 🐞 修复·外观 |
| 17 | `96760a6` | 加**临时诊断**（版本菜单显示视口/屏高/是否 App）；位移范围放宽为 **768–1119** | 🔍 诊断 |

> 共 **17** 条改动（另有 2 条仅影响 APK、不产生插件构建号）。

---

## 阶段 1 · 跟进上游 v1.3.6（A + B）

### 1.3.6.01-Dev　47920a3　　⚙️ 功能·跟进上游

**概述**：跟进上游 v1.3.6 的 A（SVG 图标重构）与 B（手机端头部快捷图标），并把 base 版本升到 `1.3.6-dev`

**用户需求**：上游发布 v1.3.6。按规范评估后决定：**A、B 要**；**B 只在手机端要，宽屏端没必要显示**（宽屏用工具栏的「本地/在线」来源开关，更简约、少一步操作）；**C（列表过滤 / 跳转源）暂不跟进**（作用尚未理解）。

**改造思路**：
- **A**：`static/icons.js` 新增 `SVG_ICONS.online`（原为内联"地球"图标）；`static/utils.js` 改为 `window.SVG_ICONS?.online || ''`。
- **B**：
  - `.header-controls` 内新增两个 `.header-icon-btn`（`#nav-online-btn` / `#nav-search-btn`），图标由 JS 注入（18px）；
  - 点击 = 进入 / 再点一次原路返回（用 `_preOnlinePlaylist` / `_preSearchPlaylist` 记忆来源歌单）；
  - `player.js` 的 `updateSearchUI()` 中切换 `.active` 高亮；`body.player-open` 时隐藏这两个图标；
  - 从歌单下拉中移除这两项（**仅非分栏**；分栏保留，避免宽屏丢失功能路径）。
- **与上游刻意不同的 3 处**（详见 `IWP-1.3.5-1.3.6上游跟进评估.md` 第七章）：
  1. 上游的 `#device-container{flex-shrink:1;min-width:75px;max-width:140px}` → **限定为 `body:not(.split-view-active)`**（我们的设备选择器在分栏下被搬进工具栏 `#tbs-device`，照搬会把最窄分栏顶宽）；
  2. 分栏下这两个图标不显示（它们位于 `.header-controls`，分栏下本就 `display:none`）—— **用户确认的取舍**；
  3. 不采用上游的 `?v1.3.6` 查询串（我们由构建期注入内容哈希）。
- **版本号**：按默认规范把 base 升到 `1.3.6-dev`（`plugin.json` 等，见下一条补记）。

> `2026-09-21` ｜ `feat(ui): follow upstream v1.3.6 A+B (svg icon refactor; mobile header quick icons) and bump base to 1.3.6-dev` ｜ 文件：`static/icons.js`、`static/utils.js`、`static/player.js`、`static/index.html`、`plugin.json`

### 1.3.6.02-Dev　d59acaf　　🚀 构建

**概述**：补齐所有版本号引用到 `1.3.6-dev`，修复 APK 工作流的版本一致性门禁

**用户需求**：（CI 反馈）APK 构建失败 —— 门禁报错：`❌ plugin.json 版本(1.3.6-dev) ≠ package.json(1.3.5-dev)`

**改造思路**：上一提交只改了 `plugin.json`，漏了 `package.json`（该门禁正是为防此事而设 ✓）。本次一次补齐：
`package.json`；`package-lock.json`（顶层 + `packages[""]` **共 2 处**）；`README.md`（badge + 两处 zip 文件名）；`DEV_RELEASE_NOTES.md`（标题 + 本次条目）；`AGENT.md`（版本表 + 变更历史）。
复核：仓库内除历史记录行外**无 `1.3.5-dev` 残留** ✓。并在 AGENT 版本表中补注"**APK 工作流有门禁会校验 `plugin.json` 与 `package.json` 一致**"，避免下次再漏。

> `2026-09-21` ｜ `chore(release): sync all version references to 1.3.6-dev (fix APK version-check gate)` ｜ 文件：`package.json`、`package-lock.json`、`README.md`、`AGENT.md`、`DEV_RELEASE_NOTES.md`

---

### 1.3.6.03-Dev　8a2086d　　⚙️ 功能·跟进上游

**概述**：跟进上游 v1.3.6-C1「智能跳转源歌单」（**仅非分栏生效**）

**用户需求**：跟进 C；**前提：不要影响宽屏/半宽屏的现有布局**。

**改造思路**：
- 在 `#menu-dropzone-row1` 内新增 `#jump-source-wrap`（`#setting-jump-source` 开关，图标从上游提取）；
- 开关绑定：状态存 `localStorage['iwebplayer.jump_source']`（默认关闭）→ `window.isJumpSourceEnabled`，开/关只改图标颜色 + 弹提示；
- **消费端**（`static/playlist.js`）：曲库搜索结果渲染时记录"真实源歌单名"到 `li.dataset.sourcePl`；点击播放时若 `currentPlaylist === '曲库搜索' && isJumpSourceEnabled && li.dataset.sourcePl` → 先 `switchPlaylistSilently(源歌单)`，按歌名在新列表里找索引再 `playSong(newIndex)`；
- **保护分栏（硬约束）**：消费逻辑前置 `!document.body.classList.contains('split-view-active')` ✓，并加 CSS `body.split-view-active #jump-source-wrap { display:none !important }`（该控件位于分栏下会被搬进 `.tbs-playlist` 窄列的 `#menu-dropzone-row1` 内）。

> `2026-09-21` ｜ `feat(ui): follow upstream v1.3.6-C1 (smart jump to source playlist), non-split only` ｜ 文件：`static/index.html`、`static/playlist.js`

### 1.3.6.04-Dev　54b6ece　　⚙️ 功能·跟进上游

**概述**：跟进上游 v1.3.6-C3「我的歌单过滤 + 漏斗入口」（**仅非分栏生效**）

**用户需求**：同上（跟进 C，且不得影响宽屏/半宽屏布局）。

**改造思路**：
- UI：`.filter-inline-wrap` 样式（含 `.glow` 红框提醒、`slideInLeft` 动画）；`#grid-filter-wrap`（"过滤歌单"输入框 + 清空）放进 `.toolbar-main-box`（歌单下拉之后）；`#filter-action-wrap`（漏斗 `#setting-filter-list`）放进 `#menu-dropzone-row1`；
- 行为：关键词持久化到 `localStorage['iwebplayer.grid_filter']`；在「我的歌单」点漏斗 = 打开/收起过滤框；切回「我的歌单」且有过滤词时自动展开并**闪一下红框**（800ms）；`renderPlaylist()` 里对基础歌单列表按关键词过滤；
- **保护分栏（硬约束）**：三处全部限定非分栏 —— CSS `body.split-view-active #filter-action-wrap / #grid-filter-wrap { display:none }`；`player.js` 的显示/隐藏逻辑整体包在 `!split-view-active` 内；`playlist.js` 的过滤条件带 `!split-view-active` → **分栏下既不显示、也不过滤，布局与内容完全不变** ✓。

**过程中的自纠**：C3 的漏斗 markup 我从上游"启发式截取"时**过度截取**，把上游的 `#global-menu-1-container` 整块重复插入（产生重复 id + 打乱嵌套）✗。通过 id 唯一性检查 + div 平衡检查发现并精确删除（296/296 平衡 ✓）。教训：从上游提取 markup 片段要用**边界明确的锚点**（跳到下一个已知元素），不要用启发式条件。

> `2026-09-21` ｜ `feat(ui): follow upstream v1.3.6-C3 (my-playlists grid filter + funnel entry), non-split only; fix duplicated menu block` ｜ 文件：`static/index.html`、`static/player.js`、`static/playlist.js`

### 1.3.6.05-Dev　7640b5f　　🐞 修复·布局

**概述**：半宽屏（768–959）沉浸播放页的封面与歌曲信息"偏上" —— 把左栏主列垂直居中（仅该段生效）

**用户需求**：半宽屏下，歌词播放界面的 cover 和歌曲信息位置偏上了一些。

**排查（结论：不是"缺规则"）**：先用**大括号深度**精确判定断点 —— 沉浸态左栏那整套规则
（`body.split-view-active.player-open` 的 `.desktop-player-main` / `.fp-cover-wrapper` / `.fp-lyrics-wrapper` / `.fp-cover`）
其实都在 `@media (min-width: 768px)` 内、**两段共用** ✓，所以不属于"≥960 有、768–959 缺"那一类。
真因是**视口相对尺寸 + 顶部对齐**：
- `.fp-cover { width: min(100%, 34vw, 440px); max-height: min(48vh, 440px) }` → 半宽屏只有 **261–326px**（宽屏 326–440+），整组变矮；
- `.desktop-player-main { justify-content: flex-start; padding-top: clamp(8px, 2vh, 24px) }` → 仍贴着顶部排列；
→ 矮了一截的内容仍顶在最上面，视觉上就是"偏上"；宽屏因封面更大、基本填满高度，所以看不出问题（与用户"宽屏正常"一致）。

**修法**：只加一条、只作用于 **768–959**：
```css
@media (min-width: 768px) and (max-width: 959px) {
  body.split-view-active.player-open .desktop-player-main { justify-content: center; }
}
```
宽屏（≥960）与手机档完全不受影响 ✓（新规则的断点已用脚本复核 = `(min-width:768px) and (max-width:959px)` ✓）。

**备注**：若想要的是"只往下挪一点"而非居中，把 `center` 换成 `flex-start` + 一个 `padding-top` 即可（一行改动）。

> `2026-09-21` ｜ `fix(ui): vertically center the immersive player column in the 768-959 band (cover/info sat too high)` ｜ 文件：`static/index.html`

### 1.3.6.06-Dev　01b9674　　🐞 修复·布局

**概述**：半宽屏沉浸页封面/歌曲信息「仍偏上」 —— 1.3.6.05 只居中、未抵消底部播放条占位，本次补上

**用户需求**：1.3.6.05 之后「还是会比较偏上」。

**补充分析（为什么 1.3.6.05 不够）**：左栏 `.full-player` 的盒子是 `top: 0; bottom: 130px; padding: 56px … 28px` →
它的**内容盒中心比屏幕中心高约 50–60px** ✗（底部要让出播放条 130px）→ 单做 `justify-content: center` 后整组仍偏上 ✓；
另外若父容器没把该列拉伸到满高，`justify-content` 也没有剩余空间可分配（因此显式 `align-self: stretch` 兜底）。

**修法**（仍**只作用于 768–959**，宽屏/手机档不受影响）：
```css
body.split-view-active.player-open .desktop-player-main {
  align-self: stretch !important;                        /* 占满左栏高度 → 才有剩余空间可分配 */
  justify-content: center !important;                    /* 垂直居中 */
  padding-top: var(--player-height, 118px) !important;   /* 抵消底部播放条占位，把整组推到屏幕视觉中心 */
}
```
**可调**：想更往下 → 加大该 padding（如 `calc(var(--player-height) + 40px)`）；想更往上 → 减小 ✓。

> `2026-09-21` ｜ `fix(ui): compensate the bottom player-bar inset when centering the immersive cover column (768-959)` ｜ 文件：`static/index.html`

### 1.3.6.07-Dev　625cc25　　🐞 修复·布局

**概述**：半宽屏沉浸页内容整体贴顶（1.3.6.05/06 的居中为何无效）—— 根因是左栏高度塌成内容高，补上确定高度

**用户需求**：1.3.6.06 之后「还是会比较偏上」，并提供实测截图。

**截图像素分析 + 规则推导**：截图 2358×2400（近正方 = 分屏窗口），可见「歌曲信息 / 封面 / 歌词」全部集中在**上部约 60%**，下方一大片空白 —— 这不是「居中没生效」，而是**左栏压根没有可分配的高度**：
- 沉浸态左栏 `.full-player` 在 **≥960** 有确定高度（`height: calc(100vh - var(--player-height) - 56px - env(...))` ✓）；
- **768–959 段没有等价规则** ✗ → 该段只有 `top: 0; bottom: 130px; height: auto !important` 那套（min-768）→ 实测高度塌成**内容高度** →
  于是 `align-items: stretch` 撑不出高度、`justify-content: center` **没有剩余空间可分配** → 一切贴顶。
  （这正好解释了 1.3.6.05/06 两次加"居中"都没效果 ✓。）

**修法**（仍**只作用于 768–959**）：
```css
body.split-view-active.player-open .full-player {
  top: 0 !important;
  bottom: auto !important;
  height: calc(100vh - var(--player-height, 118px)) !important;   /* 底部正好抵住播放条 */
}
/* 其余保留：align-self: stretch + justify-content: center + padding-top 抵消底部占位 */
```
宽屏（≥960）与手机档不受影响 ✓（新规则断点经脚本复核 = `(min-width:768px) and (max-width:959px)` ✓）。

**可调**：位置想更下就加大那条 `padding-top`，想更上就减小 ✓。

> `2026-09-21` ｜ `fix(ui): give the immersive full-player a definite height in the 768-959 band (content hugged the top)` ｜ 文件：`static/index.html`

### （仅 APK，无插件构建号）76a06aa　　🐞 修复·构建（Android）

**概述**：APK 里界面陈旧 —— 给插件 URL 加「每进程一次」的缓存破除查询串；并完整查清 APK 的加载链路

**用户需求**：浏览器里已是新界面，但 APK 里感觉没变化（重装 APK 亦然）；且「之前没更新版本时，APK 每次重开都显示新界面」。

**排查结论（三条链逐一查证）**：
1. **APK 不打包插件** ✓：`android/app/src/main/assets/` 只有 `settings.html`；`MainActivity` 是**实时加载**
   `base + "api/v1/jsplugin/iwebplayer-s/static/index.html"`（宿主上的插件）→ APK 与浏览器读的是**同一份宿主插件**；
2. **manifest / 更新链健康** ✓：仓库 `manifest.json` = `1.3.6.07-dev`，`download_url` 指向**确实存在**的资产
   `releases/download/dev-1.3.6/iwebplayer-s-v1.3.6.07-dev.jsplugin.zip`；CI 每次「提交并推送 manifest.json」均成功（无被拒记录）；
3. **WebView 缓存**：虽已 `setCacheMode(LOAD_NO_CACHE)`，但被标 `immutable` 的子资源在部分 WebView 版本上仍可能被复用 ✗
   → 这是唯一无法远程排除的变量。

**修法（只动 Android 侧，任何布局都不受影响）**：给插件 URL 加查询串 `?v=<进程启动时间>`（同进程内稳定、重开 App 变化）→
主文档每次启动都是新 URL，WebView 必定重新抓取；子资源仍按内容哈希 `?v=` 缓存，性能不受影响。
```java
private static final long processStartMs = System.currentTimeMillis();      // 同进程稳定
...  webView.loadUrl(base + PLUGIN_PATH + "?v=" + cacheKey);                // 两处加载点
```
**产物**：APK 自动重建成功（`android/**` 触发 ✓）→ `iWebPlayer-S-v1.3.6-dev.apk`（2026-09-21 15:09 更新 ✓）。

**下一步诊断（若重装新 APK 后仍旧）**：在 APK 内 `☰ → 版本` 查看版本号 ——
- 若显示 **`1.3.6.07-dev` 及以上** → HTML 已是新的，问题属 WebView 渲染差异（我会改写成兼容写法）；
- 若显示**更旧** → APK 所连服务器上的插件确为旧版（升级该服务器上的插件即可）。

> `2026-09-21` ｜ `fix(android): cache-bust the plugin URL per app process so the WebView always fetches the latest plugin` ｜ 文件：`android/app/src/main/java/com/songloft/iwebplayer/MainActivity.java`

### 1.3.6.08-Dev　ed9b83c　　🐞 修复·布局

**概述**：统一"视口高度"口径（A）+ 把补偿改为按视口比例（B）——解决「浏览器看着合适、app 里位置不同」

**用户需求**：指出真正原因是 **app 的竖向显示区域更大**（浏览器有标签栏/地址栏），而非缓存/版本问题；并选定 **A+B** 方案。

**分析（用两套截图程序化测量）**：
- App 截图：网页可视区 = **2400px**（全屏 WebView，无浏览器 UI）；
- 浏览器截图：可视区 **y=320–2400 → 2080px**（顶部 320px 被标签栏/地址栏占据）；
- 两者相差 **320px（13.3%）**，且两张图**主题也不同**（app 暗色 / 浏览器亮色）→ **用浏览器做验收本身就不可比** ✗。

**根因**：布局几乎全部由 `vh` 驱动，而 **`vh` 在浏览器里取"大视口"**（工具栏收起时的高度），**不等于当前可见高度**；
app 的全屏 WebView 里 `vh` = 真实可视高度 → 同一套 CSS 在两个环境被"按不同高度的盒子"计算 → 位置自然不同。

**修法**：
- **A（统一口径）**：新增 `:root { --vh100: 100vh }`，并在 `@supports (height: 100dvh)` 下覆盖为 `100dvh`（动态视口 = 当前可见高度；旧 WebView 自动回落 `vh`）。
  把布局中**所有**视口高度相关声明改为 `var(--vh100)`（共 14 处）：左栏 `.full-player` 高度、右栏列表 `max-height`、封面 `max-height`、歌词容器高度、手机档 `min-height` —— 替换后布局相关的 `100vh/vh` **残留 0 处** ✓。
- **B（按比例补偿）**：沉浸态那条"抵消底部播放条"的补偿由写死的 `118px` 改为 `calc(var(--vh100) * 0.05)`（视口高度的 5%）→ 在不同视口高度下比例一致 ✓。

**说明**：在 **app 里**（`dvh` == `vh`）本次改动**不改变现有观感** ✓（它让"浏览器与 app 一致"，使浏览器验收重新变得可信 ✓）；
若首页仍需"整体下移 ~10%"，那是**另一项独立调整**（见待办 ⑭，需先定"只移封面 / 连歌词一起移"）。

> `2026-09-21` ｜ `fix(ui): unify viewport height via --vh100 (dvh with vh fallback) and make the immersive offset proportional` ｜ 文件：`static/index.html`

### （仅 APK，无插件构建号）2b0b22f　　♻️ 回退

**概述**：回退 1.3.6.08 引入的「每次启动给插件 URL 加缓存破除查询串」

**用户需求**：「刚才的 apk 变动 有必要恢复」（判断其无必要）。

**理由**：该改动基于**错误结论** ✗ —— 当时以为 APK 界面陈旧是 WebView 缓存所致，后续证明真因是 **app 与浏览器的"视口高度口径"不同**（`vh` 在浏览器取大视口）✓。既然缓存并非原因，就没有必要在每次启动时强制重新抓取主文档，回退可保持加载路径简单、并与上游/宿主行为一致 ✓。
（APK 侧已随之重建 ✓。）

> `2026-09-21` ｜ `revert(android): drop the per-launch cache-busting query (the real cause was viewport units, not WebView caching)` ｜ 文件：`android/app/src/main/java/com/songloft/iwebplayer/MainActivity.java`

### 1.3.6.09-Dev　c76a4b2　　🎨 外观·布局

**概述**：分栏首页封面下移约 10%（用户选定方案 ①：只移封面，歌词不动）

**用户需求**：「先试试 1」（即方案 ①：只把封面下移）。

**改造思路**：用 **transform 视觉位移**，不参与布局流 → **歌词行数完全不变** ✓：
```css
body.split-view-active:not(.player-open) .fp-cover-wrapper { transform: translateY(10%); }
```
- 位移加在**封面容器**上（`.fp-cover-wrapper`）：封面自身有 `cover-breath` 的 `scale` 动画，直接加会被动画覆盖 ✓；
- `translateY(10%)` 的百分比以**元素自身高度**为基准 → 位移随封面大小自适应 ✓；
- 仅作用于**分栏首页**（`:not(.player-open)`）→ 沉浸页与手机档不受影响 ✓。

**说明**：首页状态下歌曲信息（`.desktop-track-meta`）本身是 `display: none`（只在沉浸态显示），所以下移封面不会与信息产生空隙 ✓。

> `2026-09-21` ｜ `feat(ui): nudge the split-home cover down 10 percent visually (option 1, lyrics unaffected)` ｜ 文件：`static/index.html`

### 1.3.6.10-Dev　843cb11　　🎨 外观·布局

**概述**：首页封面位移改为 8%；并给半宽屏沉浸播放页补上同样的 8% 下移

**用户需求**：「半宽屏的沉浸播放页为什么没调？刚才 10% 感觉多了，8% 应该就可以」。

**改造思路**：
1. **首页（分栏，两段）**：`body.split-view-active:not(.player-open) .fp-cover-wrapper { transform: translateY(8%) }`（10% → 8%）；
2. **半宽屏沉浸播放页**：此前只做了「居中 + 确定高度 + 比例补偿」（1.3.6.05~08），**没有这个封面下移** ✗，本次补上：
```css
@media (min-width: 768px) and (max-width: 959px) {
  body.split-view-active.player-open .desktop-player-main { transform: translateY(8%); }
}
```
   —— 用 **transform 视觉位移**：只影响「封面 + 歌曲信息」这一列，**歌词列完全不动** ✓，也不改变任何布局尺寸 ✓。
   断点已脚本复核 = `(min-width:768px) and (max-width:959px)` ✓ → **宽屏 ≥960 的沉浸页未动** ✓。

**说明**：若宽屏（≥960）沉浸页也需要同样的下移，去掉那条媒体查询即可（说一声我加）。

> `2026-09-21` ｜ `feat(ui): cover nudge 8 percent on split-home; add the same nudge to the half-width immersive column` ｜ 文件：`static/index.html`

### 1.3.6.11-Dev　f1f27c3　　🎨 外观·布局

**概述**：半宽屏沉浸页的位移由「8%（元素基准）」改为「1.5% 视口高度」（≈36px）—— 解决"8% 看着少"

**用户需求**：「半宽屏沉浸播放页：8% 少了。参照网页版 你计算下吧」。

**分析**：`translateY(%)` 的百分比基准是**元素自身高度** ✗ —— 首页那条基准是"封面容器"（≈300px → ≈24px，用户认可 ✓），
而沉浸页那条基准是"那一列的渲染高度"（不可控 ✗）→ 实际只移动了 ~20px，所以"偏上"没解决 ✓。
**校准**：10%（≈30px）偏多、沉浸页旧值（≈20px）偏少 → 取 **≈36px = 1.5% 视口高度** ✓。

**改造思路**：`body.split-view-active.player-open .desktop-player-main { transform: translateY(calc(var(--vh100) * 0.015)); }`
→ 改为**视口基准**：跨设备可预测、等比缩放；按 0.5% 步进即可微调（1.0/1.5/2.0% = ≈24/36/48px @2400）。

> `2026-09-21` ｜ `fix(ui): make the half-width immersive cover offset viewport-based (1.5% = ~36px) instead of element-relative` ｜ 文件：`static/index.html`

### 1.3.6.12-Dev　c6b16f3　　🐞 修复·外观

**概述**：两处"封面/内容位移"改为**仅 App 生效**，网页端恢复原样

**用户需求**：「首页你调完，影响网页端的效果。网页端本来是刚刚好的」→ 微调**不得影响网页端**。

**改造思路**：
- **识别 App**：APK 已通过 `webView.addJavascriptInterface(new Bridge(), "Android")` 注入 `window.Android`（网页端没有 ✓）
  → 在 `<body>` 后的**引导脚本**里（**首帧之前** ✓）执行
  `if (window.Android) document.documentElement.classList.add('iwp-app');`
  → **无闪动、不改 URL**（不重新引入缓存问题 ✓）。
- **两条位移规则加 `html.iwp-app` 前缀**：
  - 首页：`html.iwp-app body.split-view-active:not(.player-open) .fp-cover-wrapper { transform: translateY(8%); }`
  - 半宽屏沉浸：`html.iwp-app body.split-view-active.player-open .desktop-player-main { transform: translateY(calc(var(--vh100) * 0.015)); }`
- 结果：**网页端完全恢复原样** ✓（用户确认"刚刚好"）；**App 内保留微调** ✓；手机档与沉浸页其它行为不变 ✓。

> `2026-09-21` ｜ `fix(ui): scope the cover nudges to the app (detect window.Android) so the web layout stays untouched` ｜ 文件：`static/index.html`

### 1.3.6.13-Dev　1dd2a31　　🐞 修复·外观

**概述**：修正沉浸页（半宽屏）位移的计算 —— 改为 **8% 视口高度（192px）**；上一版 1.5%（36px）是**反向**错修

**用户需求**：「半宽屏沉浸播放页，你刚刚的计算方式不对吧」→ 承认并重新计算。

**复盘（上一版错在哪）**：
- 我误以为 `.desktop-player-main` 被 `align-self: stretch` 撑满（≈2200px）→ 据此判断"8% ≈ 176px，而用户说少了" ✗；
- 用 22:51 的截图反推：该列**并未被撑满**（封面顶部实测 ≈360px，若"居中 + 撑满"应 ≈880px ✗）→ 该列高度 ≈ **内容高 ≈520px**
  → 所以旧的 `8%` 实际只等于 **≈42px** ✓（这才是"看着少了"的真正原因 ✓）；
- 而我随后按"≈20px"的错误校准把它改成 **1.5% 视口 = 36px** ✗ → **比原来的 42px 还小** ✗✗（方向完全反了）。

**重新计算（目标＝匹配网页版）**：app 视口 **2400** vs 浏览器可视 **2080** → 差 **320px**；内容相对位置约 **50–60%**
⇒ 需要向下补偿 `0.5~0.6 × 320` = **160–192px** ≈ 视口高度的 **7–8%** ⇒ 取 **8% 视口 = 192px** ✓。

**改动**（仍为**仅 App 生效** ✓，网页端不受影响 ✓）：
```css
html.iwp-app body.split-view-active.player-open .desktop-player-main { transform: translateY(calc(var(--vh100) * 0.08)); }
```
微调档位（@H=2400）：`4% / 6% / 8% / 10%` 视口 = **96 / 144 / 192 / 240px** ✓。

> `2026-09-21` ｜ `fix(ui): correct the immersive offset to 8% of viewport (192px) - previous 1.5% was a 5x reduction from the 8% baseline` ｜ 文件：`static/index.html`

### 1.3.6.14-Dev　ed3f4ea　　🐞 修复·外观

**概述**：修 1.3.6.12 的标记回归 —— App 标识没打上，导致"仅 App 生效"的两条位移在 App 里也失效（实测无变化）

**用户需求**：「app，半宽屏沉浸页。实测无变化」。

**根因**：1.3.6.12 把 `window.Android` 作为**唯一**的 App 判据，而 **JS 桥在首帧脚本执行时未必可用** ✗
→ `html.iwp-app` 没被加上 → 两条位移（首页 + 沉浸页）在 App 内**全都不生效** ✗（连此前的 ~42px 也没有了 → "无变化" ✓）。

**修法（判据三重 + 补检，均保持"网页端不受影响"）**：
1. `window.Android`（APK 通过 `addJavascriptInterface` 注入）；
2. **WebView UA 特征 `; wv)`** —— 普通 Chrome / Edge **没有**这个特征 ✓ → 网页端不会被误判 ✓；
3. 自定义 UA `iWebPlayer-S-APK`（备用，将来可用）；
外加 `DOMContentLoaded` 时**再补检一次**（幂等，覆盖"桥晚于首帧才可用"的机型 ✓）。
提交时附判定自测：WebView UA → **App** ✓；Chrome-Android → 非 App ✓；桌面 Chrome → 非 App ✓。

**若仍无变化**（说明该机型 WebView 连 `; wv)` 也没有）：将在 **APK 侧**做确定性保证 —— `onPageFinished` 时注入
`document.documentElement.classList.add('iwp-app')`（需重装 APK ✓）。

> `2026-09-21` ｜ `fix(ui): robust app detection for the scoped nudges (bridge + wv UA + DOMContentLoaded recheck)` ｜ 文件：`static/index.html`

### 1.3.6.15-Dev　（本次提交）　　🐞 修复·外观

**概述**：找到"改了没变化"的真因 —— 沉浸页位移被写在 **768–959** 媒体查询里，而实测设备属 **≥960** 档；同时补充纯前端 App 判据

**用户需求**：「还是无效，只有注入这一个办法了吗？」→ 需要不动 APK 的可行方案。

**真因（关键）**：实测 App 截图为 **2358×2400 物理像素**，DPR≈2 → **CSS 宽 ≈1179px** → 属 **≥960** 档 ✗；
而 1.3.6.10~14 的沉浸页位移都写在 `@media (min-width:768px) and (max-width:959px)` 里 ✗ → **根本没匹配到该设备** ✓。
（这也解释了 1.3.6.05~07 那几次"半宽屏沉浸页"的调整为什么你始终没感觉 ✓。）

**修法**：
1. 沉浸页位移**移出媒体查询**（`body.split-view-active.player-open`），**两档通用** ✓（仍为"仅 App"✓）；
2. App 判据补到**四重**（全部纯前端、**无需改 APK**）：① `window.Android` ② WebView UA `; wv)` ③ 自定义 UA ④ **视口高度 ≈ 屏幕高度**（App 满屏无浏览器 UI；普通浏览器会少掉地址栏/状态栏）✓ + `DOMContentLoaded` 补检 ✓。

**关于"是否只能注入"**：不是 ✓。上述四重判据都不需要改 APK；**只有当四重全部在你的设备上失效时**，才需要退回 APK 侧注入（那是确定性方案，但需重装 APK ✓）。

> `2026-09-21` ｜ `fix(ui): immersive cover nudge applies to both split bands (was 768-959 only) + pure-frontend app signals` ｜ 文件：`static/index.html`

### 1.3.6.16-Dev　56fb562　　🐞 修复·外观

**概述**：沉浸页位移改回「仅 768–959（半宽屏）」—— 宽屏模式不应跟着下移

**用户需求**：「半宽屏下移了，差不多算正好。但是宽屏模式也下移了 就很不好了」。

**原因**：1.3.6.15 为了排查"改了没变化"，把这条规则从 768–959 媒体查询里**移到了全局** ✗ → 宽屏（≥960）也跟着下移 ✗（排查手段的副作用）。

**修法**：把规则放回 `@media (min-width: 768px) and (max-width: 959px)` 内（"仅 App"与四重识别全部保留 ✓）：
```css
html.iwp-app body.split-view-active.player-open .desktop-player-main { transform: translateY(calc(var(--vh100) * 0.08)); }
```
**复核（脚本判定）**：沉浸页位移断点 = **`(min-width:768px) and (max-width:959px)`** ✓（只有半宽屏 ✓）；
首页封面位移仍为**全局**（两档一致，8% ≈ 24px，此前你认可 ✓）—— 若**宽屏首页**也不想要这个微调，说一声我给它加同样的断点限制 ✓。

> `2026-09-21` ｜ `fix(ui): scope the immersive nudge to the 768-959 band again (wide band must stay untouched)` ｜ 文件：`static/index.html`

### 1.3.6.17-Dev　96760a6　　🔍 诊断 + 🐞 修复·外观

**概述**：加临时诊断（版本菜单显示 视口/屏高/是否识别为 App）；并把沉浸页位移范围放宽到 768–1119

**用户需求**：「半宽屏依旧没解决」（1.3.6.16 把断点收回 768–959 后，半宽屏又失效 ✗）
→ 说明实测的"半宽屏"**并不落在 768–959** 区间 ✗，而其"宽屏"约 1179px ✓；缺少可靠宽度数据，无法精确定位。

**改造思路**：
1. **临时诊断**（定位完成后删除 ✓）：`☰ → 版本` 标签改为
   `APP_VERSION｜视口 W×H｜屏高 <screen.height>｜App/网页`
   —— 一次即可拿到"宽度属于哪一档 / 是否被识别为 App / 视口与屏高之比"三项关键数据 ✓。
2. **位移范围放宽**：原 `(min-width:768px) and (max-width:959px)` → **独立媒体查询 `(min-width:768px) and (max-width:1119px)`**
   —— 覆盖"半宽屏"、同时避开约 1179px 的"宽屏" ✓；且仍要求 `html.iwp-app`（网页端万无一失 ✓）。

**校验**：CSS 括号平衡 ✓、`npm test` ✓、`audit:breakpoints --strict` **PASS** ✓、新规则断点脚本复核 = `(min-width:768px) and (max-width:1119px)` ✓。

**下一步**：把两个模式下 `☰ → 版本` 的文本发来 → 按真实宽度精确收窄区间，并删除诊断代码 ✓。

> `2026-09-21` ｜ `diag(ui): show viewport/screen/app-flag in the version label; widen the immersive nudge band to 768-1119` ｜ 文件：`static/index.html`

## 待优化 / 待办登记（自 1.3.5 结转）

### ① 氛围卡片 `backdrop-filter` A/B（性能，收益最大）
把 `.song-item` / `.pl-card-b` 上的 `backdrop-filter: blur(25px)` 换成半透明纯色底（背景已被 `.fp-ambient-bg` 模糊过）。**需真机 A/B 对比观感**；暂不动。

### ⑥–⑫ GPT《iWP-S-1.3.5.48 审阅结果》条目（已核实，先记录、暂不动）
⑥ 补 `fullscreenchange` 监听；⑦ 审计工具加"状态矩阵断言"；⑧ 沉浸态 blur 降为单层 + 消 `transition: all`（全库 11 处）；⑨ Header 级联链整理；⑩ 分栏规则去重；⑪ 浏览器级测试的可行替代（本环境无 registry/浏览器）；⑫ 截图入库与 CRLF 误报说明。
> 核实结论：**P0-1 已由 1.3.5.23 解决**（沉浸态工具栏收口规则已覆盖 `#toolbar-split`）；**P2-2 的"JS 尾随空白"为 CRLF 误报**（实测 `static/*.js` 尾随空白行全为 0）；其余条目成立。

### ⑭ 首页"内容偏上"（半宽屏首页 / 宽屏首页，用户已提）
- **现象**：与沉浸页同类（内容整体偏上），但**不明显**；用户希望"稍微下调 10% 左右，以便显示更多歌词"。
- **待定**：三种实现方式对"可见歌词行数"影响不同 ——
  ① **只把封面下移**（歌词位置不动）：封面更居中，但可能与歌词上缘重叠；
  ② **整个左栏内容下移**：位置更低，但**可见歌词行数减少**（与目标相反）；
  ③ **把封面改小一点**（歌词区更高）：**能显示更多歌词** ✓（推测最贴近用户真实目标）。
- **状态**：✅ **已按方案 ① 实施**（1.3.6.09：封面容器 `translateY(10%)`，仅视觉位移、歌词行数不变）；若观感仍需微调（如改为 15% 或连同歌曲信息一起移），一行即可调整。
### ⑬ 上游 v1.3.6 —— **A、B、C1、C3 已跟进（见 1.3.6.01 / .03 / .04）；C2 暂缓**
**C = 三个功能**：
1. **跳转源歌单开关**（`#setting-jump-source`）：搜索到歌曲点播放时，自动把视图切到"这首歌所在的歌单"，便于看上下文（可开关、本地记忆）；
2. **过滤当前列表漏斗**（`#setting-filter-list`）：列表头多一个漏斗，点开"过滤当前列表"输入框 —— **依赖我们尚未移植的 v1.3.5「本地过滤」UI**（`#local-filter-*` 在我们仓库为 0 处）；
3. **我的歌单海报墙过滤**（`#grid-filter-wrap`）：按关键词筛歌单、可持久记忆；切走再回来若仍有过滤词会**闪一下红框**提醒；且在"我的歌单"页点顶部搜索图标改为**聚焦该过滤框**而不是跳转。
> **跟进状态**：**C1（跳转源歌单）✓ 已跟进**（1.3.6.03）；**C3（我的歌单过滤 + 漏斗）✓ 已跟进**（1.3.6.04）。
> **C2（"过滤当前列表"/本地过滤）暂缓** ✗：上游的本地/在线过滤依赖一整套 `FilterManager` 子系统（`setFilter` / `triggerFilterLogic` 等），**我们仓库完全没有**；而它直接改**歌曲列表渲染**，正是分栏右栏所依赖的路径 → 与用户"不得影响宽屏/半宽屏布局"的硬约束冲突。若将来要做，建议先单独设计"分栏下的过滤交互"，再实现。
