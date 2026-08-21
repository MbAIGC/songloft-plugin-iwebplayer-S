# iWebPlayer-S 缓存问题分析

> 分析对象：`songloft-plugin-iwebplayer-S`（及上游 `songloft-org/songloft-plugin-iwebplayer`）的插件缓存机制。
> 结论来源：插件源码、构建产物、已发布 zip 对比，以及 SongLoft 服务端开源源码（`songloft-org/songloft`，Go）。

---

## 一、要解决的问题

**"插件（iWebPlayer-S / 上游）更新后，旧设备/浏览器拿到的是旧版页面或旧 JS，数据不及时更新。"**

具体表现为：

- 服务端已上传新插件 zip（磁盘上文件已是最新版），但旧设备的浏览器/WebView 仍运行旧版代码；
- 功能、样式、脚本的修复在旧设备上"看不到"，用户需要手动清缓存或硬刷新；
- 部分场景（iOS Safari / 旧浏览器）下页面卡死在旧版本，无论怎么刷新都没用。

---

## 二、存在的原因（3 层失效）

### 第 1 层：服务端缓存契约（经源码确认，非服务端问题）

SongLoft 服务端 `internal/jsplugin/routes.go` 的缓存策略（`tryServeStaticFile`，`routes.go:399-444`）：

| 文件类型 | 响应头 | 行为 |
| --- | --- | --- |
| `index.html`（入口页面） | `Cache-Control: no-cache` | 每次回源验证，永远新鲜 |
| JS/CSS/图片（子资源） | `Cache-Control: public, max-age=31536000, immutable` | **浏览器缓存一年，绝不重新验证** |

**设计意图**（`routes.go:35-40`，issue #278 注释原文）：

> jsplugin-assets 用固定无版本 URL + "immutable, max-age=1年" 长缓存服务。immutable 意味着浏览器连重新验证都不做——一旦某个浏览器缓存了旧资源，之后再改也永远到不了该用户。加内容哈希版本号后，文件一变 URL 就变，老缓存自然失效；承载页 HTML 是 no-cache，每次都会带出最新版本号，故修复能即时下发。内容不变时 URL 恒定，immutable 长缓存依旧生效。

即：**服务端假定"子资源 URL 随着内容变化而变化"**（通过 `?v=` 或内容 hash 改名），所以可以放心让浏览器 immutable 缓存一年。这个机制本身是正确且高效的。

### 第 2 层：`?v=` 未随内容变化而更新（S 版的直接原因）

插件的 `index.html` 里所有 JS 引用都带手工维护的 `?v=` 参数（`?v0.8.0`、`?v1.1.2`、`?v1.1.6` 等），它们**不会随构建自动变化**。经对比：

**上游 `songloft-org/songloft-plugin-iwebplayer`（30 个 tag 逐一对比 `?v=` 与文件 sha256）：**

- 相邻 release 之间基本做到了"内容变了 → `?v=` 也 bump"，危险方向（内容变但参数没变）**没有出现**；
- 但存在大量浪费性 bump（内容没变也 bump：v0.3.5/v0.3.6 icons、v0.6.2 utils、v1.0.5 player、v1.1.1 五个文件全部）、版本号错位（tag `v0.3.5` 里 plugin.json 是 `0.3.4`；tag `v1.1.2` 里是 `1.1.1`；`?v` 出现过 `v0.5.0`、`v0.6.3`、`v1.1.0e` 这类对不上号的数字），以及空发版（v0.8.3 与 v0.8.2、v1.1.2 与 v1.1.1 内容完全相同仍打 tag）。

**S 版 `songloft-plugin-iwebplayer-S`（v1.1.3，shipped zip → `dist/_build` 新构建）：**

| 文件 | 内容（sha256:12） | `?v=` 参数 |
| --- | --- | --- |
| `icons.js` `utils.js` `lyrics.js` `playlist.js` `online.js` `plugins.js` `miot.js` | 全部 SAME | 未变 |
| **`player.js`** | **DIFF（894→935 行，`febddc5a…` → `476086af…`）** | **`?v1.1.6` 原样没动** |
| `index.html` | DIFF | 入口页面，URL 永不变 |

S 版在 v1.1.3 同一版本号的两次构建之间，`player.js` 内容变了但 `?v1.1.6` 完全没动。浏览器将旧 `player.js?v1.1.6` 以 immutable 缓存一年，新装插件后客户端仍运行旧 JS。

加上 `plugin.json` 里 `staticHash: false`（关闭了官方内容 hash 改名的防缓存机制，该设置继承自上游），`?v=` 成了唯一的防缓存击穿手段，而它失效了。

### 第 3 层：自动更新探针损坏（兜底层失效）

`index.html` 里的 `checkLocalVersionUpdate()` 函数本意是：当 index.html 也被缓存卡住时，用 `fetch + cache:no-store` 拉取最新版并与当前版本比对，发现不一致则强制刷新。但探针的正则写的是 `/const APP_VERSION = ['"](.*?)['"]/`，而页面中的真实标记是 `window.APP_VERSION = 'v1.1.3'`（`index.html:2361`）——**正则从不匹配，探针是死代码**。这个 bug 继承自上游（上游同样存在 `window.APP_VERSION` vs `/const APP_VERSION/` 不匹配）。

