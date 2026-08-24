# 🎵 iWebPlayer-S

> iWebplayer-S 是以 [birdstudy-nj](https://github.com/birdstudy-nj) 大佬的 [iwebplayer](https://github.com/songloft-org/songloft-plugin-iwebplayer) 为基础，Vibe-Coding 适配的宽屏设备（例如笔记本、安卓平板等），并打包成 APK(主要是因为局域网没办法配置PWA)。无此需要建议使用原版[iwebplayer](https://github.com/songloft-org/songloft-plugin-iwebplayer) 。

## 为什么又有了dev分支呢？因为是全Vibe－coding，经常改着改着就变样了。而且还局部调整了原来继承过来的上游代码，为了避免混乱才创建了Dev。

![Plugin](https://img.shields.io/badge/plugin-v1.1.6-ec4899)
![Android APK](https://img.shields.io/badge/apk-v0.0.1+-8b5cf6)
![License](https://img.shields.io/badge/license-Apache--2.0-blue)

iWebPlayer-S 保留原版的播放、歌单、歌词、封面刮削、倍速、续播、LXMusic、WebDAV 与小爱音箱能力，并额外提供 **Android 直装 APK**（WebView 壳）——局域网 HTTP 服务器无需 HTTPS 也能安装使用，锁屏媒体控制、播放进度一应俱全。

---
## ✨ iWebPlayer-S功能特性
- ✨ 继承[iwebplayer](https://github.com/songloft-org/songloft-plugin-iwebplayer)全部功能特性(PS:尽量)
- ✨ 优化了安卓端返回逻辑，不再弹出 "修改服务器/退出"对话框。修改服务器功能增加在首页菜单栏。
- ✨ 宽屏（分栏）模式三栏工具栏
- ✨ **新增逐字歌词（KTV）引擎 -此功能对于移动端（网页及安卓端的性能来说，只能说聊胜于无，时间轴试了很多方案都没有原生安卓APP准确）**
- ✨ 移植上游 60FPS `requestAnimationFrame` 同步循环，支持 `[[mm:ss.xx]]` 双括号和 `[mm:ss.xxx]` 单括号两种逐字时间戳格式，支持渐变扫光（普通/平板）和逐字跳动流光（手机沉浸模式）两种渲染模式。
- ✨ 增加修复主题模式切换，以及 Android WebView 下深色和浅色显示不一致的问题。
- ✨ 修复 APK 中音源相关脚本的导入与加载。
- ✨ 优化静默刷新流程和专辑封面缓存，减少重复请求与封面闪烁。
- ✨ 优化 MIoT 音箱推送流程和播放状态处理。
- ✨ 更新代码版本探针与静态脚本内容哈希，确保客户端能发现并加载新版本资源。

## ✨ iWebPlayer功能特性

- ✅ 宽屏设备适配（笔记本、安卓平板等）与 Android APK 直装
- ✅ iPhone Safari 播放适配：锁屏控制、灵动岛、媒体库
- ✅ 耳机线控：上一曲 / 下一曲 / 暂停
- ✅ iPhone 锁屏动态歌词
- ✅ 歌曲封面 & 歌词自动刮削展示
- ✅ 自建歌单：添加 / 删除歌曲、自定义封面
- ✅ 倍速播放、记忆续播（本地 / 云端同步）
- ✅ 调用 SongLoft 的 LXMusic、WebDAV 插件
- ✅ 推送小爱音箱播放本地或在线歌曲


## 📱 设备适配（iOS无设备，主要测试的安卓平板）

| 设备 / 环境 | 状态 |
| --- | --- |
| iPhone Safari 竖屏 | 单栏播放体验 |
| iPhone Safari 横屏 | 宽屏布局 |
| iPad / 平板横屏（viewport ≥ 768px） | 左右双栏首页、宽屏歌词与播放页 |
| 桌面 Chrome / Edge / Safari（viewport ≥ 960px） | 左右双栏首页 |
| Android（直装 APK） | WebView 壳，局域网 HTTP 可用 |

## 📦 安装

### 1. 安装插件（SongLoft 服务器）

1. 从 [Releases](https://github.com/MbAIGC/songloft-plugin-iwebplayer-S/releases) 下载 `iwebplayer-s-v1.1.6.jsplugin.zip`；
2. 在 SongLoft 后台 **JS 插件** 页面上传该 zip 安装——**直接上传，无需解压**；
3. 安装后浏览器访问 `/api/v1/jsplugin/iwebplayer-s/static/index.html` 即可使用。

### 2. 安装 Android APK

1. 从 [Releases](https://github.com/MbAIGC/songloft-plugin-iwebplayer-S/releases) 下载 `iWebPlayer-S-v0.0.1.apk`（后续版本自动递增）；
2. 首次打开：填写服务器地址、账号、密码，勾选协议后登录，直达播放器；
3. 服务器更新插件后，App 打开即为最新页面，无需重新安装 APK。

> 📌 APK 与插件在同一 Release 中发布：APK 从 **v0.0.1** 开始计数，插件版本为 **1.1.6**。

## 🛠️ 构建

### 插件（本地）

```bash
npm install
npm run build
# 产物：dist/iwebplayer-s.jsplugin.zip
```

### Android APK（GitHub Actions 自动）

推送到 `main`（改动 `android/**` 或 workflow）即自动构建并发布，同一 Release 同时产出：

- `iWebPlayer-S-vX.Y.Z.apk` — 固定签名，可覆盖安装
- `iwebplayer-s-v1.1.6.jsplugin.zip` — 可直接安装到 SongLoft

也可在 Actions 页面手动触发，并支持手动指定版本号。

## 🧩 项目结构

| 目录 | 说明 |
| --- | --- |
| `src/` | 插件后端：路由、刮削、WebDAV、小爱同步 |
| `static/` | 插件前端：播放器、歌单、在线资源、MIoT |
| `android/` | Android WebView 壳：登录、媒体会话、通知栏控制 |
| `.github/workflows/` | 插件 / APK 构建流水线 |

## 📚 文档

- [优化记录](./docs/OPTIMIZATION_RECORD.md)
- [代码评审](./docs/ds-review.md)
- [逐字歌词（KTV）引擎移植记录](./docs/优化记录-逐字歌词KTV移植.md)
- [缓存问题分析](./docs/iwebplayer-s缓存问题分析.md)
- [静默更新优化方案](./docs/iwebplayer-s静默更新优化方案.md)
- [主题模式优化总结](./docs/iwebplayer-s主题模式优化总结.md)

## 🙏 致谢

本项目是 **独立适配版本**：播放器基础功能、交互设计与实现框架源自 [birdstudy-nj](https://github.com/birdstudy-nj) 的 [iWebPlayer](https://github.com/songloft-org/songloft-plugin-iwebplayer) 项目。

在此向原作者致以诚挚的感谢！本版本使用独立的 `iwebplayer-s` 插件入口、接口路径与存储命名空间，可与原版并行安装，互不影响。

## 📄 License

Apache-2.0 © 2026 MbAIGC

基于 [songloft-plugin-iwebplayer](https://github.com/songloft-org/songloft-plugin-iwebplayer)（Apache-2.0）二次开发。
