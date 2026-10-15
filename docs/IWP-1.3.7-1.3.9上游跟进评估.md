# IWP 1.3.7 → 1.3.9 上游跟进评估

- 评估日期：2026-10-15
- 上游插件仓库：[songloft-org/songloft-plugin-iwebplayer](https://github.com/songloft-org/songloft-plugin-iwebplayer)
- 上游插件对比范围：`v1.3.7 (731b251)` → `v1.3.9 (9cdfd77)`，共 **8 个提交**（含 PR #10 `fix/playback-race`）
- 上游插件差异规模：**8 个文件，+456 / −89**
  `static/player.js`（+252 区间）、`static/index.html` 36、`static/utils.js` 32、`static/icons.js` 4、`tests/helpers/player.cjs` +95（新增）、`tests/playback-race.test.cjs` +120（新增）、`plugin.json` ±4、`package.json` ±1
- 本地基线：`dev` / `1.3.7-dev`（1.3.7.02）

> **结论**：
> 1. **必修 1 项：上游 v1.3.8 的「播放竞态修复」**（PR #10，`640b2c5` + `50afa42`）。我们的 `playSong` 与上游同源、同样没有「请求身份」概念，四类症状在代码里逐条可指认（连点播错歌 / 旧请求失败冤枉新歌 / 过期预读被当命中 / 幽灵定时器跨歌误伤），详见一、B。
> 2. **移植 1 项功能：v1.3.8 的「自动记忆播放进度」总开关**（默认**关闭**）。我们原有的 `resumeLocal`（off/local/global）与上游 v1.3.8 的目标语义已经一致，但**「关闭就该真的不续播」这条我们此前没做到**——歌单里记住的进度是无条件自动定位的，现按上游收紧。
> 3. **对齐 3 处设置项文案**（锁屏歌词 / 沉浸氛围背景 / 高性能同步模式）。
> 4. 上游 v1.3.9 新增的 `icons.js` 两个常量**不适用**（上游自己也没有任何引用）；v1.3.9 **移除**列表内「秒表 + 已播时间」角标 —— 我们**刻意保留**。
> 5. 按 AGENT.md 约定 8 的默认规范，跟随上游把 **base 版本提升为 `1.3.9-dev`**（跳过 `1.3.8`，两版一次跟进），并同步 README / DEV_RELEASE_NOTES / AGENT.md。
> 6. 新增回归测试 `tests/playback-race.test.ts`（**17 例**）把本次修复的行为钉住。
> 7. 实测：`tsc` ✅｜`npm test` ✅（5 文件 / **67** 用例）｜`npm run build` ✅（版本 `1.3.9-dev`）｜`audit:breakpoints --strict` ✅｜`git diff --check` ✅。

---

## 一、上游插件 v1.3.7 → v1.3.9 逐项评估

| # | 提交 | 内容 | 涉及文件 | 判断 | 处理 |
| --- | --- | --- | --- | --- | --- |
| A | `21a2556` `7b5e70b` | 版本号 `1.3.7` → `1.3.8` → `1.3.9` | `plugin.json`、`package.json` | ✅ 按规范 | base 提升为 `1.3.9-dev` |
| B | `640b2c5` `50afa42`（PR #10） | **播放竞态修复**：「最后一次选曲胜出」+「丢弃过期的跨单预读」 | `static/player.js` | ✅ **必须移植** | 已移植（`player.js` + `index.html`） |
| C | `4f82025` | **新增「自动记忆播放进度」总开关** `autoResume`（默认 false）+ 读进度时按开关归零 + `utils.js` 三处读接口 | `static/utils.js`、`static/index.html`、`static/player.js` | ✅ **移植** | 已移植（新增 `shouldRememberProgress`） |
| D | `4f82025` | 3 处偏好描述文案改写 | `static/index.html` | ✅ 顺手对齐 | 已改 |
| E | `9cdfd77` | `icons.js` 新增 `menu_dots` / `menu_lines` | `static/icons.js` | ➖ 不适用 | 不改 |
| F | `9cdfd77` | 移除歌曲列表里的「秒表 + 已播时间」角标（`timeWrap.innerHTML = ''`） | `static/player.js` | 🟡 **刻意不跟** | 保留 |

> 补充：目录里另外两个 `Add files via upload`（`1f66ac8` 新增 1340 行 `player.js`、`7e8b991` 删除 1409 行 `player.js`）是上游维护者对同一文件的重复上传，净效果已包含在 B 里。

### B：播放竞态修复 —— 为什么必须移植

上游这次修的是「异步结果与用户意图错位」，共 4 类症状。逐条对照我们改动前的代码（`1.3.7.02`）：

| 症状 | 上游的修法 | 我们改动前的代码 |
| --- | --- | --- |
| **①连点两首 → 播错歌**：先点的请求后返回，把后点的歌覆盖掉（封面/歌词/标题跟着错） | 每次选曲自增一个 `playbackRequest` 令牌，快照 `targetPlaylist` / 曲名 / 列表，每个 `await` 之后校验 `isCurrent()` | 没有令牌；`await fetch(musicinfo)` 之后直接写 `audioEl.src`，全程只靠 `window.currentSongName` 做弱校验（而它在 `highlightSongUI` 里会被新一次点击改写） |
| **②旧请求失败 → 冤枉新歌**：把**新选的那首**标成失效、弹「自动跳过」、1 秒后跳歌 | `catch` 里先 `if (!isCurrent()) return`，标死只用本次选曲的 `index` / `targetPlaylist` | `catch` 用**实时**的 `window.currentIndex` / `window.currentPlaylist` 调 `markSongAsDead`，并 `setTimeout(playNextSong, 1000)` |
| **③过期预读被当成本单缓存命中**：切换歌单后残留的预读结果按「索引」误命中 | 预读缓存增加 `playlist` + `trackKey`（`plugin_entry_path`/`id`/`dedup_key`），命中时必须两者都相等 | 命中条件只有 `preloadCache.index === index`（跨单时加 `playlist` 名，但 `scoutNextSong` 的普通预读连 `playlist` 都没写、也没有曲目身份） |
| **④幽灵定时器跨歌误伤**：DAV 8 秒硬超时、缓冲停滞 0.5 秒重载、失败 1 秒重试在切歌后仍然开火 | 统一挂到令牌上（`deferPlayback` / `playbackTimers`），并导出 `invalidatePlaybackRequest()` 一键清空；`loadedmetadata` 监听也登记 `metadataCleanup` | 只在 `playSong` 开头清 `_davDirectTimeout`；`_stalledRecoveryTimeout` 从不清理；列表滚动/失败重试都是裸 `setTimeout` |

另外，上游把**音频事件本身**也纳入归属判断（`currentMedia(audio)`：非 pending + `dataset.playbackRequest` 相符 + `currentSrc === src`），让旧的 `<audio>` 事件（`play` / `playing` / `pause` / `error` / `timeupdate` / `ended`）不能驱动新选曲的 UI、进度、标失效或跳歌。**我们的音频监听器不在 `player.js` 而在 `index.html` 的内联脚本里**，所以多导出了两个口子给页面用：

- `window.isCurrentMedia(audioEl)` —— 页面里包一层 `staleAudioEvent()` 判定；
- `window.deferCurrentPlayback(cb, delay)` —— 让页面的「缓冲停滞重载」「失败 1 秒重试」也绑到当前选曲上。

**与上游的实现差异（有意为之）**：

- 我们**没有** `restoreOnlineIdentity()` 与 `ProgressManager`（本仓库用 `ConfigManager` 的 `playback.positions.*` + `localState`），所以上游那些 `getPlLast` / `getPlHistory` 调用改写成读 `playback.positions.<歌单>.{currentSong,currentTime,history}`，语义不变；
- 保留我们的 `dataset.trackTitle/Artist/Album`（宽屏桌面面板 `syncDesktopTrackInfo` 在用）；
- MIoT（小爱）分支顺带对齐上游：`highlightSongUI` / `updateNpTitleUI` 挪到 `await` **之前**（点击即时反馈），列表打包推送只在 `autoPlay` 时进行，`await` 之后同样校验 `isCurrent()`；我们保留自己的「✅ 列表已推送到音箱」提示，没有上游的 `FilterManager` 分支。

### C：「自动记忆播放进度」总开关 —— 我们原来的「关闭」其实是关不掉的

上游 v1.3.8 的语义是：

```js
const shouldRemember = prefs.autoResume === true || conf.resumeLocal === 'local' || conf.resumeLocal === 'global';
// 读进度时：不在 shouldRemember 里 → 时间归 0，但**保留歌名**（列表红光定位仍要对）
```

对照我们的改动前实现（`static/player.js`）：

```js
if (targetResumeTime === 0) {                       // ← 没有 resumeLocal 判断
    const savedSong = ConfigManager.get('config', `playback.positions.${window.currentPlaylist}.currentSong`);
    if (savedSong === window.currentSongName) targetResumeTime = ConfigManager.get(...currentTime) || 0;
}
if (targetResumeTime === 0 && plConfig.resumeLocal !== 'off') { ...history 里找... }
```

也就是说：**「关闭本机续播」只关掉了 `history` 那条路，而 `.currentSong/.currentTime` 这条每次都写、每次都读**，用户把歌单设成「关闭续播」后打开歌单依然会跳到上次的秒数。我们写入端（`index.html` 的 `timeupdate`）本身是无条件写 `.currentSong/.currentTime` 的 —— 这次保留「写」（红光定位需要），但把「读」交给总开关。

落地：

- `static/utils.js` 新增 `window.shouldRememberProgress(plName)`（总开关 ∨ 歌单级 `resumeLocal ∈ {local, global}`），默认配置补 `autoResume: false`；
- `static/player.js`：`playSong` 的断点读取、`restoreProgress` 的最终拦截（`if (!sessionRestore && !shouldRemember) targetResumeTime = 0`）都走它；
- `static/index.html`：设置页新增「自动记忆播放进度」开关行；`timeupdate` 写 `history` 的条件从 `resumeLocal !== 'off'` 换成 `shouldRememberProgress()`；`play` 事件清理列表角标的条件同步换；云端回写收紧为**仅 `resumeLocal === 'global'`**（与上游一致，`local`/`autoResume` 没有云端读取方，推上去只是无效写入）。

**与上游的一处刻意差异：会话级恢复豁免。** 上游虽然定义了 `sessionRestore = options.resumeKind === 'session'`，但**他们自己的任何调用点都没传这个参数**（`git grep resumeKind upstream/main` 只有 `player.js` 那一行定义），结果是：切后台/息屏回来、系统回收后重进，即使只是「同一会话内被打断」，也会被总开关清零、从头播。APK 是 WebView 壳，这类打断很常见，体验不可接受，所以我们给 `visibilitychange` 的「被打断后恢复」传了 `{ resumeKind: 'session' }`：

```js
window.playSong(currentIndex, true, window._interruptedTime, { resumeKind: 'session' });
```

跨刷新的「启动定位」（`local_state` / `playlist_tracks` 里的 `startupTime`）**仍按总开关走**，与上游行为一致。

### D：3 处文案（纯对齐，零风险）

| 位置 | 上游 v1.3.8 文案 |
| --- | --- |
| 锁屏歌词 | 在系统锁屏界面，歌曲标题处动态显示当前歌词。 |
| 沉浸氛围背景 | 播放歌曲时，歌词及封面融入背景。 |
| 高性能同步模式 | 极速同步全量曲库。若出现错误，请禁用。 |

### E：`icons.js` 新增图标 —— 不适用

`menu_dots` / `menu_lines` 是给「添加到主屏幕」引导用的常量，但**上游自己的 `index.html` 没有任何引用**（`git grep menu_dots upstream/main` 只命中 `icons.js` 定义处）；我们的引导页一直是内联 SVG。没有可移植的对象。

### F：v1.3.9 移除列表内秒表角标 —— 刻意保留

上游 v1.3.9 把 `time-wrap-*` 的显示逻辑删成无条件 `innerHTML = ''`，即不再在歌曲行里显示「⏱ + 已播时间」。我们的实现是「开了续播（`shouldRememberProgress`）才显示」。**保留理由**：它不影响任何正确性（现在只在真的会记住进度时才显示，反而更准），信息量更大；删掉属于减功能，且用户未提出需求。

---

## 二、实测验证（本机，2026-10-15）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 | `npx tsc --noEmit` | ✅ 通过 |
| 单测 | `npm test` | ✅ 5 文件 / **67** 用例全绿（新增 `tests/playback-race.test.ts` 17 例） |
| 构建 | `npm run build` | ✅ `dist/iwebplayer-s.jsplugin.zip`（版本 `1.3.9-dev`） |
| 断点审计 | `npm run audit:breakpoints -- --strict` | ✅ 未发现跨断点带缺失或不一致 |
| 行尾 / 空白 | `git -c core.whitespace=cr-at-eol diff --check` | ✅ 通过（`utils.js` 纯 CRLF、`index.html` 纯 LF 均保持；`player.js` 混合行尾未被打乱） |
| 内联脚本语法 | 抽取 `index.html` 的 3 个内联 `<script>` 逐个 `node --check` | ✅ 通过 |

**回归测试覆盖的行为**（`tests/playback-race.test.ts`，用 `node:vm` 起最小 DOM 沙盒加载真实 `utils.js` + `player.js`）：

1. 连点两首 = 最后一次点击胜出（两种响应顺序都测）；
2. 过期请求失败：不提示、不标失效、不跳歌，且新歌不被暂停；
3. `B → C → B` 按请求身份判定，而不是歌名/索引；
4. 过期选曲的失败重试被作废（定时器被清 + 残留定时器也不会触发跳歌）；
5. `isCurrentMedia`：选曲中为假 → 直链落地为真 → 再次选曲又为假；
6. 预读缓存的身份校验（过期缓存被丢弃 / 合法缓存命中且不再请求接口）；
7. 过期的普通预读、跨单预读都不会写入/覆盖缓存，`isScouting` 不被错误复位；
8. 待播放的 `loadedmetadata` 监听随下一次选曲被清理；
9. `autoResume` 闸门：关闭时显式续播时间被丢弃、歌单记住的进度不再定位；开启后生效；`resumeKind=session` 不受总开关影响；`resumeLocal=global` 仍读云端进度、`off` 则不读。

> 说明：`index.html` 里 6 个音频监听器的归属守卫**没有**被这组单测直接覆盖（内联脚本不参与 VM 沙盒），仅通过 `isCurrentMedia` 的语义测试间接兜住；这 6 处需要真机/浏览器实测一轮。

---

## 三、本次动作清单

**已做**

1. `static/player.js`：引入 `playbackRequest` 令牌、`pendingPlayback`、`metadataCleanup`、`playbackTimers` / `deferPlayback`、`playbackTrackKey`、`currentMedia`；`playSong` 全程快照（`targetPlaylist` / `selectedList` / `targetSongName`）并在每个 `await` 后校验；`catch` 不再冤枉新歌；`scoutNextSong` / `scoutCrossPlaylistSong` 加 `validScout()` 守卫与曲目身份；导出 `window.isCurrentMedia` / `window.deferCurrentPlayback`。
2. `static/index.html`：6 个音频监听器加 `staleAudioEvent()` 守卫；错误重试与缓冲停滞重载改走 `deferCurrentPlayback`；预读快路径补歌单身份校验；「被打断恢复」传 `{resumeKind:'session'}`；首次点击播放带上 `audioEl.currentTime`。
3. `static/utils.js`：新增 `shouldRememberProgress()`；默认配置补 `autoResume: false`。
4. `static/index.html` 设置页：新增「自动记忆播放进度」开关（默认关）；`timeupdate` 的历史写入与角标显示改走总开关；云端回写收紧为仅 `global`。
5. 3 处偏好文案对齐上游。
6. 版本号 `1.3.7-dev` → `1.3.9-dev`：`plugin.json`、`package.json`、`package-lock.json`(2 处)、`README.md`(badge + 2 处 zip 名 + 1 处陈旧文字)、`DEV_RELEASE_NOTES.md`(标题 + 新条目)、`AGENT.md`(版本表 6 行 + 已发生列表 + 约定 8 交叉引用 + 评估文档清单)。
7. 新增 `tests/playback-race.test.ts`；新建本评估文档；新建 `docs/iWP-S-1.3.9-Dev-记录.md`（约定 11）。

**未做（及原因）**

- 不移植 `icons.js` 的 `menu_dots` / `menu_lines`（上游自己无引用）。
- 不跟随 v1.3.9 删除列表秒表角标（见一、F）。
- 不改 `manifest.json`（CI 维护，禁手工编辑）；不动 CI 的版本 / tag / 构建序号推导逻辑。
- 不照搬上游那两个 `.cjs` 测试（`node:test` 风格，且针对上游 `player.js` 的结构 —— 他们的 `bindPlayerEvents` 在本仓库位于 `index.html`），改为适配本仓库的 vitest 沙盒测试。
- 不调整 `pause` / `visibilitychange` 路径的 `syncToCloud`（仍无条件回写；只有 `resumeLocal === 'global'` 会读云端，属无效但无害写入，留待后续按需清理）。
