# iWebPlayer-S — AI Agent 指南

## 项目概述

iWebPlayer-S 是 SongLoft 平台的播放器插件，基于 iWebPlayer 适配宽屏设备（笔记本、安卓平板）并打包 APK。

- **插件入口**：`iwebplayer-s`
- **构建工具**：`@songloft/plugin-builder`
- **包管理**：npm
- **Android 构建**：Gradle（`android/` 目录）

---

## 版本号规范

### 当前版本

| 位置 | 版本 | 说明 |
|------|------|------|
| `plugin.json` | `1.1.6-dev` | 插件主版本号，SongLoft 系统读取 |
| `package.json` | `1.1.6-dev` | npm 包版本，应与 plugin.json 一致 |
| `package-lock.json` | `1.1.6-dev` | 锁文件，运行 `npm install` 自动同步 |
| `static/index.html` | `v1.1.6` | 前端显示版本探针 (`window.APP_VERSION`) |
| `README.md` badge | `v1.1.6` | Shields.io 徽章 |
| `DEV_RELEASE_NOTES.md` | `v1.1.6` | 预发布说明标题 |

### 版本号格式

- **dev 分支**：`X.Y.Z-dev`（如 `1.1.6-dev`）
- **main 分支**：`X.Y.Z`（如 `1.1.6`，无 `-dev` 后缀）

### 版本升级 checklist

修改版本号时，需要同步更新以下所有文件：

1. `plugin.json` — `"version"` 字段
2. `package.json` — `"version"` 字段
3. `package-lock.json` — 运行 `npm install --package-lock-only` 自动更新
4. `static/index.html` — `window.APP_VERSION = 'vX.Y.Z'`
5. `README.md` — badge URL 和版本号文字引用
6. `DEV_RELEASE_NOTES.md` — 标题版本号 + 新增功能条目

### CI/CD 自动构建

| Workflow | 产物 | 触发条件 |
|----------|------|----------|
| `build-plugin.yml` | 插件 zip (`iwebplayer-s.jsplugin.zip`) | `src/`、`static/`、`plugin.json` 等变更 |
| `build-apk-dev.yml` | APK (`iWebPlayer-S.apk`) | `android/`、`plugin.json` 变更 → `dev` |
| `build-apk.yml` | APK | `android/`、`plugin.json` 变更 → `main` |

**Release 线**：
- `dev` 分支 → `dev-X.Y.Z` 预发布 tag（含插件 zip + APK）
- `main` 分支 → 稳定 release（含插件 zip + APK）

---

## 代码结构

```
/
├── static/              # 前端静态文件（核心）
│   ├── index.html       # 主页面（含 CSS、内联脚本）
│   ├── lyrics.js        # 歌词引擎（KTV 逐字歌词）
│   ├── player.js        # 播放器逻辑
│   ├── playlist.js      # 歌单管理
│   ├── utils.js         # 工具函数
│   └── ...
├── src/                 # TypeScript 后端（插件入口）
│   ├── main.ts          # 插件主入口
│   ├── scraper.ts       # 封面/歌词刮削
│   └── webdav.ts        # WebDAV 支持
├── android/             # Android APK 构建
├── docs/                # 文档目录
├── .github/workflows/   # CI/CD 工作流
├── plugin.json          # 插件元数据（版本号在此）
└── package.json         # npm 配置
```

## 关键约定

1. **dev 分支**是活跃开发分支，所有新功能先合入 dev
2. **main 分支**是稳定版，从 dev 合入
3. 文档文件统一放在 `docs/` 目录（`README.md` 和 `DEV_RELEASE_NOTES.md` 除外）
4. `DEV_RELEASE_NOTES.md` 由 CI 自动读入 pre-release notes，开发者只需更新功能描述列表
5. 构建时 `inject-version-hashes.mjs` 自动计算静态文件内容哈希并注入 `?v=`，无需手动维护缓存版本号