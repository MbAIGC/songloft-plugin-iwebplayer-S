# iWP-S 1.3.7 Dev 记录

> **本文件约定**：同一大版本（`1.3.7`）内的**所有改动都记在这里**。每条用三级标题 `### <构建号>-Dev　<提交短哈希>　　<类型标签>`，
> 下面依次 `**概述**：` / `**用户需求**：` / `**改造思路**：`，末行引用式元信息（日期 ｜ 提交 ｜ 文件）。
> 类型标签：`⚙️ 功能` · `✅ 布局` · `🎨 外观` · `🐞 修复` · `🚀 性能·构建` · `🏗 重构` · `🧪 工具` · `♻️ 回退` · `📄 文档`。
> 1.3.6 及更早见 `iWP-S-1.3.6-Dev-记录.md`；上游跟进与宿主适配评估见 `IWP-1.3.6-1.3.7上游跟进与宿主v2.13适配评估.md`。

## 速查索引

| 构建 | 提交 | 概述 | 类型 |
| :--: | :--: | --- | --- |
| 1 | `436c00f` | 跟进上游 v1.3.7「物理文件夹歌单名为 music 被丢弃」修复，base 升到 1.3.7-dev；宿主 v2.13.0 评估为无需改代码 | ⚙️ 功能·跟进上游 |
| 2 | `691c535` | 401「重新登录」不再跳主程序根路径：App 走原生（可静默刷新、自动回本页），网页就地登录（URL 与 `?theme=…` 原样保留） | 🐞 修复·鉴权 |

> 共 **2** 条改动。

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

---

## 阶段 2 · 修复「登录后回不来」

### 1.3.7.02-Dev　691c535　　🐞 修复·鉴权

**概述**：401 卡片上的「重新登录」不再跳主程序根路径 —— App 内交给原生（可静默刷新、登录后自动回本页），网页端**就地登录**（当前 URL 与 `?theme=…` 等参数原样保留）

**用户需求**：反馈「APK 跳出未登录 → 提示到官方登录页 → 登录后没办法返回页面，只有关掉 App 重开才行」；随后补充「直接使用 `xxxx/api/v1/jsplugin/iwebplayer-s/?theme=light` 这样的**网页**也有同样问题」。

**改造思路**：

- **定位（均为代码可证，非猜测）**：
  - 401 卡片原来只有一个出口 —— `onclick="window.location.href='/'"`；宿主 [routers.go](https://raw.githubusercontent.com/songloft-org/songloft/v2.13.0/internal/app/routers.go) 里插件**静态页不鉴权**（只有插件 API 在 `AuthMiddleware` 后），所以用户看到的一定是插件自己的 401 卡片，也一定是这个 `'/'` 把人送走的；
  - App 侧 `checkAuthAndMaybePrompt`（`MainActivity.java:716-742`）的自动回页条件 `wasLoggedOut && !current.contains(PLUGIN_PATH)` 里，`wasLoggedOut` **只在 localStorage 完全没有 token 时**置位；「token 过期被服务端拒」不置位 → 登录成功也不会 `openPlayer()` 回插件页。这解释了「必须杀进程重开」（重开时 `openPlayer()` 直接加载插件页，且 `injectAuthIntoPage()` 会用 native token 覆盖 localStorage）；
  - App 内置的 `Android.onAuthFailed()`（`MainActivity.java:448-469`：先 refresh，失败才清 token 并回本地登录页）**前端从未调用**，是死代码 —— 注释里写的「真正的登录引导由 onAuthFailed 完成」与实现不符；
  - 网页端：`'/'` 直接丢弃当前地址，登录后被留在主程序界面，只能手动再敲 URL。
- **改法（按环境分流，只改 `static/index.html` 一个文件）**：
  - **App**（判据复用既有 `window.__iwpIsApp()` / `html.iwp-app`）：调 `Android.onAuthFailed()` → 成功则 `injectAuthIntoPage()+reload`（静默恢复），失败则 App 本地登录页 → `Android.login()` → `Android.openPlayer()` 回本页；旧包没有 `onAuthFailed` 时回退 `Android.changeServer()`，都没有才回退 `'/'`。
    ⭐ **现有 APK 无需重装**：`onAuthFailed` 早就在 APK 里，只是此前无人调用；插件更新即刻生效。
  - **网页**：401 卡片内联出「用户名 / 密码 / 登录并继续」，`POST <basePath>/api/v1/auth/login`（宿主契约：`{username,password}` → `{access_token,refresh_token,expires_in,token_type}`，失败 401 `{error}`），成功后按既有约定只写 `localStorage['songloft-auth'] = {accessToken}` 再 `reload()` —— **URL 原样不动**；另留「前往主程序登录」链接作备用入口，并记住上次用户名。
  - 登录 URL 由 `location.pathname` 推导（`^(.*\/api\/v1\/)jsplugin\//` → `$1auth/login`），**兼容反向代理 basePath**，且不依赖宿主注入的 `<base href>`：`…/iwebplayer-s/`、`…/iwebplayer-s`、`…/static/index.html?theme=…` 三种入口解析结果一致。
- **为什么不动 Java**：本次只需把已有能力接上；`wasLoggedOut` 看门狗仅在「用户主动走主程序网页登录」这条已不再产生的路径上才有意义，留待需要时再加固（改动 APK 会让用户必须重装）。

> `2026-10-06` ｜ `fix(auth): 401 重新登录不再跳主程序根路径；App 走原生、网页就地登录` ｜ 文件：`static/index.html`、`DEV_RELEASE_NOTES.md`
>
> 验证：3 个内联 `<script>` 块 `vm.Script` 解析 ✅｜VM 实测 6 条路径 ✅（空字段提示 / 401 错误文案 / 成功时请求 URL+body+写入 `songloft-auth`+reload / App `onAuthFailed` 优先 / 旧包仅 `changeServer` / 无桥回退 `/`）｜登录 URL 解析 6 种入口形态 ✅｜`npx tsc --noEmit` ✅｜`npm test` ✅（50）｜`npm run build` ✅（zip 710.5 KB）｜`npm run audit:breakpoints -- --strict` ✅｜`git -c core.whitespace=cr-at-eol diff --check` ✅
>
> 待真机/浏览器确认：① App 内 401 →「重新登录」应进** App 自己的**登录页，登录后自动回播放器；② 浏览器直接打开 `…/jsplugin/iwebplayer-s/?theme=light` → 卡片内登录 → 回到**同一 URL**（`?theme=light` 仍在）。
