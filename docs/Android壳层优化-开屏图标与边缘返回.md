# Android 壳层优化：开屏图标、返回逻辑、改服务器

> dev 分支，APK 由 `build-apk-dev.yml` 自动构建验证；涉及 `android/` 与 `static/index.html`（首页菜单）。

## 1. 开屏图标透明化

- **桌面图标**：`ic_launcher.png` 保持「原图满幅版」（用户偏好，见 `docs/OPTIMIZATION_RECORD.md` 7.6）。启动器有遮罩，桌面上无黑边。
- **开屏**：Android 12+ 系统开屏直接显示 App 图标（无遮罩），满幅版黑角裸露。
- **方案**：桌面图标不动；新增 `ic_splash.png`（=`static/icon-512.png` 透明四角版）+ `values/themes.xml`（`Theme.IWebPlayerSplash`：背景 `#111827` + `windowSplashScreenAnimatedIcon=@drawable/ic_splash`）；Manifest 主题改用它。开屏=深色底+透明 logo。

> ⚠️ 曾误把 `ic_launcher.png` 换成透明版（`0fdb3eb`），违反文档偏好，已还原。

## 2. 返回逻辑（边缘滑动 + 系统返回键共用）

- **手势**：`dispatchTouchEvent`，起点落在左右边缘 40dp 内、向内横向滑动超 60dp 且 `|dx| > 1.5|dy|` → 触发；判定后吞掉剩余滑动。
- **行为**（`onBackPressed()`，不再弹"修改服务器/退出"对话框）：
  1. `canGoBack` → `goBack()`
  2. 全屏播放器（`player-open`）→ `toggleFullPlayer(false)` 回首页
  3. 首页 → `moveTaskToBack(true)` 退系统桌面（应用进后台）
  4. 设置页 → `super.onBackPressed()` 退出

## 3. 改服务器入口

- 首页设置菜单新增「改服务器」项（server 图标，位于**主题下面、版本上面**）。
- 点击 → `window.Android.changeServer()` 桥接 → `webView.loadUrl(SETTINGS_URL)` 打开原生设置页；网页端提示仅 App 可用。

## 注意

- Android 10+ 开启「全面屏手势」时系统会先拦截边缘滑动，App 内手势主要在「三键导航」下生效，两场景均无副作用。
- 手势仅横向显著大于纵向时触发，与竖向滚动/抽屉/进度条互不干扰。
