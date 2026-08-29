# IWP 1.1.7 上游优化与 iwebplayer-s 跟进评估

- 对比日期：2026-08-28
- 上游仓库：[songloft-org/songloft-plugin-iwebplayer](https://github.com/songloft-org/songloft-plugin-iwebplayer)
- 上游对比范围：[v1.1.6...v1.1.7](https://github.com/songloft-org/songloft-plugin-iwebplayer/compare/v1.1.6...v1.1.7)
- 本地仓库：`songloft-plugin-iwebplayer-S`
- 本地基线：`dev` / `1.1.6-dev`

## 结论

建议选择性跟进，不要直接合并或 cherry-pick 上游 `v1.1.7`。

本地 `iwebplayer-s` 已在 `v1.1.6` 后大幅分叉，已包含 APK/WebView 适配、三栏工具栏、IndexedDB 缓存、批量拉取限并发、歌词 RAF 生命周期管理、全曲库排序、自动更新版本注入等改动。上游 `v1.1.7` 主要涉及一个页面文件，直接同步会与本地的宽屏布局和前端功能产生较高冲突风险。

## 上游 v1.1.7 的改动

上游发布由 4 个没有语义化提交说明的提交组成；根据 `v1.1.6...v1.1.7` 的文件差异，实质改动如下。

### 1. 分栏列表统一滚动

上游为分栏模式增加 `#scroll-wrapper`，将歌单、歌曲列表和加载提示包装起来。

- 禁用页面主滚动，改由右侧内容区域承担滚动；
- 固定滚动区在单行工具栏下方；
- 在线高级搜索栏显示时，滚动区顶部自动下移；
- 移除歌单和歌曲列表各自的独立滚动，避免嵌套滚动、滚动条重复、内容滚到工具栏后方等问题。

该调整解决的是平板/桌面分栏模式的滚动体验问题。

### 2. 配置引擎弹窗刷新

点击“配置引擎”打开 LXMusic/WebDAV 配置弹窗后，上游会额外调用：

```js
window.loadLxPlugins();
window.renderPlatformSortList();
window.loadWebDavServers();
```

目的为打开弹窗时刷新音源、平台排序和 WebDAV 服务列表，避免配置页展示过期数据。

### 3. 补齐 lz-string 静态依赖

上游新增 `static/lz-string.min.js`。其页面此前已经引用该脚本；此发布将实际文件补入包内，避免压缩/解压相关代码因脚本加载失败而不可用。

### 4. 常规发布元数据

将 `package.json`、`plugin.json`、`window.APP_VERSION` 和 `download_url` 更新为 `1.1.7`。

## 本地现状与建议

| 上游改动 | 本地状态 | 建议 | 优先级 |
| --- | --- | --- | --- |
| 配置引擎弹窗刷新 | 本地弹窗逻辑仅切换 Tab，未完整刷新 LX/WebDAV 数据 | 手工移植刷新调用 | P1 |
| 分栏统一滚动 | 本地列表仍直接挂在页面根部，且拥有自定义三栏工具栏与分栏布局 | 出现双滚动、穿透工具栏或搜索展开错位时，按本地布局专项实现 | P2 |
| `lz-string.min.js` | 本地已包含并在 `index.html` 中引用 | 不需要跟进 | 不适用 |
| 版本号/下载地址 | 本地使用 `1.1.6-dev` 和构建时注入 `APP_VERSION` | 不要改回上游固定版本号 | 不适用 |

## 建议实施顺序

1. 手工加入配置弹窗打开后的数据刷新调用，并验证 LXMusic 与 WebDAV 两种当前引擎状态。
2. 在 `768px`、`960px` 和横屏平板设备上复现并确认分栏滚动问题。
3. 若确认问题存在，为本地三栏工具栏设计自适应的滚动容器；不要照搬上游的固定 `479px`、`108px`、`154px` 尺寸。
4. 回归验证歌曲列表、歌单网格、在线高级搜索、底部播放器和全屏播放器的层级及滚动行为。

## 相关本地位置

- `static/index.html`：配置引擎菜单处理逻辑。
- `static/index.html`：歌曲列表、歌单网格和加载提示的页面结构。
- `static/index.html`：`lz-string.min.js` 的脚本引用。
- `scripts/inject-version-hashes.mjs`：构建时版本与静态资源哈希注入。

## 最终判断

本地版本在性能、缓存及 Android 兼容性方面已明显领先于上游 `v1.1.7`。本次应吸收“配置弹窗刷新”这个低风险修复；“统一滚动”应以实际复现的问题为依据进行本地化实现；`lz-string` 和发布版本元数据无需跟进。
