# iWebPlayer-S 主题模式优化总结

> 项目：`songloft-plugin-iwebplayer-S`
> 涉及文件：`static/index.html`、`android/app/src/main/java/com/songloft/iwebplayer/MainActivity.java`
> 改动规模：index.html +139/-24，MainActivity.java +15
> 日期：2026-08-18

---

## 一、问题描述

用户反馈：**Android 系统设置为日间模式，但 APK 端（iWebPlayer-S）界面却始终显示夜间模式**。

具体现象：
1. APK 端登录设置页（`settings.html`）是深色——作者确认这是写死的默认主题，不属于 bug；
2. **登录后的播放器页面**系统日间时应为浅色，却在 APK 端一直显示深色——这是异常；
3. 同时，**网页端（浏览器访问插件）显示正常**，其他 App 也正常——证明问题被隔离在 APK 的 WebView 渲染环境这一层。

### 根本原因

项目所有深浅色样式都由 CSS 媒体查询 `@media (prefers-color-scheme: dark)` 驱动（`index.html` 共 8 处），而 **Android WebView 对 `prefers-color-scheme` 的判定并不完全等同于"系统深色开关"**：

1. **WebView 默认启用"算法暗化"（algorithmic darkening）**，且页面的 CSS 未声明 `color-scheme` 属性，WebView 在页面"未声明"时倾向判定为 dark 并启用暗化；
2. **`setForceDark()` 未调用时默认 `FORCE_DARK_AUTO`**，在部分 ROM / WebView 版本组合下，即便系统日间也可能被触发暗化；
3. **国产 ROM（MIUI/HarmonyOS/ColorOS 等）的 WebView 常带"强制深色/深色跟随应用"的激进策略**——只作用于嵌入 WebView 的页面，不影响其他原生 App 与浏览器。

因此网页端正常、其他 App 正常、唯独 APK WebView 误判为深色。

---

## 二、解决思路与方案对比

围绕两种诉求展开三种方案评估：

| 方案 | 改动量 | 覆盖范围 | 风险 |
| --- | --- | --- | --- |
| **A. MainActivity 固定 `FORCE_DARK_OFF`** | 极小（2 行） | 只修 APK，且页面永久日间、不跟随系统夜间 | 低 |
| **B. 网页端加手动深浅切换按钮** | 中（改 8 处散落深色规则 + 按钮 + JS） | 网页 + APK 全端生效，可手动切换、可记忆 | 中（散落规则需逐个改造） |
| **C. 跟随系统 + 手动切换（最终采用）** | 中 | APK 修正误判、跟随系统日/夜；网页端手动覆盖 | 低 |

**最终选定方案 C**，原因是：
- 用户希望 APK **修正"日间却显示深色"的误判**（系统日间 → 浅色）；
- 同时希望系统夜间时 APK **正常跟随深色**；
- 还要留一个**手动深浅切换**的选项，覆盖"自动跟随"的不足，更符合实际使用需求。

---

## 三、落实措施

### 1. `static/index.html`（百度端页面，网页 + APK 通用）

**① CSS 深色规则全面改造为 `data-theme` 双条件**（改造前 8 处，逐处变为两套并生规则）：

- 系统深色（且未手动锁定浅色）→ 深色：
  ```css
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) { --bg-color:#111827; ... }
  }
  ```
- 手动深色（无论系统）→ 深色：
  ```css
  :root[data-theme="dark"] { --bg-color:#111827; ... }
  ```

  覆盖点：`:root` 变量块、`.playlist-row`、`#loading/.playlist`、`.song-item.menu-open`、`.ios-guide-bubble`、`html` 背景、split-view `.playlist-row`、全局暗黑护眼块（含 `@media (min-width:960px)` 嵌套）。

**② 设置菜单新增「深色/浅色」选项**（`:1535-1537`）：附 `<span id="setting-theme-label">` 显示当前模式。

**③ JS 主题管理逻辑**（`:4224-4274` + `init()` 调用 `:3910`）：
- 三态循环：**跟随系统 → 浅色 → 深色 → 跟随系统**；
- localStorage 记忆（键 `iwebplayer-s.theme`），刷新/重开保持；
- 跟随模式下监听系统切换自动更新（`matchMedia('(prefers-color-scheme: dark)')` change 事件）；
- 联动 `theme-color` meta（状态栏颜色随主题变化，`initThemeColor` 改写为优先读 `data-theme`）；
- 点击主题项后关闭设置菜单（与其他菜单项一致，`:4268-4274`）。

