# iWebPlayer-S 优化记录

## 1. 项目背景

本项目基于原始 `iWebPlayer` SongLoft 插件进行独立适配，项目名称、插件入口、接口路径和本地存储命名空间均改为 `iWebPlayer-S` / `iwebplayer-s`，用于与原插件并行安装，避免覆盖或影响原版 `iwebplayer`。

感谢原作者 `birdstudy-nj` 提供 iWebPlayer 的基础实现、交互设计和功能框架。本版本仅在独立命名空间内进行适配和优化，原有播放、歌单、歌词、封面、倍速、续播、LXMusic、WebDAV 及小爱音箱相关能力保持兼容目标。

## 2. 需求整理

### 项目区分

- 项目名称改为 `iWebPlayer-S`。
- 插件入口改为 `iwebplayer-s`。
- API 路径和 localStorage 命名空间改为 `iwebplayer-s`。
- 打包文件为 `dist/iwebplayer-s.jsplugin.zip`，避免安装到 SongLoft 后与原版冲突。

### 横屏与播放器

- 手机竖屏保持原有单栏体验。
- 平板、横屏设备和桌面浏览器使用左右双栏首页：左侧封面、歌词和播放控制，右侧曲库列表。
- 首页双栏按视口比例适配，宽屏不再固定为 960px；`768px` 以上横屏设备启用适配，桌面宽屏继续使用相同结构。
- 播放页显示当前歌曲标题、歌手、专辑和封面，右侧显示动态歌词。
- 首页封面可点击进入播放页，播放页封面可点击返回首页。

### 控制区与视觉层级

- 首页底部进度和控制区域压缩高度，减少对歌词的遮挡。
- 进度控制区增加半透明、带圆角的遮罩，使歌词、歌曲信息和控制按钮分层显示。
- 收藏和倍速控件在首页控制面板内显示，并在进入播放页时恢复到播放页控件层。
- 首页封面、首页歌词和播放页歌词分别使用适合其布局的尺寸。

## 3. 实现过程与问题修复

### 3.1 固定宽度导致的首页留白

原始桌面 CSS 在 `600px` 以上将 body 和播放器固定为 `480px`，在 `960px` 以上再固定为 `960px` 双栏。该规则会在大屏两侧产生留白，因此增加了响应式双栏覆盖：左、右区域各占视口 `50%`，背景和顶部栏铺满视口。

### 3.2 播放页被 split-view 状态拦截

原始播放器在检测到 `split-view-active` 时会提前返回，导致宽屏无法进入沉浸播放页。该限制已解除，打开播放页时隐藏曲库并切换为全屏左右布局。

### 3.3 歌曲信息显示“暂无播放”

播放器元数据曾在底部播放条更新之前同步，因而读到旧状态。现在同步顺序调整为：

1. 从当前列表、实际 audio 状态和播放标题解析曲目。
2. 更新底部播放标题。
3. 再同步桌面标题、歌手和专辑。

同时为 audio 写入当前播放歌名、标题、歌手和专辑数据，解决切换歌单或恢复播放时索引不一致的问题。

### 3.4 歌词区域塌陷或不更新

歌词容器使用绝对定位，原布局在宽屏下可能没有有效高度。现在为宽屏歌词区设置了明确高度、最小高度和 overflow，并在打开播放器及歌词解析后同步当前播放时间。

### 3.5 控件被遮罩覆盖

将收藏和倍速控件从首页播放容器移动到首页底部控制面板内部；进入播放页时再移回播放容器。这样遮罩可以覆盖歌词，但不会覆盖这两个按钮。播放器脚本查询版本同步递增，避免宿主继续使用旧缓存。

### 3.6 横屏断点补齐

最初双栏只在 `960px` 启用，导致 `768–959px` 的横屏平板仍使用手机宽度。当前已将自动分栏断点下移到 `768px`，并补齐该区间的宽度、定位、歌词、封面和控制条规则。

## 4. 当前适配范围

| 设备/环境 | 适配状态 |
| --- | --- |
| iPhone Safari 竖屏 | 保持原有单栏播放体验 |
| iPhone Safari 横屏 | 使用宽屏规则，具体效果取决于 viewport 宽度 |
| iPad / Android 平板横屏，viewport `>=768px` | 左右双栏首页、宽屏歌词和播放页 |
| 桌面 Chrome / Edge / Safari，viewport `>=960px` | 左右双栏首页、宽屏歌词和播放页 |
| Android Edge PWA 安装 | 安装入口已保留，但是否触发浏览器安装事件取决于 HTTPS、Service Worker、manifest 和浏览器安装条件 |

## 5. 验证记录

已执行：

- 所有 `static/*.js` 通过 `node --check`。
- 内联脚本通过 `new Function` 语法解析。
- `npm run build` 构建成功。
- 使用 JSZip 检查最终 zip 中包含响应式 CSS、播放器元数据同步和控件重挂载逻辑。
- 通过模拟 DOM 验证从底部播放标题回填桌面标题和歌手。

