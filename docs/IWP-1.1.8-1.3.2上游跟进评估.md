# IWP 1.1.8 ~ 1.3.2 上游跟进评估

- 对比日期：2026-09-12
- 上游仓库：[songloft-org/songloft-plugin-iwebplayer](https://github.com/songloft-org/songloft-plugin-iwebplayer)
- 上游对比范围：`v1.1.7...v1.3.2`（共 5 个发布）
- 本地仓库：`songloft-plugin-iwebplayer-S`
- 本地基线：`dev` / `1.1.7-dev`

## 结论

**可以适配，但不能合并或 cherry-pick，只能按功能手工移植。**

理由：本地在 `v1.1.6` 之后已大幅分叉（`index.html` 相对上游 `v1.1.7` 已相差 1194 增 / 196 删，`player.js` 281 增 / 163 删，`src/main.ts` 263 增 / 88 删），并且上游 `v1.1.8` 还做了一次结构性重构（把 10 个函数从 `index.html` 搬进 `static/player.js`），本地并未跟。上游后续每个版本都在改这些已经分叉的文件，直接同步必然产生大量冲突。

但上游这 5 个版本的**新功能大多是自包含的**（新增函数、新增弹窗、新增后端接口），其中「音箱倍速/进度拖拽」「落雪 3.7.8 音质设置」「歌单过滤」「自定义封面」这四项本地完全是空白，移植性价比很高。

## 上游五个版本的改动

| 版本 | 日期 | 主题 | 主要改动文件（新增/删除行） |
| --- | --- | --- | --- |
| v1.1.8 | 2026-09-02 | 适配 webdav 1.2.0；新增后台定时扫描；私网地址自动加入白名单（代理模式） | `src/webdav.ts` +152/-8、`src/main.ts` +74/-2、`static/online.js` +230/-12、`static/player.js` +349/-11、`static/playlist.js` +234/-220、`static/utils.js` +61/-10、`static/index.html` +165/-405 |
| v1.2.0 | 2026-09-04 | 适配落雪音乐 v3.7.8（音质选择重写）；补全自定义封面 | `static/index.html` +336、`static/plugins.js` +69、`static/utils.js` +14 |
| v1.3.0 | 2026-09-08 | 新增歌单歌曲过滤筛选（本地 / 在线） | `static/utils.js` +103（`FilterManager`）、`static/index.html` +136、`static/online.js` +64、`static/plugins.js` +10 |
| v1.3.1 | 2026-09-09 | 修复过滤后推送音箱只能单曲循环；推送歌单改为内存注入；虚拟时钟防回滚 | `static/miot.js` +86、`src/main.ts` +49、`static/player.js` +57 |
| v1.3.2 | 2026-09-11 | 补上音箱倍速与进度拖拽；调整本机播放在线歌单 | `static/player.js` +290、`static/miot.js` +112、`static/index.html` +92 |

`v1.1.8` 的 `index.html` 是 165 增 / **405 删**：删除部分是代码搬家，被移出的函数为 `playNextSong`、`playPrevSong`、`updateFpSpeedUI`、`syncToCloud`、`handleDragMove/Move/End`、`getPercentage`、`getCrossPlaylistInfo`、`jumpToCrossPlaylist`，它们在 `static/player.js` 等文件中重新出现。本地这些函数目前仍留在 `index.html` 内（各 1 处），说明本地没有跟进这次重构。

## 本地分叉度量（本地 vs 上游）

| 文件 | 本地行数 | 上游 v1.1.7 | 相对 v1.1.7 差异 | 相对 v1.3.2 差异 | 移植难度 |
| --- | --- | --- | --- | --- | --- |
| `static/online.js` | 1502 | 1497 | 49+/44- | 82+/311- | 低 |
| `static/plugins.js` | 290 | 290 | 7+/7- | 12+/79- | 低 |
| `static/miot.js` | 675 | 643 | 45+/13- | 69+/183- | 低~中 |
| `static/utils.js` | 417 | 371 | 51+/5- | 60+/182- | 低~中 |
| `static/playlist.js` | 1744 | 1567 | 229+/52- | 440+/287- | 中 |
| `static/player.js` | 914 | 795 | 281+/163- | 342+/692- | 高 |
| `static/index.html` | 4923 | 3924 | 1194+/196- | 1604+/862- | 高 |
| `src/main.ts` | 630 | 455 | 263+/88- | 265+/181- | 高 |
| `src/webdav.ts` | 266 | 165 | 152+/51- | 160+/203- | 高 |
| `static/lyrics.js` | 1219 | 230 | 1219+/230- | 同左（上游未动） | 不适用 |

本地 `lyrics.js`（逐字歌词 KTV 引擎）是本地独有的大改，上游这 5 个版本没有触碰该文件，因此不会产生冲突。

## 分项适配评估

| 上游特性 | 引入版本 | 本地现状 | 适配难度 | 建议 |
| --- | --- | --- | --- | --- |
| 音箱倍速 `setSpeed` / 进度拖拽 `seekTo` | v1.3.2 | 完全没有；且本地在 miot 模式下显式禁用了进度条拖拽（`body.miot-mode .progress-container { pointer-events: none }`） | 低（新增函数）+ 必须同步放开拖拽 | **P0 移植** |
| 虚拟时钟防回滚水位线 `_maxEstPos`、暂停时重置 `lastWsTime` | v1.3.1 | 本地有 `lastWsPos` / `lastWsTime` / `isWsPlaying`，但没有 `_maxEstPos` / `_seekLockTime` | 低 | **P0 移植**（`seekTo` 依赖它，否则进度会回弹） |
| 落雪音乐 3.7.8 音质设置重写 | v1.2.0 | 仍是 1.1.7 写法：直接 `localStorage.setItem('iwebplayer-s.lx_quality', ...)`，没有 `ConfigManager` 统一存储，也没有 `compareVersion(version, '3.7.8')` 版本校验 | 低（`plugins.js` 几乎未分叉） | **P0 移植** |
| 歌单歌曲过滤筛选 `window.FilterManager` | v1.3.0 | 完全没有 | 低~中（`utils.js` 分叉小，UI 需要在本地 `index.html` 重新落位） | **P1 移植** |
| 自定义封面弹窗（`set-cover-*`） | v1.2.0 | 没有实现，仅帮助文案里提到 | 中（主要是 `index.html` UI + 上传逻辑） | **P1 移植** |
| 本机播放在线歌单：`window.restoreOnlineIdentity` | v1.3.2 | 没有；本地 `player.js` 有自己的封面/歌词兜底与 MIoT 分支 | 中~高（`player.js` 分叉最大） | **P2 手工移植** |
| 推送歌单改为内存注入（不再全量 `reloadGlobalData`） | v1.3.1 | 本地已有另一套实现：`_pushPlaylistSignature` 同列表复用 + `playlistMeta` 存在性校验，且仍调用 `reloadGlobalData()` | 中（两套思路需合并，不能照抄） | **P2 设计后合并** |
| WebDAV 1.2.0 适配 + 后台定时扫描 + 私网白名单 | v1.1.8 | `src/webdav.ts` / `src/main.ts` 已大幅本地化；本地没有 `updateWebDavIntervalUI` / `isPrivateIP` / `checkAndPatchProxyAllowlist` | 高（且依赖宿主 webdav 插件版本） | **P3 先验证宿主版本** |
| 上游 `index.html` 结构重构（函数搬入 `player.js`） | v1.1.8 | 本地未跟，函数仍在 `index.html` | 高、收益低 | **不建议跟** |
| `DELETE /store` 物理删除广播（`type: 'delete'`） | v1.3.1 | 本地 `src/main.ts` 没有 `DELETE /store` 路由；`/store` 只有 GET / POST | 低（但需确认前端是否依赖） | **P2 评估后补** |
| 保活机制改为「启动即打卡 + 每日续期」 | v1.3.1 | 本地 `src/` 内完全没有 `keep_alive` / `keepAlive` 实现 | 低 | **P2 移植** |
| 发布元数据（版本号 / download_url） | 全部 | 本地使用 `1.1.7-dev` 与构建注入，`dev` / `main` 各自发布 | 不适用 | **不要跟** |

## 前置条件与风险

1. **音箱倍速 / 进度拖拽依赖宿主「智能音箱」插件提供 `POST /api/v1/jsplugin/miot/player/speed` 与 `/player/seek`。** 上游只改了前端调用，插件清单里没有声明依赖版本。移植前必须先确认当前宿主 miot 插件是否已实现这两个接口，否则功能会静默失败。
2. **本地 miot 推送歌单名与上游不同**：本地为 `iWebPlayer-S推送`，上游为 `iWebPlayer推送`。上游 v1.3.1 的内存注入逻辑直接按名字过滤并追加，套用到本地会与本地复用逻辑冲突，必须重写为本地命名与本地缓存结构。
3. **过滤筛选会改变 `songList` 长度**，与本地的「虚拟列表打包推送音箱」直接相关：过滤后推送的应当是过滤结果。上游 v1.3.1 修的正是这个问题（过滤后推送只单曲循环），移植过滤功能时必须一并回归该项。
4. **WebDAV 1.2.0 适配与宿主版本强耦合**：若宿主 webdav 插件尚未到 1.2.0，移植后端改动会直接造成接口不兼容。
5. **进度条拖拽放开后需回归**：本地 `body.miot-mode` 目前强制 `pointer-events: none` 并隐藏滑块，放开时要同时处理本机播放与音箱播放两种设备模式，避免误触发本机 seek。

## 建议实施顺序

1. **P0（低风险、体验提升明显）**
   - `static/miot.js`：移植虚拟时钟防回滚（`_maxEstPos`、暂停重置 `lastWsTime`）；
   - `static/miot.js`：移植 `setSpeed` / `seekTo`，并放开 miot 模式下的进度条拖拽（含滑块显示与拖拽节流）；
   - `static/plugins.js` + `static/utils.js`：移植落雪 3.7.8 音质设置重写（`ConfigManager` 统一存储 + 版本校验）。
2. **P1（独立新功能）**
   - 移植 `window.FilterManager` 与本地/在线过滤 UI，并回归「过滤后推送音箱」；
   - 移植自定义封面弹窗。
3. **P2（需要专项设计）**
   - `restoreOnlineIdentity`（本机播放在线歌单）；
   - 推送歌单内存注入与本地复用逻辑合并；
   - 补 `DELETE /store` 物理删除广播与保活机制（先确认前端与宿主行为）。
4. **P3（先验证宿主版本）**
   - WebDAV 1.2.0 / 后台定时扫描 / 私网白名单。

## 相关本地位置

- `static/miot.js`：设备状态、虚拟时钟、`playPlaylist`、`syncListToPushPlaylist`。
- `static/index.html`：`body.miot-mode` 进度条禁用规则、底部播放条、封面/封面弹窗位置、过滤 UI 落位处。
- `static/player.js`：`playSong` MIoT 分支、封面与歌词兜底、在线身份复原接入点。
- `static/plugins.js`：落雪音质设置写入口。
- `static/utils.js`：`getLxQuality` / `getBestLxQuality` / `ConfigManager`，`FilterManager` 落位处。
- `src/main.ts`：`/store`、`/musiclist`、`/scrape` 路由与插件间通信。

## 最终判断

上游 `v1.1.8 ~ v1.3.2` 中，**音箱倍速/进度拖拽、虚拟时钟防回滚、落雪音质设置重写**三项属于低风险高收益，建议优先移植；**歌单过滤、自定义封面**可作为独立功能跟进；**本机播放在线歌单、推送歌单内存注入、WebDAV 1.2.0 与后端路由/保活**需要结合本地实现与宿主版本单独设计。上游 `v1.1.8` 对 `index.html` 的结构性重构不建议跟进，代价大于收益。

---

# P0 实施记录（2026-09-12）

按本评估的 P0 清单完成上游适配，遵循「只做增量、不影响现有功能」，未合并、未 cherry-pick，全部为手工移植。

## 版本号

`plugin.json` / `package.json` / `package-lock.json` 由 `1.1.7-dev` 提升为 `1.3.2-dev`（dev 规范为 `X.Y.Z-dev`，CI 会派生构建号 `1.3.2.NN-dev` 与 tag `dev-1.3.2`）。`README.md`、`AGENT.md`、`DEV_RELEASE_NOTES.md` 同步为 `v1.3.2`。`static/index.html` 的 `APP_VERSION` 是构建期占位符 `__APP_VERSION__`，由 `scripts/inject-version-hashes.mjs` 注入，无需手改。

## 1. 虚拟时钟防回滚（`static/miot.js`）

- 新增状态：`lastWsSpeed`、`_seekLockTime`、`_maxEstPos`。
- 虚拟时钟刻度加入 `_maxEstPos` 最高水位线：倒退在 2 秒以内判定为推送滞后并稳住不动，倒退较多（拖拽 / 切歌）才允许重置。
- 暂停恢复播放时把 `lastWsTime` 锚点拉到此刻，避免暂停期间的时间差被计入进度。
- 切歌（`playPlaylist`）与音箱侧切歌时重置水位线。
- 补齐此前"设置了却从未读取"的 `_stateLockTime` 状态锁：点击播放/暂停后 4 秒内维持用户目标状态，忽略滞后的 WS 推送。
- 拖拽期间（`window.isDragging`）虚拟时钟与暂停定格都不覆写界面。

## 2. 音箱倍速与进度拖拽

- `static/miot.js` 新增 `setSpeed(speed)` 与 `seekTo(position)`，分别调用 MIoT 插件 `POST /api/v1/jsplugin/miot/player/speed` 与 `/player/seek`；`seekTo` 做乐观更新并上锁 3 秒防回弹。
- `static/miot.js` 的 `syncUIWithMiotStatus` 记录 `data.speed` 用于进度推算（倍速播放时歌词不再越跑越慢），并在用户未操作倍速面板/配置弹窗时同步倍速 UI。
- `static/index.html`：
  - 移除 `body.miot-mode` 下"进度条置灰 + 禁用拖拽"的三条规则；
  - 拖拽逻辑改用全局 `window.isDragging`，新增 `getActiveDuration()`（音箱模式取 WS 上报时长，本机模式取 `audio.duration`），`handleDragEnd` 按设备分流到 `MiotManager.seekTo()` 或 `audioEl.currentTime`；
  - 新增 `debounceSendSpeed()`（2 秒防抖下发 + UI 霸体锁）与 `getSafeSpeed()`（音箱上限 2.0x），倍速滑杆与加减按钮统一走这套流程；
  - 配置弹窗保存时，音箱模式下立即下发倍速，并同步刷新 UI 显示。

## 3. 落雪 v3.7.8 音质设置重写

- `static/utils.js` 新增 `window.compareVersion()`（`parseInt` 容忍 `3.7.8-beta` 之类后缀，避免 `Number()` 产生 `NaN` 导致比较失效）。
- `static/plugins.js` 音质单选改为：
  - 写入统一沙盒 `ConfigManager.set('lxmusic', 'settings.quality', ...)`（`getLxQuality()` 读的正是这里）；此前只写 `iwebplayer-s.lx_quality`，**该 key 无人读取，等于音质设置一直不生效**，本次一并修复，并保留旧 key 作后向兼容镜像；
  - 洛雪 3.x 且 `>= 3.7.8`：拉取 `/api/v1/jsplugin/lxmusic/api/settings` → 修改 `enablePlayQuality/playQuality/enableHostQuality/hostQuality` → 全量回写；
  - 洛雪 3.x 但低于 3.7.8：显示警告并拦截，不发请求；
  - `2026.x` / `2.x`：隐藏警告并按原行为提示成功。

## 4. 依赖与风险提示

- `player/speed` 与 `player/seek` 由宿主「智能音箱」插件提供；若宿主插件版本不支持这两个接口，倍速/拖拽会静默失败（`fetch` 抛错已在 `miot.js` 内 `catch` 并打印 `console.warn`），不影响本机播放与音箱换歌。
- 未跟进项保持不变：上游 v1.1.8 的 `index.html` 函数搬家、推送歌单内存注入（本地保留 `_pushPlaylistSignature` 复用方案）、`restoreOnlineIdentity`、WebDAV 1.2.0 相关改动。

## 5. 验证

- `vitest run`：4 个测试文件 / 50 项用例全部通过；
- `npx tsc --noEmit`：无错误；
- `npm run build`：构建成功，产物 `dist/iwebplayer-s.jsplugin.zip`；
- `miot.js` / `plugins.js` / `utils.js` / `player.js` / `playlist.js` 语法检查通过，`index.html` 内联脚本 2 段语法检查通过，CSS 花括号配平；
- `git -c core.whitespace=cr-at-eol diff --check` 通过（CRLF 文件均使用字节级替换，无换行污染）。
