# iWebPlayer-S Dev 插件自动版本与自动更新方案

> 适用分支：`dev`  
> 适用 Workflow：`.github/workflows/build-plugin-dev.yml`

## 一、项目背景

iWebPlayer-S 插件存在正式版 `main` 和开发版 `dev`。

开发版通过 GitHub Actions 自动构建，并发布到 GitHub Pre-release。

当前开发版的基础版本例如：

```text
1.1.6-dev
```

代码每次提交后都会重新构建插件。如果每次构建仍然使用相同版本：

```text
1.1.6-dev
```

那么虽然插件文件内容发生了变化，Songloft 后台进行版本比较时仍然看到：

```text
本地版本：1.1.6-dev
远程版本：1.1.6-dev
```

因此会认为已经是最新版本，无法正常触发自动更新。

---

# 二、当前方案存在的问题

## 2.1 同版本覆盖导致 Songloft 无法发现更新

例如连续构建：

```text
第一次：1.1.6-dev
第二次：1.1.6-dev
第三次：1.1.6-dev
```

GitHub Pre-release 虽然被覆盖，但版本号没有变化。

因此：

```text
远程版本 == 本地版本
```

Songloft 无法判断存在新的开发构建。

---

## 2.2 `download_url` 可能一直指向旧版本

如果动态下载地址直接保存在 `plugin.json`，每次构建都必须修改：

```json
"download_url": "..."
```

容易出现：

```text
version = 1.1.6.02-dev
download_url = 1.1.6.01-dev.zip
```

即：

> 版本号是新的，但下载地址仍然是旧版本。

这是当前方案中的重要逻辑 Bug。

---

## 2.3 构建版本与仓库版本容易不一致

假设 CI 已经计算出：

```text
1.1.6.04-dev
```

但 GitHub 仓库里的 `plugin.json` 仍然是：

```text
1.1.6-dev
```

如果构建过程直接使用仓库中的 `plugin.json`，那么最终 ZIP 内可能仍然是：

```text
1.1.6-dev
```

导致：

```text
CI 计算版本：1.1.6.04-dev
ZIP 内版本：1.1.6-dev
```

因此构建阶段必须临时使用本次实际构建版本。

---

# 三、最终设计目标

方案需要满足：

1. `plugin.json` 保存基础版本。
2. 每次 CI 自动生成递增的 Dev 构建版本。
3. 同一个基础版本继续使用同一个 Pre-release。
4. 每次构建覆盖该 Pre-release 中的插件。
5. ZIP 内的 `plugin.json` 使用实际构建版本。
6. `manifest.json` 保存当前最新版本和真实下载地址。
7. Release 上传成功后才更新 `manifest.json`。
8. `manifest.json` 不触发当前构建 Workflow，避免循环。
9. 上游基础版本变化时，只需人工修改 `plugin.json`。
10. 普通代码提交无需手动修改版本号。

---

# 四、核心架构

最终将信息拆分成两个文件。

## 4.1 `plugin.json`

负责：

- 插件基础信息
- 基础版本
- Songloft 更新入口

例如：

```json
{
  "name": "iWebPlayer-S",
  "version": "1.1.6-dev",
  "updateUrl": "https://raw.githubusercontent.com/MbAIGC/songloft-plugin-iwebplayer-S/dev/manifest.json"
}
```

其中：

```text
version
```

表示基础版本系列。

---

## 4.2 `manifest.json`

负责：

- 当前实际发布版本
- 当前实际下载地址

例如：

```json
{
  "version": "1.1.6.04-dev",
  "download_url": "https://github.com/MbAIGC/songloft-plugin-iwebplayer-S/releases/download/dev-1.1.6/iwebplayer-s-v1.1.6.04-dev.jsplugin.zip"
}
```

`manifest.json` 完全由 GitHub Actions 自动维护。

---

# 五、两个文件的职责

| 文件 | 作用 | 修改方式 |
|---|---|---|
| `plugin.json` | 基础版本、插件信息、更新入口 | 人工 |
| `manifest.json` | 当前最新开发版本、下载地址 | CI 自动 |

