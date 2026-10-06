# iWP-S 1.3.7 Dev 记录

> **本文件约定**：同一大版本（`1.3.7`）内的**所有改动都记在这里**。每条用三级标题 `### <构建号>-Dev　<提交短哈希>　　<类型标签>`，
> 下面依次 `**概述**：` / `**用户需求**：` / `**改造思路**：`，末行引用式元信息（日期 ｜ 提交 ｜ 文件）。
> 类型标签：`⚙️ 功能` · `✅ 布局` · `🎨 外观` · `🐞 修复` · `🚀 性能·构建` · `🏗 重构` · `🧪 工具` · `♻️ 回退` · `📄 文档`。
> 1.3.6 及更早见 `iWP-S-1.3.6-Dev-记录.md`；上游跟进与宿主适配评估见 `IWP-1.3.6-1.3.7上游跟进与宿主v2.13适配评估.md`。

## 速查索引

| 构建 | 提交 | 概述 | 类型 |
| :--: | :--: | --- | --- |
| 1 | `436c00f` | 跟进上游 v1.3.7「物理文件夹歌单名为 music 被丢弃」修复，base 升到 1.3.7-dev；宿主 v2.13.0 评估为无需改代码 | ⚙️ 功能·跟进上游 |

> 共 **1** 条改动。

---

## 阶段 1 · 跟进上游 v1.3.7 与宿主 v2.13 适配

### 1.3.7.01-Dev　436c00f　　⚙️ 功能·跟进上游

**概述**：跟进上游 v1.3.7 唯一的必修项「物理文件夹歌单恰好名为 `music` 时被丢弃」（后端 + 前端两处），并把 base 版本升到 `1.3.7-dev`

**用户需求**：上游 iWebPlayer 发布了 v1.3.7、SongLoft 宿主也更新到 v2.13.0——问「有需要适配的吗？」。按约定 8：不能 merge / cherry-pick，只能按功能手工移植；并需判断宿主侧有无必须跟进项。

**改造思路**：
- **上游 v1.3.7（共 3 个提交）逐项**：
  - A 版本号 `1.3.6` → `1.3.7`（`b4633b4`）→ 按默认规范把 base 提到 `1.3.7-dev`；
  - B/D **物理文件夹歌单修复**（`5569bba` + `731b251`）→ **移植**：宿主「按文件夹/子目录」自动歌单带 `auto_created` 标签、`name` 即目录名，旧条件 `pl.name !== 'music'` 会把「真实文件夹恰好叫 `music`」的自动歌单误当内置 music 歌单丢掉；
  - C 缓存首屏秒开（`5569bba`，`index.html` else 分支补 `renderPlaylist()` + `FilterManager.applyListFilter(400)`）→ **不适用**：我们的 else 分支本就调 `renderPlaylist()`（「我的歌单」海报墙过滤在渲染内部按 `_gridFilterKeyword` 完成），且上游那个 `FilterManager` 在本仓库无对应物（C1 漏斗目前只是 `#filter-action-wrap` 显隐壳）；
  - E `/token` → `/api/token` 路由改名（`731b251`）→ **不适用**：我们从未引入该免鉴权接口（路由只有 `/sw.js` `/musiclist` `/musicinfo` `/sync` `/store` `/scrape` `/debug` + `/dav/*`），无引用可改。
- **B/D 落地细节**：
  - `src/main.ts` 的 `meta_bulk`：把 `isAutoCreated` 探测提前，条件改为 `pl.name !== 'music' || isAutoCreated`（上游写了两遍重复探测，我们复用同一变量，语义一致）；
  - `static/playlist.js` 的缓存重建处：同款 `isPhysicalFolder` 判断。该文件为纯 CRLF，**用字节级替换**，`git diff --stat` 确认只有 6 行变动、无全文行尾改写。
- **宿主 v2.11.6 → v2.13.0 评估（结论：无需改代码）**：
  - v2.13.0 唯一破坏性变更 = 移除 WebF 渲染引擎（声明 `renderEngine: "webf"` 的插件被拒，`webf` 改为 `lynx`）→ 我们**未声明** `renderEngine`（等价 `webview`），不受影响；
  - v2.12.1 的插件页 `COEP: credentialless`、嵌入态滚动条 `scrollbar-width: none` 与宿主页视口滚动条修复 → 我们无 iframe、已全局隐藏滚动条、未用 `100vw`，均不冲突；
  - `songs.list` / `playlists.list` / `getSongs` 桥接签名在 v2.11.6 ↔ v2.13.0 间**逐字段比对一致**，分页 / truncated 探测继续有效；多值歌手只新增 `song_artists` 表，`songs.artist` 列保留，`cleanSong` 不受影响；
  - `tags.*`、`net:insecure-tls`、`onQueryBusy`、主题外观参数均为**可选能力**；且新增权限在旧宿主（< 2.12.0）的清单校验里是**硬失败**，声明即牺牲旧宿主兼容性，故**刻意不取**；
  - 体积上限（manifest 1MB / zip 100MB / 请求体 50MB）远大于我们的 0.71MB zip 与 KB 级配置。
- **工具链**：现有 `@songloft/plugin-builder 2.13.9`（与宿主 v2.13 同期）直接可用，未改依赖版本。

> `2026-10-06` ｜ `fix(playlist): follow upstream v1.3.7 physical-folder songs; bump base to 1.3.7-dev` ｜ 文件：`src/main.ts`、`static/playlist.js`、`plugin.json`、`package.json`、`package-lock.json`、`README.md`、`DEV_RELEASE_NOTES.md`、`AGENT.md`、`docs/IWP-1.3.6-1.3.7上游跟进与宿主v2.13适配评估.md`
>
> 验证：`npx tsc --noEmit` ✅｜`npm test` ✅（4 文件 / 50 用例）｜`npm run build` ✅（产物版本 `1.3.7-dev`，zip 708.6 KB）｜`npm run audit:breakpoints -- --strict` ✅｜`git -c core.whitespace=cr-at-eol diff --check` ✅
>
> 未动：`manifest.json`（CI 维护）、CI 的版本/tag/构建序号逻辑、上游的 `?v1.3.7` 查询串（我们用构建期内容哈希注入）。
