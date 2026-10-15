# iWP-S 1.3.9 Dev 记录

> **本文件约定**：同一大版本（`1.3.9`）内的**所有改动都记在这里**。每条用三级标题 `### <构建号>-Dev　<提交短哈希>　　<类型标签>`，
> 下面依次 `**概述**：` / `**用户需求**：` / `**改造思路**：`，末行引用式元信息（日期 ｜ 提交 ｜ 文件）。
> 类型标签：`⚙️ 功能` · `✅ 布局` · `🎨 外观` · `🐞 修复` · `🚀 性能·构建` · `🏗 重构` · `🧪 工具` · `♻️ 回退` · `📄 文档`。
> 1.3.7 及更早见 `iWP-S-1.3.7-Dev-记录.md`；上游跟进评估见 `IWP-1.3.7-1.3.9上游跟进评估.md`。

## 速查索引

| 构建 | 提交 | 概述 | 类型 |
| :--: | :--: | --- | --- |
| 1 | `f2ea0b2` | 跟进上游 v1.3.8/v1.3.9：播放竞态修复（上一次选曲的全部异步工作随新选曲作废）+ 预读缓存身份校验 + 「自动记忆播放进度」总开关（默认关）+ 3 处文案；base 升到 1.3.9-dev | 🐞 修复·跟进上游 |

> 共 **1** 条改动。

---

## 阶段 1 · 跟进上游 v1.3.8 / v1.3.9

### 1.3.9.01-Dev　f2ea0b2　　🐞 修复·跟进上游

**概述**：跟进上游 v1.3.7 → v1.3.9 —— 移植**播放竞态修复**（连点切歌播错歌 / 旧请求失败冤枉新歌 / 过期预读误命中 / 幽灵定时器跨歌误伤，四类症状一次解决）、新增**「自动记忆播放进度」总开关**（默认关闭，让「关闭续播」真的关闭）、对齐 3 处设置项文案；base 版本提升为 `1.3.9-dev`

**用户需求**：「上游更新了，看看需要适配吗」→ 逐项评估后确认范围「①竞态修复 + ②autoResume 总开关 + ④文案」全量跟进（③v1.3.9 移除列表秒表角标选择保留，⑤icons 新增不适用）。

**改造思路**：
- **①播放竞态修复**（上游 `640b2c5` + `50afa42`，PR #10）——我们改动前的代码与上游同源、同样没有「请求身份」：
  - `static/player.js` 引入 `playbackRequest` 令牌 + `pendingPlayback` + `metadataCleanup` + `playbackTimers`/`deferPlayback`/`playbackTrackKey`/`currentMedia`，并导出 `window.invalidatePlaybackRequest()`；`playSong` 改为全程快照（`targetPlaylist` / `selectedList` / `targetSongName`），每个 `await`（打包推送、取直链、云端 `./sync`）之后校验 `isCurrent()`；`catch` 不再用**实时**的 `window.currentIndex` 标失效，重试定时器改挂令牌；DAV 8 秒硬超时改走 `deferPlayback`；`restoreProgress` 补 `Number.isFinite()` 与 `< duration` 守卫并登记 `metadataCleanup`；
  - 预读缓存增加 `playlist` + `trackKey`（`plugin_entry_path`/`id`/`dedup_key`），`scoutNextSong` / `scoutCrossPlaylistSong` 加 `validScout()`，过期预读一律丢弃、不覆盖更新的缓存，`isScouting` 不被错误复位；
  - 我们的音频监听器在 `index.html` 内联脚本里（上游在 `player.js`），故额外导出 `window.isCurrentMedia(audioEl)` 与 `window.deferCurrentPlayback(cb, delay)`，给页面里的 6 个监听器（play/playing/pause/error/timeupdate/ended）包一层 `staleAudioEvent()` 归属守卫；预读快路径（`playNextSong` / `btnNext`）补歌单身份校验；
  - MIoT 分支顺带对齐上游：`highlightSongUI` / `updateNpTitleUI` 提到 `await` 之前（点击即时反馈），列表打包只在 `autoPlay` 时进行；保留我们自己的 `dataset.trackTitle/Artist/Album`（宽屏桌面面板在用）与「✅ 列表已推送到音箱」提示（本仓库无 `FilterManager`）。