当前环境没有可用 Chromium/Firefox，且 `songloft-plugin dev` 启动需要登录用户名，因此无法在本机完成真实 SongLoft 浏览器截图测试。`npm run validate` 仍会因为源 `plugin.json` 的 `entryHash`/`zipHash` 为空而失败；构建生成的 `dist/iwebplayer-s.jsplugin.zip` 已包含构建哈希，这是当前工具链的既有行为。

## 6. 构建

```bash
npm install
npm run build
```

构建产物：`dist/iwebplayer-s.jsplugin.zip`。

## 7. Android 壳 App 与发布流水线（2026-08 追加）

### 7.1 背景与方案

局域网（HTTP）环境下 PWA 无法安装，为获得"类原生 App"体验，采用 **WebView 壳方案（方案 A）**：APK 不打包前端资源，直接加载
`http://<服务器>/api/v1/jsplugin/iwebplayer-s/static/index.html`，因此：

- 局域网 HTTP 无需 HTTPS 即可安装使用；
- 服务器更新插件后，App 打开即为最新页面，无需重装 APK；
- 相对路径 API、登录 token 均沿用服务器同源环境，无需改造插件前端。

### 7.2 登录与鉴权

- 首页设置页直接登录：协议下拉（http/https，默认 http）+ 服务器地址（默认 `192.168.100.100`）+ 端口（默认 `58091`）+ 账号/密码 + 协议勾选；
- 后端接口：`POST /api/v1/auth/login`（`{username,password}`）返回 `access_token/refresh_token/expires_in`；刷新用 `POST /api/v1/auth/refresh`（`{refresh_token}`）；
- token 存于 SharedPreferences，插件页加载完成后注入 `localStorage['songloft-auth']`（首次注入自动 reload 一次）；
- 令牌临近过期后台静默刷新；页面内注入脚本检测"登录状态已失效"时自动尝试刷新并重载，刷新失败清除凭据回到设置页；
- 移除了启动时误弹的原生"需要登录"弹窗：有凭据时永不弹窗，登录引导由页面内检测 + 设置页完成。

### 7.3 通知栏 / 锁屏媒体控制

- 原生 `MediaSessionCompat` + `MediaStyle` 通知：标题/歌手/封面/进度、播放/暂停/上一首/下一首/拖动；
- 注入 JS 桥接轮询 `#audio` 与插件 UI（`#time-current` / `#time-duration`）上报状态，`audio.duration` 非有限值时用界面时间文本兜底；
- 关键修复：必须设置 `MediaMetadataCompat.METADATA_KEY_DURATION`，否则系统显示 `--:--` 且进度条不动；
- Android 13+ 需运行时申请 `POST_NOTIFICATIONS`，否则通知/锁屏不显示；
- `androidx.media` 的兼容类位于 `android.support.v4.media.*` 命名空间（非 `androidx.media.*`），导入时注意。

### 7.4 关键问题修复记录

- **WebView 缓存旧页面**：`setCacheMode(LOAD_NO_CACHE)` + 启动 `clearCache(true)`，保证插件更新即时生效；
- **分栏箭头（>）**：点击从"切换分栏"改为"进入播放页"（与点击封面一致）；长按 600ms 仍可关闭分栏退出宽屏；
- **底部控制栏间距**：≥960px 与 768–959px 分支统一采用"左栏 50% + 控制栏 `padding-right: 28px`"，竖线保持在 50% 位置（曾尝试左栏收窄留中缝，导致竖线偏左、网页端回归，已撤销）；
- **`media` 依赖类包名**：`MediaStyle` 在 `androidx.media.app`，会话/元数据兼容类在 `android.support.v4.media*`；
- **启动误弹登录框**：删除原生登录弹窗及对应布局资源，改为页面内检测 + 设置页登录。

### 7.5 CI 发布流水线

- `.github/workflows/build-apk.yml`：推送 `android/**` 或 workflow 改动时自动构建；
  - 版本解析：无 release 从 `v0.0.1` 起，之后自动 patch+1（可手动指定）；
  - 固定签名：PKCS12 keystore 存于 GitHub Secrets（`ANDROID_KEYSTORE_BASE64` / `ANDROID_KEYSTORE_PASSWORD`），本地备份在 `android/keystore.properties`（已 gitignore），签名稳定可覆盖安装；
  - 同一工作流内先 `npm ci && npm run build` 产出插件 zip，与 APK 一起发布到同一 Release；
  - 构建后 `apksigner verify --print-certs` 校验签名。
- `.github/workflows/build-plugin.yml`：插件源码改动时构建 `iwebplayer-s-v1.1.3.jsplugin.zip`（SongLoft 可直接上传安装，无需解压）。
- 注意：强推重写历史后 GitHub 不会自动触发 push 工作流，需手动 `workflow_dispatch` 一次。

### 7.6 品牌与 Logo