核心原则：

> `plugin.json` 管“基础版本”，`manifest.json` 管“当前实际发布版本”。

---

# 六、版本规则

基础版本：

```text
1.1.6-dev
```

每次 CI 构建自动生成：

```text
1.1.6.01-dev
1.1.6.02-dev
1.1.6.03-dev
1.1.6.04-dev
...
```

其中：

```text
1.1.6
```

是基础版本。

```text
01 / 02 / 03 / 04
```

是构建序号。

```text
-dev
```

表示开发版。

---

# 七、构建序号如何持久化

不能每次都简单执行：

```text
读取 plugin.json
↓
1.1.6-dev
↓
+1
↓
1.1.6.01-dev
```

否则下一次仍然会得到：

```text
1.1.6.01-dev
```

因此构建序号必须从一个持久存在的位置获取。

最终方案：

> 从当前 Dev Pre-release 中已有的插件 ZIP 文件名解析最大构建序号。

例如 Release：

```text
dev-1.1.6
```

已有：

```text
iwebplayer-s-v1.1.6.01-dev.jsplugin.zip
iwebplayer-s-v1.1.6.02-dev.jsplugin.zip
iwebplayer-s-v1.1.6.03-dev.jsplugin.zip
```

CI 解析得到：

```text
当前最大序号 = 03
```

然后：

```text
03 + 1 = 04
```

生成：

```text
1.1.6.04-dev
```

---

# 八、Release 规则

同一个基础版本使用同一个 Pre-release。

例如：

```text
plugin.json
version = 1.1.6-dev
```

对应：

```text
Release Tag
dev-1.1.6
```

后续：

```text
1.1.6.01-dev
1.1.6.02-dev
1.1.6.03-dev
1.1.6.04-dev
```

都发布到：

```text
dev-1.1.6
```

新的构建覆盖旧 ZIP。

最终 Release 中只保留最新插件，例如：

```text
dev-1.1.6
└── iwebplayer-s-v1.1.6.04-dev.jsplugin.zip
```

---

# 九、完整 Workflow 执行链

最终 `build-plugin-dev.yml` 的执行流程：

```text
① Checkout dev
        ↓
② 安装依赖 / 准备构建环境
        ↓
③ 读取 plugin.json
        ↓
④ 读取基础 version
        ↓
   例如：
   1.1.6-dev
        ↓
⑤ 确定 Release Tag
        ↓
   dev-1.1.6
        ↓
⑥ 查询当前 Release
        ↓
⑦ 获取 Release Assets
        ↓
⑧ 查找已有插件 ZIP
        ↓
⑨ 解析最大构建序号
        ↓
   例如：
   .03
        ↓
⑩ 自动 +1
        ↓
   .04
        ↓
⑪ 生成本次构建版本
        ↓
   1.1.6.04-dev
        ↓
⑫ 临时修改 Runner 中的 plugin.json
        ↓
   version = 1.1.6.04-dev
        ↓
⑬ Typecheck / Test
        ↓
⑭ Build plugin
        ↓
⑮ Verify
        ↓
⑯ 检查 ZIP 内 plugin.json
        ↓
   必须是：
   1.1.6.04-dev
        ↓
⑰ 生成最终 ZIP
        ↓
   iwebplayer-s-v1.1.6.04-dev.jsplugin.zip
        ↓
⑱ 上传 GitHub Actions Artifact
        ↓
⑲ 上传 / 覆盖 Pre-release
        ↓
⑳ 确认 Release Asset 上传成功
        ↓
㉑ 生成 manifest.json
        ↓
㉒ 写入 version
        ↓
㉓ 写入 download_url
        ↓
㉔ 恢复原始 plugin.json
        ↓
㉕ git add manifest.json
        ↓
㉖ git commit
        ↓
㉗ git push origin dev
```

---

# 十、为什么构建时必须临时修改 `plugin.json`

GitHub 仓库中的：

```text
plugin.json
version = 1.1.6-dev
```

代表基础版本。

本次 CI 计算出的实际版本：

