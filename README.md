# iWebPlayer-S



## 📱 项目简介

iWebPlayer-S 是 SongLoft 的主题插件之一，专为 iPhone 交互优化，媲美原生APP的音乐播放与小爱音箱控制。

本项目是基于原始 [iWebPlayer](https://github.com/songloft-org/songloft-plugin-iwebplayer) 项目的独立适配版本。感谢原作者 [birdstudy-nj](https://github.com/birdstudy-nj) 提供播放器基础功能、交互设计和实现框架。本版本使用独立的 `iwebplayer-s` 插件入口、接口路径和存储命名空间，可与原版插件并行安装。

- ✅ iPhone Safari 播放适配

- ✅ 提供PWA/配置直装，类似原生APP界面
    
- ✅ iPhone锁屏控制、灵动岛、媒体库完美体验

- ✅ 耳机线控支持（上一曲 / 下一曲 / 暂停）
    
- ✅ iPhone锁屏动态歌词显示    
  
- ✅ 歌曲封面 & 歌词自动刮削展示

- ✅ 支持自建歌单（添加/删除歌曲，自定义封面）

- ✅ 支持倍速播放，记忆续播

- ✅ 调用Songloft的LXMusic，WebDAV插件

- ✅ 推送小爱音箱播放Songloft本地或其他在线资源歌曲

## 设备适配

- iPhone Safari 竖屏：保持原有单栏体验。
- iPhone Safari 横屏：根据 viewport 宽度使用横屏布局。
- iPad、Android 平板横屏（viewport `>=768px`）：左右双栏首页、动态歌词和宽屏播放页。
- 桌面 Chrome、Edge、Safari（viewport `>=960px`）：左右双栏首页、动态歌词和宽屏播放页。
- Android Edge PWA 安装：入口已保留，但是否可安装取决于 HTTPS、Service Worker、manifest 和浏览器自身安装条件。

## 本版本优化记录

完整的需求整理、问题定位、修复过程、验证结果和已知限制见 [OPTIMIZATION_RECORD.md](./OPTIMIZATION_RECORD.md)。

## 构建

```bash
npm install
npm run build
```

构建产物为 `dist/iwebplayer-s.jsplugin.zip`。

---

## License

Apache-2.0 © 2026 [birdstudy-nj](https://github.com/birdstudy-nj)
