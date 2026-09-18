# IWP 1.3.3 ~ 1.3.5 上游跟进记录

- 对比日期：2026-09-18
- 上游仓库：[songloft-org/songloft-plugin-iwebplayer](https://github.com/songloft-org/songloft-plugin-iwebplayer)
- 上游对比范围：`v1.3.2...v1.3.5`（v1.3.3、v1.3.5 两个发布）
- 本地仓库：`songloft-plugin-iwebplayer-S`
- 本地基线：`dev` / `1.3.2-dev` → 本次跟进后 **`1.3.5-dev`**

## 结论

改动很小（`v1.3.2...v1.3.5` 合计 236 增 / 48 删，仅 `index.html`、`player.js`、`lyrics.js` 三个页面文件），**全部跟进**。仍然不能 merge / cherry-pick：我们的 `lyrics.js` 是自研 KTV 引擎（1219 行，上游仅 230 行），`index.html` / `player.js` 也大幅分叉，因此全部按功能手工移植，并按默认规范把 base 版本升到 `1.3.5-dev`。

## 上游改动清单

| 版本 | 主题 | 实际内容 |
| --- | --- | --- |
| v1.3.3 | 优化滑动显示封面歌词手感、修复收藏等 bug | 顶部把手改下箭头；沉浸页下拉 1:1 跟手 + 幕布同步；底部播放栏防穿透；歌词拖动结束 1 秒强制回中并新增 `LyricsEngine.scrollToCurrent()`；收藏改内存更新（不再 `reloadGlobalData`）；播放按钮首次点击去掉 `audioEl.src` 判断；移除标题红心；playMode 写回 localStorage（我们已具备） |
| v1.3.5 | 修复 iOS 27 PWA 顶部虚化 | 移除 `apple-mobile-web-app-status-bar-style`；`fetch` 拦截器 401 自动续签 + 取消防抖式 token 内存缓存 |

## 逐项适配（含宽屏分栏收益）

| 改动 | 本地落地 | 宽屏分栏收益 |
| --- | --- | --- |
| ① 收藏改内存更新 | `player.js`：删除 `reloadGlobalData()`，改为内存同步 `favoriteList` **并同步 `allPlaylists['收藏']`**（比上游多做一步，保证「收藏」歌单视图也即时正确）；顺带去掉 `window.showToast("⏳ 正在同步...")` | ✅ 明显：不再全库重拉，宽屏右栏列表不重绘、不跳动 |
| ② token 失效重试 | `index.html`：`getAccessToken()` 改为「以 localStorage 原文为缓存键」——原文变了才重新解析（比上游每次解析更省，比旧的永久缓存更正确）；`fetch` 收到 401 时重读 token，**仅当与本次发送的不同**才重放一次原请求 | ✅ 桌面/PWA 长时间挂机时不再无谓掉登录 |
| ③ 歌词拖动回中 | `lyrics.js`：新增 `scrollToCurrent()` 并导出；拖动结束由 2000ms 改为 **1000ms** 且**无条件强制回中**（原实现只在播放中 `sync()`） | ✅ 暂停看歌词、拖动后能立刻回正 |
| ④ 展开后回中 | `player.js`：`toggleFullPlayer(true)` 后延时 50ms 调 `LyricsEngine.scrollToCurrent()`；同时清理拖拽遗留的内联 `transform` | ✅ 切换 32/68 播放页高度变化后歌词重新居中 |
| ⑤ 播放按钮首次点击 | `index.html`：去掉 `(!audioEl.src \|\| audioEl.src === location.href)` 条件 | ➖ 主要是移动端手势问题，宽屏行为不变 |
| ⑥ iOS PWA meta | `index.html`：删除 `apple-mobile-web-app-status-bar-style` | ➖ iOS 专属 |
| ⑦ 顶部把手改下箭头 | `index.html`：CSS 换为 `.drawer-handle`(40px) + `.down-arrow` + `@keyframes bounce-down`，新增明暗背景下箭头配色两条；结构替换为下箭头 SVG 并加 `title="收起沉浸模式"` | ➖ 宽屏分栏下把手本就 `display:none` |
| ⑧ 沉浸页下拉 1:1 跟手 + 播放栏防穿透 | `index.html`：重写 `fullPlayer` 三个触摸监听，面板与 `#fp-ambient-bg` 同步位移，超 80px 收起、否则回弹；给 `#player-bar` 加 `touchmove` 防穿透 | ⚠️ 按**我们的 768+ 分栏断点**做了 `return`（上游写死 960）；防穿透**显式排除 `input[type=range]`**，否则音量/倍速滑杆会拖不动 |
| ⑨ 移除标题红心 | `player.js`：删除 `favSvg` 及其模板插值 | ➖ 纯外观 |
| playMode 持久化 | 已有 `iwebplayer-s.local_play_mode` | ➖ 无需跟 |

## 与上游的三处刻意差异

1. **② 不新增免鉴权 token 接口。** 上游写的是 `fetch('./api/token')`，但宿主会注入 `<base href=".../api/v1/jsplugin/<entry>/">`，实际请求 `/api/v1/jsplugin/<entry>/api/token`，而上游后端注册的路由是 `/token` —— 两者不匹配，上游这条续签很可能一直 404；即便路径对齐，要让「过期 token 也能取新 token」就必须把该路径声明进 `publicPaths` 免鉴权，那等于**把有效 JWT 暴露给任何能访问服务器的人**（等于绕过登录）。因此本地改为「重读宿主写回 localStorage 的最新 token 再重放」，不新增任何免鉴权接口。
2. **① 同时更新 `allPlaylists['收藏']`**（上游只改 `favoriteList`），避免「收藏」歌单视图停留在旧数据直到下一次后台同步。
3. **⑧ 的防穿透排除滑杆**（上游未排除），且分栏断点用 768（我们的分栏从 768 起）。

## 验证

- `npm test`（vitest）50 项全通过、`npx tsc --noEmit` 无错误、`npm run build` 构建成功；
- `index.html` 内联脚本语法 + CSS 花括号配平、`lyrics.js` / `player.js` 语法检查通过；
- CRLF / 混合行尾文件（`player.js`）全部使用字节级替换，`git -c core.whitespace=cr-at-eol diff --check` 通过，无换行污染。

## 附：本次顺带修复的 CI 环境回归（APK 构建）

推送后 **插件工作流成功，APK 工作流 15 秒失败**，失败点是 `Setup Android SDK`：

```text
[command] .../cmdline-tools/16.0/bin/sdkmanager tools
Warning: Failed to find package 'tools'
Error: The process 'sdkmanager' failed with exit code 1
```

原因是 `android-actions/setup-android@v3` 内部会安装旧版 `tools` 包，而 Google 已从 SDK 仓库移除该包；重跑同样失败（非瞬时问题），与本项目代码无关。

**修复**：两个 APK 工作流（`build-apk-dev.yml`、`build-apk.yml`）都不再使用该 action，改为直接使用 runner 预装的 Android SDK，并容错补齐本工程所需包：

```yaml
SDKMGR="$(ls -d "$SDK_ROOT"/cmdline-tools/*/bin/sdkmanager 2>/dev/null | tail -1)"
yes | "$SDKMGR" --licenses >/dev/null 2>&1 || true
"$SDKMGR" "platform-tools" "platforms;android-35" "build-tools;35.0.0" || \
  echo "::warning::部分 SDK 包安装失败，交给 Gradle 自行补齐"
```

修复后 APK 工作流成功（1m33s），`dev-1.3.5` 预发行版同时包含 APK 与插件 zip。