---

## 三、问题链路（一图流）

```
上传新插件 zip
  → 宿主重新解压，磁盘上 static/* 已是新文件    （服务端内容：已更新 ✓）
  → 客户端请求 index.html                        （no-cache，拉到新的 ✓）
  → 新 index.html 仍引用 player.js?v1.1.6        （URL 一个字符没变 ✗）
  → 浏览器命中 immutable 一年缓存的旧 player.js   （客户端拿到：旧数据 ✗）
```

`immutable` 是关键：普通 `max-age` 至少还会发一次条件请求，**`immutable` 是连请求都不发**，所以"旧设备不及时更新"比普通缓存失效更顽固。

---

## 四、解决方案思路建议

### 方案 A（推荐，根本性修复）：构建时自动生成 `?v=`（插件侧）

**思路**：写一个构建脚本（或修改 `package.json` 的 build 脚本），在 esbuild 打包或拷贝静态文件后，将 `index.html` 里所有 `<script src="./static/x.js?v=...">` 的 `?v=` 替换为对应文件内容的 sha256 前缀（8 位）。

**效果**：
- 文件内容没变 → `?v=` 不变 → 继续吃 1 年 immutable 缓存（性能最优）；
- 文件内容变了 → `?v=` 自动变 → URL 变 → 旧浏览器缓存自动失效 → 新装插件即时生效；
- 无需手工 bump，和 `APP_VERSION` 完全解耦。

**改动范围**：一个构建脚本 + `package.json` 的 build 命令。`index.html` 本身不需要动（脚本自动替换）。

**示例**：`node scripts/inject-version-hashes.mjs`，读取 `dist/_build/static/*.js` 计算 sha256[:8]，替换 `dist/_build/static/index.html` 里的 `?v=` 值。

### 方案 B（备选）：改回 `staticHash: true`

**思路**：把 `plugin.json` 的 `staticHash: false` 删掉或改回 `true`，让 builder 自动对静态资源做内容 hash 改名（`name.<hash8>.ext`）。

**注意**：builder 的 `collectPinnedAssets` 会把在 HTML 中被引用的 JS 文件锚定不重命名，只重命名未被引用的资产。而本项目 `index.html` 的引用格式是 `./static/x.js`，builder 的 pinning 逻辑是否命中取决于路径格式。需要构建后验证改名是否生效。可能不如方案 A 直接可控。

### 方案 C（可选，兜底）：修好探针正则

**改动**：`static/index.html` 里 `/const APP_VERSION/` 改为 `/window\.APP_VERSION\s*=\s*['"](.*?)['"]/`。

**效果**：为"真的缓存了旧 index.html"的极端情况（如 iOS 固化、PWA Service Worker 拦截）提供自动刷新兜底。注意服务端已给 index.html 发 `no-cache`，这个场景在正常浏览器上很少发生。

### 方案 D（可选，保守）：人工 bump `?v=` 业务纪律

**思路**：每次发版前，手动检查每个 `static/*.js` 是否有内容变化，有则 bump `?v=`。

**缺点**：上游虽然靠这个撑了 30 个 tag，但 S 版已经漏了一次。"人工纪律"不是机制保证，迟早再漏。不推荐。

---

## 五、优先级建议

| 优先级 | 做什么 | 为什么 |
| --- | --- | --- |
| **P0** | 实施方案 A（自动 `?v=`） | 根除问题，一次性解决 |
| P1 | 修探针正则（方案 C） | 低风险兜底，顺手修掉 |
| P2 | 评估 `staticHash` 是否打开 | 与方案 A 不冲突，锦上添花 |

---

## 附：关键证据索引

| 证据 | 位置 |
| --- | --- |
| 服务端缓存头（HTML no-cache / 子资源 immutable 1年） | `songloft-server/internal/jsplugin/routes.go:399-444`（第 435、441 行） |
| 服务端缓存设计意图（#278） | `songloft-server/internal/jsplugin/routes.go:31-61` |
| 插件 `staticHash: false` | `plugin.json:19` |
| 手工 `?v=` 引用（9 个 script 标签） | `static/index.html:1445-1453` |
| 真实版本标记 `window.APP_VERSION` | `static/index.html:2361` |
| 探针正则（不匹配，死代码） | `static/index.html:3844-3861`（正则第 3848 行） |
| Android 壳强制绕过缓存 | `android/.../MainActivity.java:113,154`（`LOAD_NO_CACHE` + `clearCache`） |
| 上游探针同样损坏 | 上游 `static/index.html`（`window.APP_VERSION` vs `/const APP_VERSION/`） |
| S 版 player.js 内容变而 `?v` 未变 | `dist/_build/static/player.js`（935 行） vs 已发布 zip（894 行），`?v1.1.6` 相同 |
| entryHash/zipHash 不对称（纯 static 更新对 entryHash 不可见） | `dist/_build/plugin.json`（entryHash `46782c82…` 同已发布 zip，zipHash `ed808b04…` 不同） |

---

*分析日期：2026-08-18*