```text
1.1.6.04-dev
```

因此构建前需要在 Runner 工作目录临时修改：

```text
1.1.6-dev
↓
1.1.6.04-dev
```

然后执行构建。

这样最终 ZIP 内的 `plugin.json` 才会是：

```json
{
  "version": "1.1.6.04-dev"
}
```

而不是：

```json
{
  "version": "1.1.6-dev"
}
```

---

# 十一、为什么不能把构建版本提交回仓库

构建完成后，Runner 中的：

```text
plugin.json
```

已经变成：

```text
1.1.6.04-dev
```

但 GitHub 仓库应该继续保持：

```text
1.1.6-dev
```

因此构建完成后必须恢复：

```text
1.1.6.04-dev
↓
1.1.6-dev
```

然后只提交：

```text
manifest.json
```

最终仓库：

```text
plugin.json
    ↓
1.1.6-dev

manifest.json
    ↓
1.1.6.04-dev
```

---

# 十二、ZIP 内版本校验

为了防止版本不一致，构建后必须验证 ZIP。

CI 计算：

```text
Expected Version
1.1.6.04-dev
```

然后读取 ZIP 内的：

```text
plugin.json
```

检查：

```text
plugin.json.version
```

必须等于：

```text
1.1.6.04-dev
```

只有：

```text
Expected = ZIP 内 Version
```

才允许继续发布。

否则 Workflow 直接失败。

---

# 十三、Release 上传顺序

必须遵循：

```text
Build
 ↓
ZIP
 ↓
Release Upload
 ↓
确认 Asset 存在
 ↓
生成 manifest.json
 ↓
commit + push
```

不能：

```text
Build
 ↓
先修改 manifest
 ↓
再上传 Release
```

否则可能产生：

```text
manifest：

version = 1.1.6.04-dev
download_url = xxx.04-dev.zip
```

但是 Release 中实际没有：

```text
xxx.04-dev.zip
```

Songloft 就会拿到一个无效下载地址。

因此：

> `manifest.json` 必须是成功发布 Release Asset 后的最终产物。

---

# 十四、`manifest.json` 的生成规则

本次构建：

```text
VERSION=1.1.6.04-dev
```

Release：

```text
dev-1.1.6
```

ZIP：

```text
iwebplayer-s-v1.1.6.04-dev.jsplugin.zip
```

最终生成：

```json
{
  "version": "1.1.6.04-dev",
  "download_url": "https://github.com/MbAIGC/songloft-plugin-iwebplayer-S/releases/download/dev-1.1.6/iwebplayer-s-v1.1.6.04-dev.jsplugin.zip"
}
```

`download_url` 必须根据本次构建动态生成。

不能继续使用旧版本地址。

---

# 十五、Songloft 更新链路

插件中的：

```json
"updateUrl": "https://raw.githubusercontent.com/MbAIGC/songloft-plugin-iwebplayer-S/dev/manifest.json"
```

指向：

```text
GitHub Raw
    ↓
dev/manifest.json
```

例如：

```json
{
  "version": "1.1.6.04-dev",
  "download_url": "..."
}
```

Songloft 检查更新时：

```text
本地版本：
1.1.6.03-dev

远程版本：
1.1.6.04-dev
```

发现：

```text
远程版本 > 本地版本
```

然后通过：

```text
download_url
```

下载新的插件。

---

# 十六、正常开发流程

假设当前：

```text
plugin.json
version = 1.1.6-dev
```

## 第一次提交

生成：

```text
1.1.6.01-dev
```

Release：

```text
dev-1.1.6
```

manifest：

```json
{
  "version": "1.1.6.01-dev",
  "download_url": "...01-dev.jsplugin.zip"
}
```

---

## 第二次提交

读取 Release 中已有：

```text
1.1.6.01-dev
```

自动生成：

```text
1.1.6.02-dev
```

---

## 第三次提交

生成：

```text
1.1.6.03-dev
```

---

## 第四次提交

生成：

```text
1.1.6.04-dev
```

最终：

```text
dev-1.1.6
└── iwebplayer-s-v1.1.6.04-dev.jsplugin.zip
```

