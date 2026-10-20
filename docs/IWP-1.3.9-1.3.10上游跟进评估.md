# IWP 1.3.9 → 1.3.10 上游跟进评估

- 评估日期：2026-10-20
- 上游插件仓库：[songloft-org/songloft-plugin-iwebplayer](https://github.com/songloft-org/songloft-plugin-iwebplayer)
- 上游插件对比范围：`v1.3.9 (9cdfd77)` → `v1.3.10 (21ba50b)`，共 **2 个提交**（均 `Add files via upload`）
- 上游插件差异规模：**5 个文件，+81 / −37**
  `static/utils.js`（81 行区间）、`static/player.js` 17、`static/index.html` 14、`plugin.json` ±4、`package.json` ±1
- 本地基线：`dev` / `1.3.9-dev`（1.3.9.01）

> **结论**：
> 1. **移植 3 项**：刮削并发限流 `ScrapeManager`（性能）、播放按钮「乐观图标」（交互）、秒表角标与「真的会记忆」对齐（收尾我们 1.3.9.01 留下的不一致）。
> 2. **刻意不跟 1 项**：上游同批的氛围分栏「列表透明化 + 2s 背景渐隐」—— 我们这条分支的氛围分栏是**实体化白卡片**方案（含暗色高特异性覆盖），跟进等于回退自己的视觉。
> 3. **不适用 1 项**：上游把 `getPlLast` / `getPlHistory` 的返回时间从 `0` 改成 `null` —— 本仓库没有 `ProgressManager`（进度存在 `ConfigManager.playback.positions.*`），等价语义由第 1 项里的「角标闸门」承担。
> 4. 按约定 8，base 版本提升为 **`1.3.10-dev`**。
> 5. 实测：`tsc` ✅｜`npm test` ✅（5 文件 / **72** 用例）｜`npm run build` ✅（版本 `1.3.10-dev`）｜`audit:breakpoints --strict` ✅｜`git diff --check` ✅｜内联脚本 `node --check` ✅。

---

## 一、上游 v1.3.9 → v1.3.10 逐项评估

| # | 内容 | 涉及文件 | 判断 | 处理 |
| --- | --- | --- | --- | --- |
| A | 版本号 `1.3.9` → `1.3.10` | `plugin.json`、`package.json` | ✅ 按规范 | base 提升为 `1.3.10-dev` |
| B | **刮削并发限流**：新增 `ScrapeManager`，`fetchScrape` 整个网络段进队列，`max = 3` | `static/utils.js` | ✅ **移植** | 已移植（含 3 个单测） |
| C | **播放按钮乐观图标**：`playSong` 起始与 `btnPlay` 两个分支立刻 `updatePlayButtonUI()` | `static/player.js`、`static/index.html` | ✅ **移植** | 已移植（含 2 个单测） |
| D | `getPlLast` / `getPlHistory` 未记忆时返回 `time: null`（原 `0`） | `static/utils.js` | ➖ 不适用 | 本仓库无 `ProgressManager`；等价语义见 E |
| E | `autoResume` 开关变化后立刻 `renderPlaylist()` 重绘 | `static/index.html` | ✅ **移植** | 已移植（并同步了我们的角标闸门） |
| F | 氛围分栏列表 `background-color` 去 `!important` + `transition: background-color 2s ease` | `static/index.html` | ⛔ **刻意不跟** | 保留「实体化白卡片」方案 |

### B：刮削并发限流 —— 为什么值得移植

浏览器对同一域名只有 **6 条连接**，而我们的列表有 4 处「封面 404 连环抢救」（`static/playlist.js`）：

| 位置 | 行为 |
| --- | --- |
| `handleListCoverError`（≤ 5 首） | 单张卡片 404 → 顺序再刮最多 5 首 |
| `renderPlaylistGrid` 的可见性观察器（≤ 5 首/卡片） | 海报墙每张进入视口都可能触发一次连环刮削 |

一次滚动就可能同时压上十几个刮削请求 → 音频直链、`/musicinfo`、`/sync` 全排在后面 → 表现为「切歌卡住 / 转圈很久」。

实现（与上游同构，仅 URL 前缀保留我们自己的 `iwebplayer-s`）：

```js
window.ScrapeManager = { queue: [], active: 0, max: 3, add(task) {...}, run() {...} };
window.fetchScrape = async (rawItem, type, currentSongName) => window.ScrapeManager.add(async () => { ...原逻辑... });
```

- 严格 FIFO；单个任务抛错 → 该任务 `resolve(null)`，槽位在 `finally` 里释放，不会卡住队列（有单测覆盖）；
- `resolve(await task())` 与上游的 `resolve(res)` 等价；
- **已知风险（与上游一致）**：任务不设超时。若宿主刮削接口长时间不返回，最多占满 3 个槽位，后续刮削排队等待；但正因为限流，音频/接口始终有 3 条车道，不影响播放。

### C：播放按钮乐观图标 —— 我们比上游更需要

上一版（1.3.9.01）给音频事件加了归属守卫（`isCurrentMedia`），**副作用**是：从点击到 `audioEl.src` 落地之间没有 `play` 事件，按钮图标会停在「播放」上。慢网络（取直链要几百毫秒）下用户会以为「点了没反应」，再点一次。

上游 v1.3.10 的做法正是补这个洞：

| 位置 | 改动 |
| --- | --- |
| `playSong` 起始 | `if (window.updatePlayButtonUI && autoPlay) window.updatePlayButtonUI(true);` |
| `btnPlay` 首次物理点击分支 | 先 `updatePlayButtonUI(true)` 再 `playSong()` |
| `btnPlay` 有 src 分支 | 播放 → `true`；暂停 → `false`，都在调用 `play()/pause()` 之前 |

注意 `autoPlay = false`（启动定位 / standalone 恢复）**不加**，否则会出现「没播却显示播放中」。失败时 `catch` 与 `error` 处理会把图标复位（既有逻辑）。

### D / E：`time: null` 与列表重绘 —— 落到我们这边是「角标闸门」

上游的 `getPlLast` / `getPlHistory` 在「不该记忆」时返回 `time: null`，目的是让列表里的「⏱ + 时间」**不显示**。本仓库没有这套 getter，等价物是 `static/playlist.js` 渲染 `#time-wrap-*` 的那段：

改造前（两个分支按 `resumeLocal` 硬分）：

```js
if (plConf.resumeLocal !== 'off') { /* 读 iwebplayer-s.resume_history */ }
else { /* 读 iwebplayer-s.playlist_tracks */ }
```

两个问题：

1. **无视全局总开关**：`autoResume` 打开、歌单级 `resumeLocal === 'off'` 时，角标走 else 分支 → 显示错误/不显示；
2. else 分支读的 `iwebplayer-s.playlist_tracks` **全仓没有任何写入点**（`git log -S` 也查不到历史写入）—— 是纯粹的遗留死键，所以那半个分支永远不会命中。

改造后：单一判据 `window.shouldRememberProgress(currentPlaylist)`（总开关 ∨ 歌单续播），只有真会恢复进度时才渲染秒表；历史遗留键保留为「最后断点」兜底（不影响行为）。配合 E 的 `renderPlaylist()`，切换开关后角标当场出现/消失。

> 顺带确认：`iwebplayer-s.resume_history` 只由 `static/playlist.js` 的续播保存逻辑写入，`playlist_tracks` 无写入点 —— 后者属于将来可清理的死代码，本次不动（避免顺手改到启动定位逻辑）。

### F：氛围分栏视觉 —— 为什么刻意不跟

| | 上游 v1.3.10 | 我们 |
| --- | --- | --- |
| 列表卡片 | `background-color: transparent`（去 `!important`）+ `transition: background-color 2s ease`，播放行用淡粉底 | **不透明白卡片**（`rgba(255,255,255,.85)` + 25px 毛玻璃 + 边线 + 阴影），播放行用 `2px` 主色描边 |
| 暗色 | 同款透明 + 白线分隔 | `:root:not([data-theme="light"])` / `:root[data-theme="dark"]` 两套**更高特异性**覆盖（修复过「暗色卡片盖掉播放行」的问题） |

上游这次改动是为了修他们自己 `!important` 压住 `.playing` 背景的问题；我们的 `.playing` 走的是描边而不是背景，且暗色覆盖已经用特异性解决过同类问题。**跟进等于回退我们自己的氛围分栏设计**，故不动（视觉差异已在本仓库多轮实测确认）。

---

## 二、实测验证（本机，2026-10-20）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 | `npx tsc --noEmit` | ✅ 通过 |
| 单测 | `npm test` | ✅ 5 文件 / **72** 用例（新增 3 个 `ScrapeManager` 用例 + 2 个乐观图标用例） |
| 构建 | `npm run build` | ✅ `dist/iwebplayer-s.jsplugin.zip`（版本 `1.3.10-dev`，713.2 KB） |
| 断点审计 | `npm run audit:breakpoints -- --strict` | ✅ 未发现跨断点带缺失或不一致 |
| 行尾 / 空白 | `git -c core.whitespace=cr-at-eol diff --check` | ✅ 通过（`utils.js`/`playlist.js` 纯 CRLF、`index.html` 纯 LF 均保持） |
| 内联脚本 | 抽取 `index.html` 3 个内联 `<script>` 逐个 `node --check` | ✅ 通过 |

---

## 三、本次动作清单

**已做**

1. `static/utils.js`：新增 `ScrapeManager`（FIFO、max 3、错误→null），`fetchScrape` 的网络段整体入队；保留我们的 `/api/v1/jsplugin/iwebplayer-s/scrape` 路径。
2. `static/player.js`：`playSong` 起始按 `autoPlay` 乐观置「播放中」。
3. `static/index.html`：「自动记忆播放进度」开关变化后重绘列表；`btnPlay` 三个分支的乐观图标。
4. `static/playlist.js`：`#time-wrap-*` 秒表角标改由 `shouldRememberProgress()` 统一判定。
5. 新增单测：`tests/utils.test.ts`（并发上限、FIFO、失败不卡队列、空参）+ `tests/playback-race.test.ts`（autoPlay 乐观图标 / autoPlay=false 不抢状态）。
6. 版本号 `1.3.9-dev` → `1.3.10-dev`：`plugin.json`、`package.json`、`package-lock.json`(2 处)、`README.md`(badge + 2 处 zip 名 + 1 处陈旧文字)、`DEV_RELEASE_NOTES.md`(标题 + 新条目)、`AGENT.md`(版本表 6 行 + 已发生列表 + 约定 8 交叉引用 + 评估文档清单)。
7. 新建本评估文档；新建 `docs/iWP-S-1.3.10-Dev-记录.md`（约定 11）。

**未做（及原因）**

- 不跟氛围分栏列表透明化 + 2s 渐隐（见一、F）。
- 不移植 `getPlLast` / `getPlHistory` 的 `null` 语义（本仓库无 `ProgressManager`）。
- 不清理遗留死键 `iwebplayer-s.playlist_tracks`（涉及启动定位逻辑，留待单独评估）。
- 不改 `manifest.json`（CI 维护）；不动 CI 版本 / tag / 构建序号逻辑。