- **②「自动记忆播放进度」总开关**（上游 `4f82025`，默认**关闭**）：
  - 新增 `window.shouldRememberProgress(plName)` = `autoResume ∨ resumeLocal ∈ {local, global}`，默认配置补 `autoResume: false`；
  - **修掉一处原有 bug**：改动前 `playSong` 读 `playback.positions.<歌单>.currentSong/currentTime` 是**无条件**的（只有 `history` 那条路受 `resumeLocal` 管），所以把歌单设成「关闭本机续播」后，打开歌单依然会跳到上次的秒数 —— 现在「读」全部走总开关，写入端保留（列表红光定位需要）；
  - 云端回写收紧为**仅 `resumeLocal === 'global'`**（与上游一致；`local`/`autoResume` 没有云端读取方）；
  - 设置页新增开关行；`timeupdate` 的历史写入与列表角标显示、`play` 事件的角标清理同步改判据；
  - **与上游的一处刻意差异**：会话级恢复豁免 —— 上游定义了 `sessionRestore = options.resumeKind === 'session'` 但**自己没有任何调用点**（`git grep resumeKind upstream/main` 只命中定义行），会导致切后台/息屏回来也被清零从头播；APK 是 WebView 壳、这类打断很常见，故给 `visibilitychange` 的「被打断恢复」传了 `{ resumeKind: 'session' }`（跨刷新的启动定位仍按总开关走）。
- **③文案**：锁屏歌词 / 沉浸氛围背景 / 高性能同步模式 三处描述与上游对齐。
- **刻意不跟 / 不适用**：上游 v1.3.9 删除列表内「秒表 + 已播时间」角标 → 我们保留（只在真的会记住进度时显示，信息量更大，不影响正确性）；上游新增的 `icons.js` `menu_dots` / `menu_lines` → 上游自身零引用、我们的引导页是内联 SVG，无对象可移植。
- **回归测试**：新增 `tests/playback-race.test.ts`（17 例），用 `node:vm` 起最小 DOM 沙盒加载**真实**的 `utils.js` + `player.js`，把「最后一次点击胜出（两种响应顺序）」「过期失败不提示/不标死/不跳歌」「B→C→B 按身份判定」「过期重试被作废」「预读身份校验」「`loadedmetadata` 监听随选曲清理」「autoResume 闸门（关/开/session/global/off）」全部钉住。上游那两个 `.cjs`（`node:test` + 针对他们 `player.js` 的结构）未照搬。
- **版本号**：按约定 8 跟随上游把 base 提到 `1.3.9-dev`（跳过 `1.3.8`，两版一次跟进），同步 `plugin.json`、`package.json`、`package-lock.json`(2 处)、`README.md`(badge + 2 处 zip 名 + 1 处陈旧文字)、`DEV_RELEASE_NOTES.md`(标题 + 新条目)、`AGENT.md`(版本表 6 行 + 已发生列表 + 约定 8 交叉引用 + 评估文档清单)。

> `2026-10-15` ｜ `fix(playback): follow upstream v1.3.8/v1.3.9 (playback race fix + autoResume); bump base to 1.3.9-dev` ｜ 文件：`static/player.js`、`static/index.html`、`static/utils.js`、`tests/playback-race.test.ts`、`plugin.json`、`package.json`、`package-lock.json`、`README.md`、`DEV_RELEASE_NOTES.md`、`AGENT.md`、`docs/IWP-1.3.7-1.3.9上游跟进评估.md`
>
> 验证：`npx tsc --noEmit` ✅｜`npm test` ✅（5 文件 / 67 用例）｜`npm run build` ✅（版本 `1.3.9-dev`）｜`npm run audit:breakpoints -- --strict` ✅｜`git -c core.whitespace=cr-at-eol diff --check` ✅｜`index.html` 三个内联 `<script>` 逐个 `node --check` ✅
>
> 行尾：`index.html` 保持纯 LF、`utils.js` 保持纯 CRLF、`player.js` 混合行尾未被打乱（全部字节级替换）。
>
> 待实测：`index.html` 里 6 个音频监听器的归属守卫不在单测覆盖范围内（内联脚本不参与 VM 沙盒），需真机 App + 浏览器各跑一轮（连点切歌、切后台回来、WebDAV 直连停滞重载、小爱推送）。
>
> 未动：`manifest.json`（CI 维护）、CI 的版本 / tag / 构建序号逻辑、`pause`/`visibilitychange` 路径的 `syncToCloud`（仅 `global` 会被读取，属无效但无害写入）。