- 插件作者、仓库归属改为 `MbAIGC`；全部历史提交通过 `filter-branch` 重写为 `MbAIGC <314928345+MbAIGC@users.noreply.github.com>`；
- README 重写并着重致谢原作者 birdstudy-nj（不列入贡献者，避免歧义）；
- `plugin.json` 补充 `homepage` / `updateUrl` / `download_url`（指向 GitHub Release）；
- About 弹窗：项目主页改为可点击外链（App 内用系统浏览器打开），新增"适配的宽屏设备"说明；
- Logo：网页端使用透明角 RGBA 版本（深浅色均可适配）；APK 桌面图标按用户偏好使用原图满幅版。

### 7.7 已知限制

- 首次从旧 debug 签名版升级到固定签名版需卸载一次（一次性）；
- 插件页在 WebView 内打开外链依赖 `WebChromeClient.onCreateWindow` 转发系统浏览器；
- 强推/历史重写不会触发 Actions，需手动触发一次。

## 8. 首页间距问题最终方案（2026-08 追加）

### 8.1 问题背景

分栏（split-view）首页底部控制栏与右侧歌曲列表之间的间距反复调整未达预期，先后尝试过：

- 左栏收窄留中缝（`calc(50% - 24px)`）——竖线偏左、网页端回归，已废弃；
- 悬浮卡片内缩（`left:12px; right:28px`）——效果不佳，已废弃；
- `player-bar` 右内边距 `10px`——不满足，已回退为 `28px`。

### 8.2 最终方案（与参考版 `index-by-gpt5.6-t.html` 对齐，已验证通过）

1. `@media (min-width: 600px)` 下 `html` 滚动行为：
   `overflow-y: scroll; scrollbar-gutter: stable` → `overflow-y: auto; scrollbar-gutter: auto`；
2. `@media (min-width: 768px)` 下 `.player-bar::before` 悬浮卡片右缘：
   `right: 0` → `right: 10px`（卡片右侧留出 10px 空隙）；
3. 保留 `player-bar` 右内边距 `padding-right: 28px`（≥960px 与 768–959px 两条分支一致）。

### 8.3 验证结论

- 仓库 `static/index.html` 与参考版 `截图参考/index-by-gpt5.6-t.html` **逐字节一致**（`diff` 无差异）；
- 插件重建后（`iwebplayer-s-v1.1.3.jsplugin.zip`）网页端与 App 端首页间距均正常；
- 结论：以"滚动条自适应 + 底部卡片右缘 10px 内缩 + 控制栏 28px 内边距"组合作为最终方案存档。

## 9. 后续修复记录（2026-08-17 追加）

### 9.1 1080p 分栏下歌曲列表未铺满

- 根因一：`@media (min-width: 960px)` 分支仍是"固定 960px 居中"布局，1920px 屏幕上右栏只占中间区域；
- 修复：≥960px 分支改为全宽 50/50（与 768–959px 分支一致），顶栏 100%、左栏/右栏各 50%、分栏按钮居中、Toast 移到 75%；
- 根因二：`.playlist` 基础样式 `max-width: 800px` 未被分栏规则覆盖，1920px 下右栏 50%（960px）被卡回 800px，右侧空出 160px；
- 修复：两条分栏分支均加 `max-width: none !important`。

### 9.2 SongLoft 插件列表不显示 Logo

- 根因：`static/icon.svg` 之前是"SVG 内嵌 base64 PNG"的伪矢量，SongLoft 客户端（Flutter/WebF）不支持渲染 SVG 内嵌位图；
- 修复：用与原版同款 imagetracer.js 将 logo 转为**纯 `<path>` 矢量 SVG**（192×192，无内嵌图片），根目录 `logo.svg` 同步替换；`plugin.json` 的 `"icon": "icon.svg"` 不变。

### 9.3 补充 lz-string.min.js

- `index.html` 一直引用 `./static/lz-string.min.js`，但源码仓库中不存在（原版发布包里有、源码树没有），属历史悬空引用；
- 已从原版插件包提取并加入 `static/lz-string.min.js`，消除 404，localStorage 压缩恢复生效。

### 9.4 歌词读取优先级

- 新增 `fetchSongloftLyric(rawItem)`：优先请求 `GET /api/v1/songs/{id}/lyric`（SongLoft 主程序内嵌/侧边栏/缓存歌词），解析 `data` 信封，取 `lyric→tlyric→rlyric→lxlyric` 首个非空；
- 纯在线（LXMusic 搜索结果）歌曲自动跳过（主库无记录）；
- 接入 4 处：MIoT `loadLyric`、预读缓存路径（在线+本地）、LXMusic 在线路径、本机普通播放兜底；
- 最终优先级：① SongLoft 主程序 → ② LXMusic → ③ 刮削兜底。

### 9.5 其它

- 分栏 `player-bar` 右内边距曾临时改为 10px 后又撤销，保持 28px（见第 8 节最终方案）。
