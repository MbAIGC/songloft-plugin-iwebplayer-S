# SongLoft v2.11.6 宿主发布说明与 iwebplayer-s 适配评估

- 分析日期：2026-08-29
- 上游宿主仓库：[songloft-org/songloft](https://github.com/songloft-org/songloft)
- 上游版本：[v2.11.6 Release](https://github.com/songloft-org/songloft/releases/tag/v2.11.6)（发布于 2026-08-21）
- 本插件：`songloft-plugin-iwebplayer-S` / dev / `1.1.7-dev`

## 结论

v2.11.6 整体是**宿主（服务端）侧改进**，对本插件没有"必须跟进"项：

- **升级宿主即白捡 2 项收益**（插件零改动）：CORP 头修复 COEP 静默拦截、封面缩略图磁盘缓存；
- **3 项新增 API 为可选利用**（要用才需动插件，并提升 `minHostVersion`）；
- **1 项新增 fetch 能力与我们的实现完全无关**；其余为宿主侧工程修复。

## 一、升级宿主即受益（无需改插件）

| 提交 | 内容 | 对本插件的价值 |
| --- | --- | --- |
| `25786f9` | 加 CORP 头，修复 Web 端跨源封面/音频被 COEP 静默阻断 | 若部署开启 COEP/跨源隔离，插件前端加载远程封面（LXMusic CDN、WebDAV）之前可能被静默屏蔽——升级后恢复。**Web 端受益最大** |
| `3ef2073` | 封面缩略图磁盘缓存（避免重复解码+缩放） | 宿主侧封面渲染性能提升，插件歌单网格/歌曲列表/播放器封面加载变快 |
| `825f70f` | 外部封面查找 + 歌单封面优先外部图片 | 本地扫描歌曲的封面质量与歌单封面更准确，间接惠及插件海报墙 |

## 二、新增 API（可选利用，需动插件 + 提升 minHostVersion）

| 提交 | 内容 | 评估 |
| --- | --- | --- |
| `a954521` | `songs.refreshMetadata` 桥接（支持带 Headers 的远程元数据提取） | 插件元数据/封面刮削为自研（meta_bulk + 前端）。想把刷新下沉给宿主、支持带鉴权 Header 的远程提取可迁移；**现有实现已工作，属可优化非必须** |
| `85d4330` | `GET /api/v1/songs/{id}/tracks` 音轨枚举端点 | 对多轨音频（FLAC+CUE 类）有用；当前无此需求，低优先 |
| `caecb48` | 歌单置顶接口 | 宿主持久化置顶，低成本功能项，非优化项 |

## 三、与本插件无关

- `31a4d18` fetch 响应头多值/标准 Headers 读取 —— **验证过不相关**：插件的 truncated/警告判定靠客户端数据比对（`src/main.ts` 比对返回数量 vs limit、检测宿主忽略 offset），沙箱内未用 fetch 读响应头。
- `5deae33` / `27ded61` Windows 跨盘/编译修复、`6c905f7` 内存库并发、`f474555` CI 发布顺序 —— 宿主侧工程问题。
- `14fe330` 播放速度按钮样式、子模块指针更新（player / miot / plugin-toolchain 类型） —— 宿主前端/生态。

## 四、建议动作

1. **宿主升级到 v2.11.6**：白捡 CORP/COEP 修复 + 封面缓存性能，插件零改动（升级后插件按 manifest 更新流程过一遍即可）。
2. **插件暂不动**：当前 `.03-dev` 稳定，除非遇到"远程封面被 COEP 吞掉""元数据刷新慢"等具体痛点，再考虑迁移 `songs.refreshMetadata` 或使用 `tracks` 端点——届时将 `plugin.json` 的 `minHostVersion` 从 `2.6.3` 提到 `2.11.6`，并做能力探测（`typeof songloft.songs.refreshMetadata === 'function'`）保持旧宿主兼容。
3. **手机端滚动条**：按原版行为保留现状，不再修改（当前 `.03-dev` 即最终态）。