# iWebPlayer-S — AI Agent 指南

## 项目概述

iWebPlayer-S 是 SongLoft 平台的播放器插件，基于 iWebPlayer 适配宽屏设备（笔记本、安卓平板）并打包 APK。

- **插件入口**：`iwebplayer-s`
- **构建工具**：`@songloft/plugin-builder`
- **包管理**：npm
- **Android 构建**：Gradle（`android/` 目录）

---

## 版本号规范

> ### ⛔ 硬性约束：未经用户明确许可，不得改动
>
> 版本号与插件编译版本是**刻意设计**的流水线，完整设计见
> [`docs/DEV_PLUGIN_AUTO_UPDATE_DESIGN.md`](docs/DEV_PLUGIN_AUTO_UPDATE_DESIGN.md)（文末「最终原则」共 10 条）。
> **不要"优化"、不要"修 bug"、不要顺手重排**这套规则；提升版本号只在两种情况下进行：
> ① 用户明确指示；② **跟进上游版本时按默认规范自动同步**（见下表，无需再单独确认）。
> （已发生：2026-09-12 按用户要求 `1.1.7-dev` → `1.3.2-dev`；2026-09-18 跟进上游 v1.3.5 → `1.3.5-dev`）。

| 规则 | 说明 |
| --- | --- |
| `plugin.json` 只保存**基础版本**（base） | 仓库中永远不出现 `1.3.5.01-dev` 这类构建版本 |
| 构建版本由 CI 自动递增 | `X.Y.Z-dev` → `X.Y.Z.NN-dev`；序号从该 tag 下已有 zip 文件名解析最大值 +1 |
| 构建时临时改 Runner 内的 `plugin.json` | 构建完成后恢复为 base，**构建版本不提交回仓库** |
| `manifest.json` 完全由 CI 维护 | 保存「当前实际发布版本 + 动态 download_url」；**禁止手工编辑**，它不在触发路径内以避免循环 |
| dev tag = `dev-<base 去掉 -dev>` | `1.3.5-dev` → `dev-1.3.5`；**同一基础版本共用一个 tag**，每次构建只追加 zip，不删历史资产 |
| Release 标题 = tag（裸格式） | 两个 dev 工作流都写成 `dev-1.3.5`，不出现 `iWebPlayer-S dev v...` 这类标题 |
| **跟进上游时必须同步提升版本号** | **默认规范**：每次跟进上游（如上游发布 v1.3.5）就把 base 版本改为「上游版本 + `-dev`」（`1.3.5-dev`），并同步 `README.md` badge/文件名、`DEV_RELEASE_NOTES.md` 标题与条目、本页版本表；这是跟进的固定动作，不需要再单独确认 |
| 正式版 `Latest` 只属于 main | dev 一律 `--prerelease`，绝不抢 Latest |

### 当前版本

| 位置 | 版本 | 说明 |
| --- | --- | --- |
| `plugin.json` | `1.3.5-dev` | 插件**基础版本**，SongLoft 读取；CI 构建时临时改为 `1.3.5.NN-dev` |
| `package.json` | `1.3.5-dev` | npm 包版本，应与 plugin.json 一致 |
| `package-lock.json` | `1.3.5-dev` | 锁文件，运行 `npm install --package-lock-only` 同步 |
| `static/index.html` | 占位符 `__APP_VERSION__` | **不要手写版本号**：构建期由 `scripts/inject-version-hashes.mjs` 注入实际构建版本 |
| `README.md` badge | `v1.3.5` | Shields.io 徽章 |
| `DEV_RELEASE_NOTES.md` | `dev v1.3.5` | 预发布说明标题，CI 直接读作 release notes |
| `manifest.json` | `1.3.5.NN-dev`（示例） | CI 自动生成的最新构建版本 + 下载地址，**勿手改** |

### 版本号格式

- **dev 分支**：基础版本 `X.Y.Z-dev`（如 `1.3.5-dev`）；CI 构建版本 `X.Y.Z.NN-dev`（如 `1.3.5.01-dev`）
- **main 分支**：`X.Y.Z`（如 `1.3.5`，无任何后缀）
- Release tag：dev 为 `dev-X.Y.Z`，main 为 `vX.Y.Z`

### 版本升级 checklist

**仅在用户明确要求提升版本时**执行，需同步更新：

1. `plugin.json` — `"version"` 字段（base，带 `-dev`）
2. `package.json` — `"version"` 字段
3. `package-lock.json` — 运行 `npm install --package-lock-only` 自动更新
4. `README.md` — badge URL、zip 文件名引用、版本号文字
5. `DEV_RELEASE_NOTES.md` — 标题版本号 + 新增功能条目
6. `AGENT.md` — 本页「当前版本」表

**不要动**：

- `static/index.html` 的 `window.APP_VERSION`（保持 `__APP_VERSION__` 占位符）；
- `manifest.json`（CI 在发布成功后自动提交）；
- 任何工作流里的版本 / tag / 构建序号推导逻辑。

### CI/CD 自动构建

| Workflow | 触发 | 产物 / 去向 |
| --- | --- | --- |
| `build-plugin.yml` | `main`（`src/**`、`static/**`、`plugin.json`、`package.json`、`package-lock.json`、`DEV_RELEASE_NOTES.md`） | `iwebplayer-s-v<版本>.jsplugin.zip` → 稳定 Release（Latest） |
| `build-apk.yml` | `main`（同上 + `android/**`） | `iWebPlayer-S-v<版本>.apk`（并附带插件 zip） |
| `build-plugin-dev.yml` | `dev`（`src/**`、`static/**`、`plugin.json`、`package.json`、`package-lock.json`、自身） | `iwebplayer-s-v<X.Y.Z.NN-dev>.jsplugin.zip` → 预发行 `dev-X.Y.Z`，并更新根级 `manifest.json` |
| `build-apk-dev.yml` | `dev`（`android/**`、`plugin.json`、自身） | `iWebPlayer-S-v<X.Y.Z-dev>.apk`（并附带插件 zip）→ 同一个预发行 `dev-X.Y.Z` |
| `build-plugin-dev-old.yml` | 已停用（分支过滤为 `__disabled_never__`） | 旧版「固定覆盖同名 zip」流程，仅作历史保留 |

