# IWP 1.3.5 → 1.3.6 上游跟进评估

- 评估日期：2026-09-19
- 上游仓库：[songloft-org/songloft-plugin-iwebplayer](https://github.com/songloft-org/songloft-plugin-iwebplayer)
- 上游对比范围：`v1.3.5 (21b4615)` → `v1.3.6 (d320183)`，共 **2 个提交**（均为 `Add files via upload`）
- 差异规模：**7 个文件，+254 / −28**
  `static/index.html +189`、`static/playlist.js +46`、`static/player.js +36`、`static/icons.js ±1`、`static/utils.js ±1`、`plugin.json`/`package.json`（版本号）
- 本地基线：`dev` / `1.3.5-dev`（1.3.5.49）

> **结论：可以适配，但不能 merge / cherry-pick，需按功能手工移植。**
> 建议分两批：**第一批**（图标类，低风险）建议做；**第二批**（列表过滤/跳转源）需先定分栏下的期望行为再评估。

---

## 一、上游 v1.3.6 改了什么（4 类）

| 类别 | 内容 | 文件 |
| --- | --- | --- |
| **A 图标重构** | 把内联的"地球/在线资源"SVG 收敛为 `SVG_ICONS.online`，`utils.js` 改为引用 | `icons.js`、`utils.js` |
| **B 头部导航图标** | 新增 `#nav-online-btn`（在线资源）与 `#nav-search-btn`（曲库搜索）两个 `.header-icon-btn`，置于 **`.header-controls`**；`body.player-open` 时隐藏；切歌单时点亮 `active`；并把这两项**从歌单下拉中移除** | `index.html`、`player.js` |
| **C 列表过滤与跳转源** | 新增 `#grid-filter-wrap`（"我的歌单"网格过滤：输入框 + 清空 + `glow` 红框闪烁）、`#jump-source-wrap`（播放时自动跳转源歌单）、`#filter-action-wrap`（过滤当前列表漏斗） | `index.html`、`player.js`、`playlist.js` |
| **D 版本与缓存串** | `plugin.json` / `package.json` → `1.3.6`；`<script src="./static/xxx.js?v1.3.6">` | 多处 |

---

## 二、逐项可适配性评估

### A 图标重构 —— ✅ 可照搬（零风险）
我们仓库没有 `SVG_ICONS.online`，`utils.js` 里也是内联 SVG。纯重构、无布局影响。

### B 头部导航图标 —— ✅ 可适配（需 3 处小改）

| 冲突点 | 说明 | 处理 |
| --- | --- | --- |
| ① 落在 `.header-controls` | 我们的**分栏下该容器是 `display: none`** → 这两个图标在分栏里不可见 | **可接受**：分栏工具栏本就有"本地 / 在线"来源开关，功能不缺失；若希望分栏也可见，需另择容器 |
| ② 同批新增 `#device-container { flex-shrink:1; min-width:75px; max-width:140px }` | **我们已把设备选择器搬进分栏工具栏**（`#tbs-device`）→ 这条**不能照搬** | 只取"移动端 header 内设备框可收缩"的意图，改写为不影响分栏的版本（或仅在非分栏下生效） |
| ③ `?v1.3.6` 查询串 | 我们由**构建期注入内容哈希**（`scripts/inject-version-hashes.mjs`） | 保持我们的方式，不采用上游的版本串 |

### C 列表过滤与跳转源 —— ⚠️ 可适配但成本最高（建议单独一批）

现状核查：我们仓库里 `#grid-filter-wrap`、`#grid-filter-input`、`#grid-filter-clear`、`#filter-action-wrap`、`#jump-source-wrap`、`#nav-search-btn`、`#nav-online-btn` **全部为 0 处**；`FilterManager` / `_gridFilterKeyword` 等在 `static/*.js` 中也**不存在**。

| 冲突点 | 说明 |
| --- | --- |
| ① `#grid-filter-wrap` 位于 `#playlist-row` | **我们分栏下隐藏 `#playlist-row`** → 分栏里看不到该过滤框（手机端可见）。是否需要分栏版本要先定 |
| ② `#jump-source-wrap` / `#filter-action-wrap` 位于 `#menu-dropzone-row1` | **我们分栏会把 `#menu-dropzone-row1` 搬进 `.tbs-playlist` 列**，而该列在窄档只有 **76–150px** → 两个新按钮塞进去必然拥挤 ✗ 必须在分栏下隐藏或另置 |
| ③ `playlist.js` 分叉巨大 | 我们与之相差约 **727 行**（自研部分）→ 过滤逻辑需**手工重写**，不能打补丁式移植 |

### D 版本 / 缓存串 —— ✅ 按既有规范处理
版本号按规范升到 `1.3.6-dev`（不改 tag / manifest / 构建号规则）；脚本查询串沿用我们的哈希注入。

---

## 三、不建议直接照搬的 3 处（会与分栏改造冲突）

1. `#device-container { flex-shrink:1; min-width:75px; max-width:140px }` —— 设备选择器已不在 header。
2. 新控件在 `#playlist-row` / `#menu-dropzone-row1` 中的落点 —— 分栏下分别被**隐藏**与**搬进窄列**。
3. `<script src="...?v1.3.6">` —— 应保留构建期内容哈希注入。

---

## 四、顺带发现：v1.3.5 的"本地过滤"我们可能漏了

上游 **v1.3.5 就已存在** `#local-filter-input` / `#local-filter-clear` / `#local-filter-wrap`（在 v1.3.5→v1.3.6 的 diff 中它们是**上下文行**，即未改动）。而**我们仓库里没有这些元素** → 上一次 `v1.3.2 → v1.3.5` 的"全部跟进"里，这部分 UI **可能漏了**（或当时有意未取）。若要跟进 C，需先确认这一点。

---

## 五、建议的跟进方案

1. **第一批（低风险，建议做）**：A 图标重构 + B 导航图标（含分栏可见性策略：沿"分栏隐藏、由工具栏来源开关承担"）。成本小、体验直观，且不触碰分栏核心。
2. **第二批（单独评估）**：C 过滤 / 跳转源 —— 需先定三件事：
   - ① 分栏下这些控件放哪里（隐藏？并入工具栏？放右栏列表头？）；
   - ② 是否同时补上 v1.3.5 漏掉的"本地过滤"；
   - ③ 与"简约"取向是否一致（顶部会多两个图标、列表头多一个漏斗）。
3. **D**：按规范把 base 升到 `1.3.6-dev`。
4. 若跟进，流程：① 登记本条评估结论 → ② 手工移植 → ③ 跑 `npm test` + `audit:breakpoints --strict` + 桩模拟 → ④ 产出新构建并按记录约定登记。

---

## 六、待决策

- **B**：这两个头部导航图标要不要？
- **C**：要不要？**分栏下的期望行为是什么**？
- 是否顺带补上 v1.3.5 的"本地过滤"？

（本文件仅为评估，未改动任何代码。）

---

## 七、专项核查：对"我们已优化的宽屏（分栏）模式"的影响

**核查方法**：在 `v1.3.5 → v1.3.6` 的 diff 中检索我们宽屏机制所依赖的选择器与变量。

**核查结果：v1.3.6 没有改动任何分栏 / 氛围 / 工具栏机制** ——

| 我们依赖的选择器/变量 | 在 v1.3.6 改动行中的命中 |
| --- | --- |
| `split-view-active` / `ambient-active` / `.tbs-*` / `toolbar-split` | **0** ✓ |
| `playlist-row` / `header-controls` / `full-player` / `player-bar` / `--top-color` | **0** ✓ |
| `#device-container` | **1**（新增尺寸规则）✗ |
| `.header-left-group` | 1（`flex-shrink:0; max-width:55%`，与我们 `flex:0 0 50%` 不冲突）✓ |
| `#playlist-opts` | 6（隐藏下拉里的"曲库搜索/在线资源"，含暗色重复） |

### 逐项影响表

| v1.3.6 项 | 涉及的宽屏组件 | 影响 | 需要的适配 |
| --- | --- | --- | --- |
| A 图标重构 | 无 | 无 | 无 ✓ |
| B 导航图标（`#nav-*`） | 落在 `.header-controls`（**分栏下 `display:none`**） | 分栏下不可见，**无副作用** ✓（分栏本就有"本地/在线"来源开关） | 无（若希望分栏也可见需另择容器） |
| B `#device-container{min-width:75px}` | 分栏工具栏的 `#tbs-device` 内的同一元素 | **会生效** ✗：窄档（768–959）我们刚把设备压到 ~68px，`min-width:75px` 会把它顶回 75px → 最窄分栏可能重新拥挤 | **必须改写**：仅在非分栏下生效，或分栏下显式保留 68px |
| B 下拉项移除 | `#playlist-opts`（**分栏工具栏的歌单下拉是同一个元素**） | 分栏下拉里也看不到"曲库搜索/在线资源" | 可接受（分栏用工具栏来源开关切换）；若需保留，需在分栏下放行这两项 |
| C 网格过滤 `#grid-filter-wrap` | 位于 `#playlist-row`（**分栏下整体隐藏**） | 分栏看不到该功能 | 若要分栏可用，需另择容器（如右栏列表头） |
| C 跳转源 / 漏斗 | 位于 `#menu-dropzone-row1`（**分栏会被搬进 `.tbs-playlist`，窄档仅 76–150px**） | **两个图标会挤进窄列** ✗ | **必须加分栏规则**：隐藏，或另置到右栏 |
| C `playlist.js` 过滤逻辑 | 右栏列表渲染 | 逻辑本身不冲突 | 手工移植时注意保持我们的滚动/高度规则 |
| D 版本 / 缓存串 | 构建期注入 | 无 | 不采用 `?v1.3.6` |

### 一句话结论

> **跟进 v1.3.6 不会破坏宽屏模式。** 但若照搬，需 **1 处必须改写**（`#device-container` 尺寸）、**1 处必须加分栏规则**（dropzone 内的两个新按钮），另有 **1 处轻微行为变化**（分栏下拉少两项）与 **1 处功能缺口**（网格过滤在分栏不可见）。

**建议**：这三处适配应在移植时一并完成，并纳入 `scripts/audit-breakpoints.mjs` 的关注点（例如新增断言：分栏带内不得出现 `#device-container{min-width:75px}` 这类影响窄档宽度的规则）。
