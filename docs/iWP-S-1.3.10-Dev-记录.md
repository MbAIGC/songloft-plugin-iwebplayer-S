# iWP-S 1.3.10 Dev 记录

> **本文件约定**：同一大版本（`1.3.10`）内的**所有改动都记在这里**。每条用三级标题 `### <构建号>-Dev　<提交短哈希>　　<类型标签>`，
> 下面依次 `**概述**：` / `**用户需求**：` / `**改造思路**：`，末行引用式元信息（日期 ｜ 提交 ｜ 文件）。
> 类型标签：`⚙️ 功能` · `✅ 布局` · `🎨 外观` · `🐞 修复` · `🚀 性能·构建` · `🏗 重构` · `🧪 工具` · `♻️ 回退` · `📄 文档`。
> 1.3.9 及更早见 `iWP-S-1.3.9-Dev-记录.md`；上游跟进评估见 `IWP-1.3.9-1.3.10上游跟进评估.md`。

## 速查索引

| 构建 | 提交 | 概述 | 类型 |
| :--: | :--: | --- | --- |
| 1 | `1fa899c` | 跟进上游 v1.3.10：刮削并发限流（≤3，给音频留车道）+ 播放按钮乐观图标 + 秒表角标改由「真会记忆」判据；base 升到 1.3.10-dev | 🚀 性能·跟进上游 |

> 共 **1** 条改动。

---

## 阶段 1 · 跟进上游 v1.3.10

### 1.3.10.01-Dev　1fa899c　　🚀 性能·跟进上游

**概述**：跟进上游 v1.3.9 → v1.3.10 —— 移植**刮削并发限流**（最多 3 个，始终留 3 条连接给音频/接口）、**播放按钮乐观图标**（点击即刻翻转，不等 `play` 事件），并把列表里的「秒表 + 时间」角标收口到「真的会记忆进度」这一判据；base 版本提升为 `1.3.10-dev`

**用户需求**：「上游更新了」→ 按约定 8 逐项评估（2 个提交 / 5 文件），确认移植 B/C/E 三项、刻意不跟 F（氛围分栏透明化），D（`time: null`）因本仓库无 `ProgressManager` 不适用。

**改造思路**：
- **①刮削并发限流**（上游 v1.3.10，`utils.js`）：
  - 新增 `window.ScrapeManager`：`queue` + `active` + `max = 3` 的 FIFO 队列，`add(task)` 返回 Promise，`run()` 在槽位释放后自动放行下一个，任务抛错时 `resolve(null)`（不向调用方抛出，与原 `fetchScrape` 契约一致）；
  - `window.fetchScrape` 改为把**整个网络段**包进 `ScrapeManager.add()`，URL 仍是我们自己的 `/api/v1/jsplugin/iwebplayer-s/scrape?...`（上游是 `iwebplayer`，不能照搬）；
  - 动因：`static/playlist.js` 有 4 处「封面 404 连环抢救」（`handleListCoverError`、海报墙可见性观察器等，每处最多再顺查 5 首），一次滚动就能同时压上十几个请求，把浏览器同域 6 条连接占满 → 音频直链 / `/musicinfo` / `/sync` 排队，表现为切歌卡顿；
  - 已知风险（与上游一致）：任务不设超时，接口长时间不返回时最多占满 3 个槽位、后续刮削排队；但音频始终有 3 条车道（这正是限流目的）。
- **②播放按钮乐观图标**（上游 v1.3.10，`player.js` + `index.html`）：
  - `playSong` 起始：`if (window.updatePlayButtonUI && autoPlay) window.updatePlayButtonUI(true);`
  - `btnPlay`：首次物理点击分支先翻成「播放中」再 `playSong()`；有 src 的分支里，`play()` 前先 `true`、`pause()` 前先 `false`；
  - **为什么我们更需要**：上一版（1.3.9.01）给 6 个音频监听器加了 `isCurrentMedia` 归属守卫，取直链期间不会有 `play` 事件 → 慢网络下点击后图标不动，用户会以为「没反应」再点一次；
  - `autoPlay = false`（启动定位 / standalone 恢复）**不翻**，避免「没播却显示播放中」；失败由 `catch` / `error` 复位。