manifest：

```json
{
  "version": "1.1.6.04-dev",
  "download_url": "...04-dev.jsplugin.zip"
}
```

---

# 十七、上游版本更新

当上游版本从：

```text
1.1.6
```

升级到：

```text
1.1.7
```

只需要人工修改：

```json
"version": "1.1.7-dev"
```

提交后 CI 自动发现：

```text
dev-1.1.7
```

不存在。

于是：

```text
构建序号 = 0
↓
+1
↓
1.1.7.01-dev
```

之后：

```text
1.1.7.02-dev
1.1.7.03-dev
1.1.7.04-dev
...
```

---

# 十八、版本体系

最终版本体系：

```text
1.1.6-dev
│
├── 1.1.6.01-dev
├── 1.1.6.02-dev
├── 1.1.6.03-dev
└── 1.1.6.04-dev
```

升级基础版本：

```text
1.1.7-dev
│
├── 1.1.7.01-dev
├── 1.1.7.02-dev
├── 1.1.7.03-dev
└── ...
```

---

# 十九、Release 结构

最终：

```text
GitHub Releases
│
├── dev-1.1.6
│   └── iwebplayer-s-v1.1.6.04-dev.jsplugin.zip
│
├── dev-1.1.7
│   └── iwebplayer-s-v1.1.7.03-dev.jsplugin.zip
│
└── ...
```

每个基础版本对应一个 Dev Pre-release。

---

# 二十、Workflow 防止自触发

Workflow 不应该监听：

```text
manifest.json
```

因为 CI 最后会：

```text
修改 manifest.json
↓
git commit
↓
git push
```

如果 Workflow 监听 `manifest.json`，就会：

```text
Workflow
↓
修改 manifest
↓
push
↓
Workflow 再次启动
↓
修改 manifest
↓
push
↓
无限循环
```

因此：

> `manifest.json` 的更新不能触发 `build-plugin-dev.yml`。

---

# 二十一、失败保护

以下任何步骤失败，都不能更新 `manifest.json`：

```text
Build 失败
    ↓
停止

ZIP 生成失败
    ↓
停止

ZIP 内版本校验失败
    ↓
停止

Release 上传失败
    ↓
停止

Release Asset 验证失败
    ↓
停止
```

只有：

```text
Build
 ↓
ZIP
 ↓
Version Verify
 ↓
Release Upload
 ↓
Asset Verify
```

全部成功后，才：

```text
生成 manifest.json
 ↓
git commit
 ↓
git push
```

---

# 二十二、特殊情况：Release 不存在

例如：

```text
plugin.json
version = 1.1.8-dev
```

但是：

```text
dev-1.1.8
```

不存在。

则：

```text
构建序号 = 0
↓
+1
↓
1.1.8.01-dev
```

然后创建：

```text
dev-1.1.8
```

---

# 二十三、特殊情况：Release 存在但没有 ZIP

如果：

```text
dev-1.1.6
```

存在，但是没有有效插件 ZIP：

```text
构建序号 = 0
```

下一次：

```text
1.1.6.01-dev
```

---

# 二十四、特殊情况：多个 ZIP

例如：

```text
iwebplayer-s-v1.1.6.01-dev.jsplugin.zip
iwebplayer-s-v1.1.6.02-dev.jsplugin.zip
iwebplayer-s-v1.1.6.03-dev.jsplugin.zip
iwebplayer-s-v1.1.6.04-dev.jsplugin.zip
```

CI 取最大值：

```text
04
```

下一次：

```text
05
```

---

# 二十五、特殊情况：人工修改基础版本

例如：

```text
1.1.6-dev
```

修改为：

```text
1.2.0-dev
```

CI 查找：

```text
dev-1.2.0
```

而不是继续读取：

```text
dev-1.1.6
```

因此从：

```text
1.2.0.01-dev
```

重新开始。

---

# 二十六、最终仓库结构

```text
songloft-plugin-iwebplayer-S
│
├── plugin.json
├── manifest.json
├── package.json
├── package-lock.json
├── src/
├── static/
│
└── .github/
    └── workflows/
        └── build-plugin-dev.yml
```

