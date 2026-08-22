# Android 壳层优化：开屏图标透明化 + 边缘滑动返回

> 对应提交：`0fdb3eb`（dev 分支），APK 由 `build-apk-dev.yml` 在 dev 上自动构建验证。
> 涉及目录：`android/`（Android WebView 壳层），web 插件 `static/` 未改动。

## 一、需求

1. **开屏 Logo 四角带黑边**：App 开屏/桌面图标四角是黑色，应改为与 web 端一致的透明四角。
2. **应用内边缘滑动返回**：在应用内，从屏幕**左边缘向右滑**、**右边缘向左滑**，默认触发「返回」功能（等同系统返回键）。
3. 用户确认方案后才动代码；APK 先在 dev 分支验证，**不修改 main**。

## 二、问题定位

### 2.1 开屏 Logo 黑边

- 图标文件：`android/app/src/main/res/drawable-nodpi/ic_launcher.png`，由 `AndroidManifest.xml` 的 `android:icon="@drawable/ic_launcher"` 引用，系统开屏与桌面图标共用。
- 根因：提交 `d9ccf73` 把它换成了「原图全出血」版本 —— **512×512 不透明 RGB**，逐像素采样确认四角为纯黑 `(0,0,0)`，系统开屏把图标显示出来后黑角裸露。
- 对比：`static/icon-512.png` 是**同一 Logo 的透明四角版**（RGBA，四角 alpha=0，中心色值一致），正是 `d9ccf73` 之前使用的版本。

### 2.2 边缘滑动返回

- 位置：`android/app/src/main/java/com/songloft/iwebplayer/MainActivity.java`。
- 现状：只有 `onBackPressed()`（网页可后退→`goBack()`；在播放器页→弹「修改服务器/退出」对话框；否则 `super` 退出），**Android 层与 Web 层均无边缘滑动手势**（Web 仅有竖向抽屉手势）。

## 三、解决方案

### 3.1 图标：替换为透明四角版

把 `static/icon-512.png` 复制覆盖到 `android/app/src/main/res/drawable-nodpi/ic_launcher.png`。单文件改动，APK 构建自动带上。

### 3.2 边缘滑动返回：MainActivity 手势识别

在 `MainActivity` 增加 `dispatchTouchEvent` 覆写：

- 常量：`EDGE_GESTURE_ZONE_DP = 40`（触摸起点落在屏幕左右边缘多少 dp 内）、`EDGE_SWIPE_THRESHOLD_DP = 60`（向内横向滑动超过多少 dp 判定为返回）。
- `ACTION_DOWN`：记录起点；`x <= 40dp` → 左缘（edge=1）；`x >= 屏宽-40dp` → 右缘（edge=2）。
- `ACTION_MOVE`：左缘要求 `dx > 60dp`（向右滑）、右缘要求 `dx < -60dp`（向左滑），且 `|dx| > 1.5*|dy|`（横向显著大于纵向，避免误触竖向滚动/抽屉），命中后调用 `onBackPressed()` 并吞掉剩余滑动事件。
- `ACTION_UP/CANCEL`：复位手势状态。

行为完全复用现有 `onBackPressed()`，即「等同系统返回键」：
1. 网页可后退 → `webView.goBack()`；
2. 在播放器页 → 弹「修改服务器/退出」对话框；
3. 其它 → `super.onBackPressed()` 退出。

## 四、注意点

- **系统手势冲突**：Android 10+ 若开启「全面屏手势」，系统自身会拦截边缘滑动做返回，App 内监听可能收不到事件（由系统直接处理）；若用「三键导航」，则 App 内监听有效。两种场景下行为均符合预期，无副作用。
- 手势只在内边缘滑动且横向显著大于纵向时触发，与播放器抽屉（竖向）、进度条拖动、列表滚动互不干扰。
- 仅在触摸起点落于边缘 40dp 内时才进入手势判定，普通点击/滑动不受影响。

## 五、验证

- APK 由 `build-apk-dev.yml` 在 dev 分支自动构建（`iWebPlayer-S-v1.1.6-dev.apk`），未触碰 main。
- 验证要点：开屏/桌面图标四角干净；播放器页左/右边缘向内滑触发返回；列表竖向滚动、抽屉、进度条拖动不误触返回。