- **③秒表角标收口**（上游 v1.3.10 的 `time: null` + 重绘，落到我们的模型）：
  - `static/playlist.js` 渲染 `#time-wrap-*` 的判据从 `plConf.resumeLocal !== 'off'`（且 else 分支读死键）改为 `window.shouldRememberProgress(window.currentPlaylist)`（总开关 ∨ 歌单续播）；
  - 修掉两个不一致：总开关打开但歌单续播关闭时角标不显示；上一版落实「关闭就该真的不续播」后，角标仍按旧判据显示；
  - 顺带确认 `iwebplayer-s.playlist_tracks` **全仓无写入点**（`git log -S` 亦无历史写入），属于遗留死键，本次保留为「最后断点」兜底、不清理（避免顺手动到启动定位逻辑）；
  - `static/index.html`：`autoResume` 开关变化后立刻 `renderPlaylist()`，角标当场出现/消失。
- **刻意不跟**：上游同批把氛围分栏的 `.song-item` 改成 `background-color: transparent`（去掉 `!important`）并加 `transition: background-color 2s ease`、播放行用淡粉底。我们这条分支的氛围分栏是「实体化白卡片」方案（白色 85% 不透明 + 25px 毛玻璃 + 边线阴影，播放行用 2px 主色描边），暗色下另有两套更高特异性覆盖（修过「暗色卡片盖掉播放行」）。跟进等于回退自己的视觉 → 不动。
- **不适用**：上游 `getPlLast` / `getPlHistory` 未记忆时返回 `time: null` —— 本仓库没有 `ProgressManager`（进度存 `ConfigManager.playback.positions.*`），等价语义由 ③ 承担。
- **测试**：`tests/utils.test.ts` 新增 3 例（并发峰值 ≤3 且 FIFO、单任务失败不卡队列、空参返回 null）；`tests/playback-race.test.ts` 新增 2 例（`autoPlay=true` 立刻置播放态、`autoPlay=false` 不抢状态）。
- **版本号**：按约定 8 把 base 提到 `1.3.10-dev`，同步 `plugin.json`、`package.json`、`package-lock.json`(2 处)、`README.md`(badge + 2 处 zip 名 + 1 处陈旧文字)、`DEV_RELEASE_NOTES.md`(标题 + 新条目)、`AGENT.md`(版本表 6 行 + 已发生列表 + 约定 8 交叉引用 + 评估文档清单)。

> `2026-10-20` ｜ `perf(scrape): follow upstream v1.3.10 (scrape concurrency cap + optimistic play icon); bump base to 1.3.10-dev` ｜ 文件：`static/utils.js`、`static/player.js`、`static/playlist.js`、`static/index.html`、`tests/utils.test.ts`、`tests/playback-race.test.ts`、`plugin.json`、`package.json`、`package-lock.json`、`README.md`、`DEV_RELEASE_NOTES.md`、`AGENT.md`、`docs/IWP-1.3.9-1.3.10上游跟进评估.md`
>
> 验证：`npx tsc --noEmit` ✅｜`npm test` ✅（5 文件 / 72 用例）｜`npm run build` ✅（版本 `1.3.10-dev`，713.2 KB）｜`npm run audit:breakpoints -- --strict` ✅｜`git -c core.whitespace=cr-at-eol diff --check` ✅｜`index.html` 三个内联 `<script>` 逐个 `node --check` ✅
>
> 行尾：`index.html` 保持纯 LF、`utils.js`/`playlist.js` 保持纯 CRLF、`player.js` 混合行尾未被打乱（全部字节级替换）。
>
> 待实测：① 列表滚动时（海报墙 / 封面 404 抢救）音频是否更顺；② 慢网络下点歌，图标是否立刻翻转；③ 「自动记忆播放进度」开关切换后，列表秒表角标是否当场出现/消失。
>
> 未动：氛围分栏视觉（见上）、`manifest.json`（CI 维护）、CI 的版本 / tag / 构建序号逻辑、遗留死键 `iwebplayer-s.playlist_tracks`。
