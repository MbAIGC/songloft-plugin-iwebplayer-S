# iWebPlayer-S 逐字歌词（KTV）引擎移植优化记录

> 日期：2026-08-21
> 涉及分支：`dev`
> 涉及提交：`ee1cc81`、`6e52882`

---

## 一、背景

上游仓库 [`songloft-org/songloft-plugin-iwebplayer`](https://github.com/songloft-org/songloft-plugin-iwebplayer) 的 `main` 分支修复了逐字歌词（KTV/卡拉OK）渲染引擎，支持每帧 60FPS 的逐字扫光效果。本地 `dev` 分支需要适配此功能。

## 二、初始分析（2026-08-21）

### 2.1 上游改动范围

仅涉及 **2 个文件**，全部在前端渲染层：

| 文件 | 改动 | 说明 |
|------|------|------|
| `static/lyrics.js` | +126/−36（3 处 diff） | 60FPS rAF 循环、`[[mm:ss.xx]]` 双括号 KTV 解析、逐字 `--progress` 渲染 |
| `static/index.html` | +90 | KTV 双轨 CSS：渐变扫光（轨 1）+ 手机沉浸逐字跳动/流光（轨 2） |

后端（`src/main.ts`、`scraper.ts`）、播放器（`player.js`）、工具（`utils.js`）**均无改动**。

### 2.2 本地基线确认

- 本地 `static/lyrics.js` 与上游修复前版本**逐字节一致**（含 CRLF 行尾）→ 上游 3 处 diff 可直接套用
- 本地 `static/index.html` 歌词 CSS 结构与上游一致，插入点相同（`@keyframes fadeIn` 之后、`.fp-corner-tools` 之前）
- 歌词数据链路（`fetchSongLyric` → SongLoft `/api/v1/songs/{id}/lyric` → LXMusic → 刮削）与上游一致
- 两个仓库**历史无交集**（merge-base 为空，48 文件差异），不能 cherry-pick，只能按文件移植

### 2.3 方案选择

**方案 A（推荐）**：逐字移植 `static/lyrics.js` + `static/index.html` CSS，`player.js`/`src/` 零改动

**方案 B（不推荐）**：尝试合并上游 main → 历史无交集，48 文件差异，不可行

---

## 三、第一轮移植（提交 `ee1cc81`）

### 3.1 操作步骤

1. 用 `git show upstream/main:static/lyrics.js > static/lyrics.js` 替换，保留 CRLF 字节
2. 从上游 `static/index.html` 提取 KTV 双轨 CSS 块（`/* KTV 逐字歌词双轨渲染引擎 */` 至 `.sung { filter: none; }`），插入本地 `@keyframes fadeIn` 与 `.fp-corner-tools` 之间
3. 缓存版本号 `v0.7.1 → v0.7.2`
4. `npm run build` 构建验证（`inject-version-hashes` 自动注入 9 个脚本内容哈希）

### 3.2 验证结果

| 检查项 | 结果 |
|--------|------|
| `lyrics.js` 与上游逐字节一致 | ✅ `5526ab95…` |
| KTV CSS 块与上游逐字节一致 | ✅ |
| JS 语法 `node --check` | ✅ |
| 功能回归（KTV 解析/普通回退/空歌词/逐字进度/锁屏切换） | ✅ 5/5 |
| 干净重建可复现 | ✅ |

### 3.3 推送

```
93ad561..ee1cc81  dev -> dev
```

---

## 四、实测反馈 & 问题发现（2026-08-21）

用户测试后反馈实际 KTV 歌词格式为：

```
[00:37.465]让[00:37.652]我[00:37.877]再[00:38.134]看[00:38.440]你
```

此格式为**单括号逐字格式**（格式 A）：每个字自带 `[mm:ss.xxx]` 绝对时间戳。而上游移植的引擎只识别 `[[mm:ss.xx]]字` 双括号格式（格式 B），导致格式 A 的歌词行被当作普通文本，时间戳原文显示。

### 4.1 根因分析

上游检测逻辑：

```js
let isKtv = text.includes('[[');
```

格式 A 文本 `让[00:37.652]我[00:37.877]再...` 不包含 `[[`，因此 `isKtv = false`，整行被当作纯文本渲染。

### 4.2 修复方案

扩展 `parse()` 函数，新增格式 A 识别与解析分支，同时完全保留格式 B（上游）逻辑不变。

**检测正则**：

```js
let isKtv = text.includes('[[') || /\]\S+\[\d{1,2}:\d{2}/.test(text);
```

`\]\S+\[\d{1,2}:\d{2}` 匹配 `]` + 非空白字 + `[mm:ss` 模式，即 word 先后跟两个时间标签。

**格式 A 解析器**：

```js
const segRegex = /([^\[]+?)\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]/g;
```

- `([^\[]+?)` — 非贪婪匹配 `[` 之前的字词
- `\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]` — 匹配 `[mm:ss.xxx]` 时间戳
- 每个字以绝对时间戳 `abs` 换算相对行首的 offset：`Math.max(0, abs - baseTime)`
- 最后一个字后通常无时间标签，作为 tail 并入

---

## 五、JavaScript 正则陷阱（关键发现）

### 5.1 `[^\[\]]` 字符类问题

初始检测正则写为：

```js
/\]\[^\[\]]+\[\d{1,2}:\d{2}/
```

在 JavaScript 中，字符类 `[^\[\]]` 被解析为：

- `[` — 开始字符类
- `^` — 取反
- `\[` — 字面量 `[`
- `\]` — **字面反斜杠 `\`**，然后 `]` **关闭字符类** ⚠️

所以 `[^\[\]]` 实际等价于 `[^\[`（不含 `[` 和 `\`），再加上字面量 `]`，而不是预期的"不含 `[` 和 `]`"。

**解决方案**：使用 `\S`（非空白符）替代 `[^\[\]]`，或使用 `[^\[\x5d]`（十六进制 `\x5d` 表示 `]`），但 `\x5d` 在字符类中同样会求值为 `]` 并关闭类。最终采用 `\S`（非空白符）：

```js
/\]\S+\[\d{1,2}:\d{2}/
```

### 5.2 `lastIndex` 重置问题

`segRegex` 使用 `g` 标志，`exec()` 返回 `null` 时会重置 `lastIndex = 0`。若之后用 `text.slice(segRegex.lastIndex)` 获取尾部，会得到整个文本。

**解决方案**：在每次成功匹配后保存 `lastIndex`：

```js
let lastSegEnd = 0;
while ((segMatch = segRegex.exec(text)) !== null) {
    // ... 处理匹配 ...
    lastSegEnd = segRegex.lastIndex;
}
const tail = text.slice(lastSegEnd);
```

---

## 六、增强功能

### 6.1 零时长保护

```js
words[i].duration = Math.max(0.01, words[i+1].offset - words[i].offset);
```

防止相邻字时间戳相同时 duration 为 0，导致 `sync()` 中进度计算除零（`progress = NaN`）。

### 6.2 行尾时长标记剥离

部分 KTV 歌词文件在行尾附加结束时间标记：

```
[00:12.00]词[00:20.00]
```

`[00:20.00]` 表示该行歌词持续到 20 秒，非逐字节点。用正则检测并剥离：

```js
const endMark = /^(.*?)\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]$/.exec(text);
if (endMark && endMark[1] && parse(endMark[2],3) > baseTime) {
    pureText = endMark[1];
}
```

仅当尾标签时间**晚于**行首时间时剥离，避免误伤正常方括号文本。

---

## 七、第二轮修复（提交 `6e52882`）

### 7.1 改动摘要

```
static/index.html |  2 +-  (v0.7.2 → v0.7.3)
static/lyrics.js  | 80 ++++++++++++++++++++++++++++++++---------------
```

### 7.2 最终验证

| 测试项 | 结果 |
|--------|------|
| 格式 A: `[00:37.465]让[00:37.652]我[00:37.877]再[00:38.134]看[00:38.440]你` | ✅ 5 逐字节点，`sung/singing` 进度正确 |
| 格式 B: `我[[00:01.20]]爱[[00:01.50]]你`（上游双括号） | ✅ 3 逐字节点，不变 |
| 普通 LRC 回退 | ✅ 无 ktv 节点，与之前一致 |
| 空歌词 | ✅ 显示"暂无歌词" |
| 行尾时长标记剥离 | ✅ `[00:12]词[00:20]` → 只显示 `词` |
| 锁屏歌词切换 | ✅ 正确更新 |
| `npm run build` | ✅ 9 脚本哈希注入，产物 648.1 KB |
| 远端同步 | ✅ `6e52882` → `origin/dev` |

---

## 八、技术要点总结

1. **上游移植采用"逐文件替换"而非"cherry-pick"**，因历史无交集
2. **KTV 格式识别需要兼容两种主流格式**：`[[mm:ss.xx]]`（双括号）和 `word[mm:ss.xxx]`（单括号逐字）
3. **JavaScript 正则字符类中的 `\]` 不会转义为 `]`**，而是 `\` 字面量 + `]` 关闭类，需用 `\S` 或 `[^\[\x5d]` 替代
4. **`g` 标志正则的 `exec` 返回 null 后会重置 `lastIndex`**，需提前保存
5. **`duration = 0` 会导致进度计算除零**，需加 `Math.max(0.01, ...)` 保护
6. **行尾 `[mm:ss]` 可能为结束标记而非逐字节点**，需判断时间 > 行首时剥离
7. **构建工具 `inject-version-hashes` 自动处理缓存失效**，无需手动维护版本号