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

> 共 **2** 条改动。

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

## 待优化 / 待办登记（自 1.3.5 结转）

### ① 氛围卡片 `backdrop-filter` A/B（性能，收益最大）
把 `.song-item` / `.pl-card-b` 上的 `backdrop-filter: blur(25px)` 换成半透明纯色底（背景已被 `.fp-ambient-bg` 模糊过）。**需真机 A/B 对比观感**；暂不动。

### ⑥–⑫ GPT《iWP-S-1.3.5.48 审阅结果》条目（已核实，先记录、暂不动）
⑥ 补 `fullscreenchange` 监听；⑦ 审计工具加"状态矩阵断言"；⑧ 沉浸态 blur 降为单层 + 消 `transition: all`（全库 11 处）；⑨ Header 级联链整理；⑩ 分栏规则去重；⑪ 浏览器级测试的可行替代（本环境无 registry/浏览器）；⑫ 截图入库与 CRLF 误报说明。
> 核实结论：**P0-1 已由 1.3.5.23 解决**（沉浸态工具栏收口规则已覆盖 `#toolbar-split`）；**P2-2 的"JS 尾随空白"为 CRLF 误报**（实测 `static/*.js` 尾随空白行全为 0）；其余条目成立。

### ⑬ 上游 v1.3.6 —— A、B 已跟进（见 1.3.6.01）；**C 待决策**
**C = 三个功能**：
1. **跳转源歌单开关**（`#setting-jump-source`）：搜索到歌曲点播放时，自动把视图切到"这首歌所在的歌单"，便于看上下文（可开关、本地记忆）；
2. **过滤当前列表漏斗**（`#setting-filter-list`）：列表头多一个漏斗，点开"过滤当前列表"输入框 —— **依赖我们尚未移植的 v1.3.5「本地过滤」UI**（`#local-filter-*` 在我们仓库为 0 处）；
3. **我的歌单海报墙过滤**（`#grid-filter-wrap`）：按关键词筛歌单、可持久记忆；切走再回来若仍有过滤词会**闪一下红框**提醒；且在"我的歌单"页点顶部搜索图标改为**聚焦该过滤框**而不是跳转。
> 结论：**暂不跟进**（分栏下这些控件的落点需单独设计，且依赖缺失的本地过滤 UI）。若跟进，需先定"分栏下放哪（隐藏 / 并入工具栏 / 放右栏列表头）"。