- 两个 dev 工作流共享 `concurrency: group: dev-release`（`cancel-in-progress: false`），串行写同一个 Release，避免互相覆盖。
- 插件构建带质量门禁：类型检查 → 单测 → 构建 → 产物一致性校验（zip 内 `plugin.json` 版本必须等于本次构建版本）。

**Release 线**：

- `dev` 分支 → `dev-X.Y.Z` 预发行 tag（标题=tag，含插件 zip + APK，历史 zip 全部保留）
- `main` 分支 → 稳定 Release（Latest，含插件 zip + APK）
- 插件自动更新的入口是根级 `manifest.json`，它始终指向最新一次 dev 构建

---

## 代码结构

```
/
├── static/                  # 前端静态文件（核心）
│   ├── index.html           # 主页面（CSS + 内联脚本 + APP_VERSION 占位符）
│   ├── player.js            # 播放器逻辑、进度拖拽、封面/歌词抓取入口
│   ├── playlist.js          # 歌单、曲库同步与缓存（IndexedDB / localStorage）
│   ├── online.js            # 在线资源（LXMusic / WebDAV 搜索与浏览）
│   ├── miot.js              # 小爱音箱（MIoT）设备、虚拟时钟、推送歌单
│   ├── plugins.js           # 音源插件与音质设置
│   ├── lyrics.js            # 歌词引擎（含 KTV 逐字歌词）
│   ├── utils.js             # 工具函数、ConfigManager 四象限配置沙盒
│   ├── idb.js               # IndexedDB 缓存封装
│   ├── icons.js / sw.js     # 图标与 Service Worker
│   └── lz-string.min.js     # 压缩依赖（缓存压缩用）
├── src/                     # TypeScript 后端（插件入口）
│   ├── main.ts              # 插件主入口与路由（/musiclist、/scrape、/store 等）
│   ├── scraper.ts           # 封面/歌词刮削
│   ├── webdav.ts            # WebDAV 支持
│   └── types.d.ts           # 类型声明
├── scripts/                 # 构建脚本
│   ├── inject-version-hashes.mjs  # 注入 ?v= 内容哈希与 APP_VERSION
│   └── verify-build.mjs           # 产物一致性校验
├── android/                 # Android APK 构建（Gradle）
├── tests/                   # vitest 用例
├── docs/                    # 文档目录
├── .github/workflows/       # CI/CD 工作流
├── manifest.json            # 自动更新清单（CI 维护）
├── plugin.json              # 插件元数据（base 版本号在此）
└── package.json             # npm 配置与脚本
```

## 关键约定

1. **dev 分支**是活跃开发分支，所有新功能先合入 dev
2. **main 分支**是稳定版，从 dev 合入
3. 文档文件统一放在 `docs/` 目录（`README.md`、`DEV_RELEASE_NOTES.md`、`AGENT.md` 除外）
4. `DEV_RELEASE_NOTES.md` 由 CI 自动读入 pre-release notes，开发者只需更新功能描述列表
5. 构建时 `inject-version-hashes.mjs` 自动计算内容哈希并注入 `?v=`：覆盖 `./static/*.js`、`<meta id="app-logo">` 的 logo 图片（页头 / favicon / apple-touch-icon）、PWA `manifest.json` 本体及其 `icons[]`。无需手动维护缓存版本号；源码里的 `?v0.8.0` 等是历史占位值，构建时会被覆盖（不回写源码）。宿主对子资源发 `immutable, max-age=1年`，**新增任何图片/字体等子资源时都要纳入该脚本**
6. **版本号 / 构建版本 / tag / manifest 规则不得擅自改动**（见上文「硬性约束」）
7. **部分文件是 CRLF 行尾**：`static/playlist.js`、`static/miot.js`、`static/online.js`、`static/plugins.js`、`static/utils.js`、`static/icons.js`（`static/player.js` 为混合行尾）。
   编辑这些文件时不要用会把整文件转成 LF 的方式，否则 diff 会被换行符淹没；建议做字节级替换，改完用
   `git diff --stat` 确认没有全文改动。
8. **上游同步策略**：上游 [`songloft-org/songloft-plugin-iwebplayer`](https://github.com/songloft-org/songloft-plugin-iwebplayer)
   只能**手工按功能移植**，不要 merge / cherry-pick（本项目已大幅分叉，`index.html`、`player.js`、`src/main.ts` 等冲突面很大）。
   **跟进时按默认规范同步提升 base 版本号**（上游 v1.3.5 → `1.3.5-dev`），并同步 README / DEV_RELEASE_NOTES / 本页版本表。
   已有评估与实施记录见 `docs/IWP-1.1.7上游优化与本地跟进评估.md`、`docs/IWP-1.1.8-1.3.2上游跟进评估.md`、`docs/IWP-1.3.3-1.3.5上游跟进记录.md`。
9. **提交前自检**（与 CI 质量门禁对齐）：

   ```bash
   npm test                                        # vitest 单测
   npx tsc --noEmit                                # 类型检查
   npm run build                                   # 构建 + 注入哈希
   git -c core.whitespace=cr-at-eol diff --check    # CRLF 仓库需允许 CR 作为行尾
   ```