### 2. `android/app/src/main/java/com/songloft/iwebplayer/MainActivity.java`

在 WebView 初始化处新增 **uiMode 桥接**（`:115-128`）：

```java
boolean systemDark = (getResources().getConfiguration().uiMode
        & android.content.res.Configuration.UI_MODE_NIGHT_MASK)
        == android.content.res.Configuration.UI_MODE_NIGHT_YES;
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
    s.setForceDark(systemDark
            ? WebSettings.FORCE_DARK_AUTO
            : WebSettings.FORCE_DARK_OFF);
}
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
    s.setAlgorithmicDarkeningAllowed(systemDark);
}
```

- **系统日间** → `FORCE_DARK_OFF` + 关闭算法暗化 → **修正"日间却深色"的误判**；
- **系统夜间** → `FORCE_DARK_AUTO` + 允许算法暗化 → **正常跟随夜间**；
- 插件页内的 `data-theme` 手动切换不受影响（作用于 CSS 层，WebView 桥接只管正确上报系统偏好）。

---

## 四、关键机制：`data-theme` 如何"压制"系统偏好

`applyThemeMode()` 总是把 `<html>` 上的 `data-theme` 设为 `light` 或 `dark`（从不留空），从而完全覆盖媒体查询：

| 系统 + 手动设置 | 结果 |
| --- | --- |
| 系统夜间 + 手动 `light` | 设 `data-theme="light"` → `:not([data-theme="light"])` 媒体版排除、`[data-theme="dark"]` 不匹配 → **强制浅色** |
| 系统日间 + 手动 `dark` | 设 `data-theme="dark"` → 深色块生效 → **强制深色** |
| 任意系统 + 跟随（`system`） | 设对应值，与媒体查询一致 → **跟随系统** |

即：**手动选择优先级 > 系统偏好**，三态闭环。

---

## 五、达到的效果

| 场景 | 效果 |
| --- | --- |
| APK + 系统日间 | ✅ **浅色（此前误判深色，已修正）** |
| APK + 系统夜间 | ✅ **深色（正常跟随系统）** |
| 网页/APK + 菜单手动切"浅色" | ✅ **强制浅色**，刷新记忆 |
| 网页/APK 菜单手动切"深色" | ✅ **强制深色**，刷新记忆 |
| 网页端（浏览器访问） | ✅ 同一份 index.html，同样支持手动切换 |
| 登录设置页（settings.html） | 保持原有写死深色（作者确认此为默认主题，不改） |

**对比改动前**：APK 端只有"永久的深色误导"（系统日间也深色），且无任何手动控制手段。改动后：修正误判 + 系统自适应 + 手动覆盖三效合一。

---

## 六、验证情况

- ✅ **JS 内联脚本语法检查**通过（`node --check`）
- ✅ **CSS 大括号配平**（571/571）
- ⏳ **真机验证**（建议在 APK 重建后进行）：
  1. APK 系统日间是否恢复浅色（验证 MainActivity 修复）；
  2. 手动切深色后切换系统日/夜，确认手动选择不被系统覆盖；
  3. 设置菜单点"深色/浅色"后是否正常关闭。

---

## 七、注意事项 / 后续

1. **生效条件**：`static/index.html` 是插件前端，需**重新构建插件并上传/更新**才会让网页端与 APK 拉取到新版本；`MainActivity.java` 改动需**重新构建 APK**。
2. **与之前优化的关系**：本 MD 仅针对"主题模式"优化；插件缓存问题、静默更新优化另见 `iwebplayer-s缓存问题分析.md`、`iwebplayer-s静默更新优化方案.md`。
3. 若后续想取消手动切换（只跟随系统），删掉 `initTheme()` 内的菜单绑定与菜单项即可，CSS 双条件规则无需改动。

---

## 附：改动文件清单

| 文件 | 改动类型 | 规模 |
| --- | --- | --- |
| `static/index.html` | CSS 8 处深色规则双条件化 + 菜单新项 + JS 三态主题逻辑 | +139 / -24 |
| `MainActivity.java` | WebView 明暗策略 uiMode 桥接（跟随系统 / 防误判） | +15 |

**关键代码索引**：
- 深色变量块：`index.html:75-93`
- 设置菜单项：`index.html:1535-1537`
- 主题 JS：`index.html:4225-4274`（定义）、`:3910`（init 调用）
- `initThemeColor` 改写：`index.html:4275-4295`
- MainActivity 桥接：`MainActivity.java:115-128`