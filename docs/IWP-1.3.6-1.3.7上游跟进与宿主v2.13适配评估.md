# IWP 1.3.6 → 1.3.7 上游跟进 + SongLoft 宿主 v2.11.6 → v2.13.0 适配评估

- 评估日期：2026-10-06
- 上游插件仓库：[songloft-org/songloft-plugin-iwebplayer](https://github.com/songloft-org/songloft-plugin-iwebplayer)
- 上游插件对比范围：`v1.3.6 (d320183)` → `v1.3.7 (731b251)`，共 **3 个提交**（均 `Add files via upload`）
- 上游插件差异规模：**5 个文件，+17 / −8**
  `static/index.html +6/−2`、`src/main.ts +3/−2`、`static/playlist.js +5/−1`、`plugin.json` ±3、`package.json` ±1
- 上游宿主仓库：[songloft-org/songloft](https://github.com/songloft-org/songloft)
- 上游宿主对比范围：`v2.11.6 (2026-08-21)` → `v2.13.0 (2026-09-30)`，含 **v2.12.0 / v2.12.1 / v2.13.0** 三个发布
- 本地基线：`dev` / `1.3.6-dev`（1.3.6.22）

> **结论**：
> 1. **上游 v1.3.7 只有 1 项需要移植** —— 「物理文件夹歌单恰好名为 `music` 时被丢弃」的后端 + 前端两处修；另两项（`/token` 路由改名、缓存首屏秒开）对我们**不适用**（详见下文）。
> 2. **宿主 v2.11.6 → v2.13.0 对本插件没有必须跟进项** —— v2.13.0 唯一的破坏性变更是移除 WebF 渲染引擎，而插件未声明 `renderEngine`（等价 `webview`），不受影响；新增能力（`tags.*`、`net:insecure-tls`、`onQueryBusy`、主题外观参数）均为可选，且**声明新权限会让插件在旧宿主上直接装不上**，故刻意不取。
> 3. 按 AGENT.md 约定 8 的默认规范，跟随上游把 **base 版本提升为 `1.3.7-dev`**，并同步 README / DEV_RELEASE_NOTES / AGENT.md。
> 4. 实测：当前工具链（`@songloft/plugin-builder 2.13.9`）下 `tsc` / `vitest`(50) / `build` / `audit:breakpoints --strict` / `git diff --check` 全部通过。

---

## 一、上游插件 v1.3.6 → v1.3.7 逐项评估

| # | 提交 | 内容 | 涉及文件 | 判断 | 处理 |
| --- | --- | --- | --- | --- | --- |
| A | `b4633b4` | 版本号 `1.3.6` → `1.3.7` | `plugin.json`、`package.json` | ✅ 按规范 | 提升 base 到 `1.3.7-dev` |
| B | `5569bba` | **物理文件夹歌单修复**：`pl.name !== 'music'` 会把「真实物理文件夹、恰好叫 music」的自动歌单当成内置 music 丢掉 | `static/playlist.js` | ✅ **必须移植** | 已移植（缓存重建处） |
| C | `5569bba` | 「读取缓存直入时立刻渲染」补 `else { renderPlaylist(); FilterManager.applyListFilter(400) }` | `static/index.html` | ➖ 不适用（已等价实现） | 不改 |
| D | `731b251` | **物理文件夹歌单修复**（后端同款） | `src/main.ts` | ✅ **必须移植** | 已移植（`meta_bulk`） |
| E | `731b251` | 路由 `/token` → `/api/token` 改名 | `src/main.ts` | ➖ 不适用 | 不改 |

### B / D：物理文件夹歌单被丢弃 —— 为什么必须移植

宿主的「按文件夹 / 按一级子目录」自动歌单会带 `auto_created` 标签，其 `name` 就是目录名。旧逻辑：

```js
if (pl.name !== 'music') { ...收录... }
```

本意是跳过宿主内置的 `music` 歌单，但只要音乐库里真有一个叫 `music` 的文件夹，它对应的自动歌单也会被这条判断连坐丢掉 → 该文件夹的歌曲只在「所有歌曲」里出现，重建后的歌单结构里查不到。上游 v1.3.7 改成「带 `auto_created` 标签（即真实物理文件夹）就照常收录」，后端与前端两处同步。

**与本插件的分叉点**：我们的 `playlist.js` 与上游相差 700+ 行，`main.ts` 也已重构（有界并发、warning 上报、`all_songs` 走全局曲库），**不能 cherry-pick**，按功能手工移植。移植时我们复用已有的 `isAutoCreated` 变量（上游写了两遍重复探测），语义完全一致。

### C：缓存首屏秒开 —— 我们已等价，且随附能力不存在

- 我们的 `else` 分支本来就有渲染（`index.html`）：
  ```js
  } else {
      songList = window.getMergedSongList(currentPlaylist);
      window.renderPlaylist();
  }
  ```
  「我的歌单」海报墙过滤（C3）是在 `renderPlaylist` **内部**按 `window._gridFilterKeyword` 完成的，因此无需再单独调一次过滤。
- 上游随附的 `FilterManager.applyListFilter(400)` 在本仓库**没有对应物**：我们移植的 C1「漏斗」目前只是 `#filter-action-wrap` 的显隐壳（`static/player.js` 的 `updateSearchUI`），没有可调用的列表过滤 API。

### E：`/token` → `/api/token` —— 我们不适用

我们**从未引入**这个「免鉴权取 token」接口：`src/main.ts` 的路由只有 `/sw.js`、`/musiclist`、`/musicinfo`、`/sync`、`/store`、`/scrape`、`/debug`（外加 `webdav.ts` 的 `/dav/*`），前端也不请求它。当初同步上游 v1.3.5/1.3.6 时就刻意略过（理由见 `index.html` 401 重试处注释：这类接口会把有效 JWT 暴露给任何能访问插件页的人）。故**无引用可改**，上游这次改名对我们没有影响。

---

## 二、宿主 v2.11.6 → v2.13.0 与本插件相关的条目

### 2.1 破坏性变更（唯一一条）：移除 WebF 渲染引擎（v2.13.0）

- 宿主：`renderEngine` 合法值由 `""/"webview"/"webf"` 改为 `""/"webview"/"lynx"`；**声明 `renderEngine: "webf"` 的插件在新宿主上安装/更新会被拒绝**（存量条目由客户端回落到系统 WebView）。
- 本插件：`plugin.json` **没有** `renderEngine` 字段 → 等价 `webview`，构建产物同样是「省略」态，**不受影响**（实测 `dist/` 内 `plugin.json` 无该字段）。
- 附带：宿主 `ValidatePermissions` 由「未知权限报错」改为「只 Warn 不拒绝」，对我们是纯收益（将来升级权限更安全），无需改动。

### 2.2 与插件运行环境相关（逐条核查，均无需改代码）

| 宿主提交 | 内容 | 对本插件的影响 | 处理 |
| --- | --- | --- | --- |
| `f667bd1`（v2.12.1） | 插件 HTML 响应补 `Cross-Origin-Embedder-Policy: credentialless`（Lynx Web 宿主页要开 COEP） | 本插件**没有任何 iframe**；跨源资源只有封面图 / 音频（no-cors 加载不受 credentialless 限制），`#fp-cover` 的 `crossorigin="anonymous"` 行为与之前一致 | 不改 |
| `f667bd1`（v2.12.1） | 嵌入态 HTML `overflow-y: scroll` + `scrollbar-width: none`（滚动条不占布局宽度） | 我们已全局隐藏滚动条（`::-webkit-scrollbar{display:none}` + `html/body{scrollbar-width:none}`），且**未使用 `100vw`**，与宿主规则不冲突 | 不改 |
| `6713771` / `6c51643`（v2.12.1） | 宿主 Flutter 页面 `<html>` 禁掉视口滚动条，根治整页抖动（#439） | 宿主页面自身，我们的页面在 iframe 内不受影响；我们自己的抖动问题早已按 `--vh100` / 分栏铁律处理 | 不改 |
| `songs.list` / `playlists.list` / `getSongs` 桥接签名（v2.11.6 ↔ v2.13.0 逐字段比对） | 完全一致 | 我们的分页 / truncated 探测逻辑继续有效 | 不改 |
| `internal/database` 多值歌手（v2.12.1，新增 `song_artists` 表） | `songs.artist` 字符串列**保留** | `cleanSong` / 刮削按 artist 检索不受影响 | 不改 |
| 体积上限（v2.13.0）：manifest 1MB、插件 zip 100MB、插件请求体 50MB | 防护性上限 | 我们的 zip ≈ **0.71MB**、根 `manifest.json` < 1KB、`/store` 配置体远小于 50MB | 不改 |
| 封面视频抽帧兜底、插件网格自定义排序、`songs.create` 透传 `is_video`、`songs.create` 导入补元数据探测 | 宿主侧改进 | 白捡收益（封面、导入时长），零改动 | 不改 |
| 子模块 `clients/player`、`player-lynx`、`miot` 指针更新 | 官方客户端 / 生态 | 与插件无关 | 不改 |

### 2.3 新增可选能力：为什么**刻意不取**

| 能力 | 宿主版本 | 为什么不取 |
| --- | --- | --- |
| `songloft.tags.*`（读 / 写标签，需 `tags.read`/`tags.write`） | v2.12.0 | 需要新功能（标签浏览/筛选 UI）才有意义；且**老宿主（< 2.12.0）的 `ValidatePermissions` 是硬失败**，声明后插件在旧宿主上直接装不上 |
| `net:insecure-tls`（`fetch` 带 `X-Fetch-Insecure` 跳过 TLS 校验） | v2.12.0 | 仅自签证书 NAS 的 WebDAV 场景才需要，属可选优化；同上，声明即牺牲旧宿主兼容性 |
| `onQueryBusy()`（热重载前询问「忙不忙」） | v2.12.1 | 本插件后端不持有播放会话状态（播放器在前端页面），热重载不会造成「播着播着停了」，收益近零 |
| 宿主主题外观参数（`--sl-theme-*` / `data-navigation-style` / `songloft-theme-appearance-change`） | v2.13.0 | 我们使用自研主题体系，且前端**完全没有**引用 `window.SongloftPlugin`；要接入是独立的外观改造项，本次不做 |
| `songs.refreshMetadata` 桥接、`songs/{id}/tracks` 端点 | v2.11.6 | 自研刮削已工作，且 `tracks` 无多轨需求（与 `SongLoft-v2.11.6` 评估结论一致） |

> 若将来要取其中任何一项，必须同时：① 提升 `plugin.json` 的 `minHostVersion`；② 做能力探测（如 `typeof songloft.tags === 'object'`）保持旧宿主可用。

---

## 三、实测验证（本机，2026-10-06）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 工具链版本 | `node_modules/@songloft/plugin-builder/package.json` | `2.13.9`（与宿主 v2.13 同期） |
| 类型检查 | `npx tsc --noEmit` | ✅ 通过 |
| 单测 | `npm test` | ✅ 4 文件 / 50 用例全绿 |
| 构建 | `npm run build` | ✅ `dist/iwebplayer-s.jsplugin.zip`（708.6 KB，版本 `1.3.7-dev`） |
| 断点审计 | `npm run audit:breakpoints -- --strict` | ✅ 未发现跨断点带缺失或不一致 |
| 行尾 / 空白 | `git -c core.whitespace=cr-at-eol diff --check` | ✅ 通过（`playlist.js` 改动用字节级替换，CRLF 未被打乱） |
| 产物清单 | 解包 `plugin.json` | ✅ `entryHash`/`zipHash` 已填；无 `renderEngine`；`version=1.3.7-dev` |

---

## 四、本次动作清单

**已做**

1. `src/main.ts`：`meta_bulk` 放行带 `auto_created` 标签的 `music` 歌单（复用 `isAutoCreated`）。
2. `static/playlist.js`：缓存重建处同步修（CRLF 保持）。
3. 版本号 `1.3.6-dev` → `1.3.7-dev`：`plugin.json`、`package.json`、`package-lock.json`(2 处)、`README.md`(badge + 2 处 zip 名 + 1 处陈旧文字)、`DEV_RELEASE_NOTES.md`、`AGENT.md`(版本表 + 已发生列表 + 约定 8 交叉引用)。
4. 新建本评估文档；新建 `docs/iWP-S-1.3.7-Dev-记录.md`（新大版本记录，约定 11）。

**未做（及原因）**

- 不改 `manifest.json`（CI 维护，禁手工编辑）。
- 不采用上游 `?v1.3.7` 查询串（我们用构建期内容哈希注入）。
- 不声明任何新权限、不新增 `renderEngine` 字段（见 2.3）。
- 不动 CI 版本 / tag / 构建序号推导逻辑。