---

# 二十七、`plugin.json` 最终示例

```json
{
  "name": "iWebPlayer-S",
  "version": "1.1.6-dev",
  "updateUrl": "https://raw.githubusercontent.com/MbAIGC/songloft-plugin-iwebplayer-S/dev/manifest.json"
}
```

注意：

`plugin.json` 不保存动态 `download_url`。

---

# 二十八、`manifest.json` 最终示例

```json
{
  "version": "1.1.6.04-dev",
  "download_url": "https://github.com/MbAIGC/songloft-plugin-iwebplayer-S/releases/download/dev-1.1.6/iwebplayer-s-v1.1.6.04-dev.jsplugin.zip"
}
```

这个文件由 CI 自动生成和更新。

---

# 二十九、完整数据流

```text
                    GitHub Repository
                           │
                           │
                    plugin.json
                           │
                           ▼
                       1.1.6-dev
                           │
                           ▼
                   GitHub Actions
                           │
                           ▼
                  查询 Dev Release
                           │
                           ▼
                  获取当前最大序号
                           │
                           ▼
                          +1
                           │
                           ▼
                    1.1.6.04-dev
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
       临时修改 plugin.json           ZIP 文件
              │                         │
              ▼                         ▼
            Build              v1.1.6.04-dev.zip
              │                         │
              └────────────┬────────────┘
                           │
                           ▼
                    GitHub Release
                      dev-1.1.6
                           │
                           ▼
                    验证 Asset
                           │
                           ▼
                   生成 manifest.json
                           │
                           ▼
                      Git Push
                           │
                           ▼
                     GitHub Raw
                           │
                           ▼
                    Songloft
                           │
                           ▼
                    检查新版本
                           │
                           ▼
                      自动更新
```

---

# 三十、最终原则

## 原则 1

`plugin.json` 保存基础版本，不保存动态构建版本。

## 原则 2

`manifest.json` 保存当前实际发布版本和下载地址。

## 原则 3

每次 CI 自动递增构建序号。

## 原则 4

构建序号从当前 Dev Release 的插件 ZIP 文件名中获取。

## 原则 5

构建阶段临时修改 Runner 中的 `plugin.json`。

## 原则 6

ZIP 内的 `plugin.json` 必须使用实际构建版本。

## 原则 7

构建完成后恢复原始 `plugin.json`，不提交构建版本。

## 原则 8

Release Asset 上传成功后才能更新 `manifest.json`。

## 原则 9

`download_url` 必须根据本次构建动态生成。

## 原则 10

`manifest.json` 不触发 `build-plugin-dev.yml`。

## 原则 11

基础版本由人工控制。

## 原则 12

普通代码提交无需人工修改构建序号。

---

# 三十一、最终效果

开发者日常只需要：

```text
修改代码
↓
git commit
↓
git push
```

GitHub Actions 自动完成：

```text
读取基础版本
↓
读取当前最大构建序号
↓
自动 +1
↓
生成新版本
↓
临时修改 plugin.json
↓
构建插件
↓
校验 ZIP 内版本
↓
上传 Pre-release
↓
确认上传成功
↓
生成 manifest.json
↓
更新 download_url
↓
提交 manifest.json
```

Songloft：

```text
读取 updateUrl
↓
获取 manifest.json
↓
比较版本
↓
发现新版本
↓
读取 download_url
↓
下载新 ZIP
↓
完成更新
```

---

# 三十二、一句话总结

最终采用：

```text
plugin.json
    ↓
基础版本 + 更新入口

manifest.json
    ↓
当前最新开发版本 + 下载地址

GitHub Release
    ↓
实际插件 ZIP

GitHub Actions
    ↓
自动递增 + 构建 + 发布 + 更新 manifest
```

实现：

> **人工控制大版本，CI 自动控制开发构建序号，GitHub Release 保存实际插件，manifest.json 提供实时更新信息，Songloft 通过 updateUrl 自动发现并安装最新开发版本。**
