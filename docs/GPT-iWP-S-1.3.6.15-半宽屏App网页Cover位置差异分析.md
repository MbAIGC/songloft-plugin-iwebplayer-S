# GPT-iWP-S 1.3.6.15 半宽屏 App 与网页 Cover 位置差异分析

## 分析范围

本记录基于当前最新本地源码、最近的 Git 提交以及两张对比截图整理：

- App 截图：`IMG_20260921_231340.png`
- 网页截图：`Screenshot_2026-09-21-22-51-54-96_99633d3ae0243d4f9d1f40a21c55fba0.png`

当前相关源码主要在：

- `static/index.html`
- `docs/iWP-S-1.3.6-Dev-记录.md`

当前版本提交链已进入 `1.3.6.15-dev`，最近相关修复为：

```text
30faf82 fix(ui): immersive cover nudge applies to both split bands (was 768-959 only) + pure-frontend app signals
6b2614c docs: record 1.3.6.15 (band mismatch root cause)
```

本记录只分析问题，不修改源码。

---

## 一、结论先行

两端半宽屏页面中 Cover 位置不同，首要原因已经可以从当前源码直接确认：

> App 被加上了 `html.iwp-app` 类，因此额外应用了针对 App 的 Cover/歌曲信息下移规则；网页端没有这个类，所以不会应用该位移。

当前规则是：

```css
html.iwp-app body.split-view-active.player-open .desktop-player-main {
  transform: translateY(calc(var(--vh100) * 0.08));
}
```

`.desktop-player-main` 包含：

- Cover；
- 歌曲标题；
- 歌手；
- 专辑信息。

因此实际行为是：

```text
网页半宽沉浸播放页：原始 Cover 位置
App 半宽沉浸播放页：原始位置 + 8% 动态视口高度的向下位移
```

这不是浏览器随机渲染差异，而是当前代码明确设计出来的 App/网页差异。

---

## 二、直接相关的源码规则

### 1. App 专属位移规则

当前源码约 2074 行有：

```css
html.iwp-app body.split-view-active.player-open .desktop-player-main {
  transform: translateY(calc(var(--vh100) * 0.08));
}
```

该规则的选择器包含三个条件：

```text
html.iwp-app
body.split-view-active
body.player-open
```

只有同时满足这三个条件才会生效。

网页端通常满足：

```text
body.split-view-active = true
body.player-open = true
html.iwp-app = false
```

因此网页端不移动。

App 满足：

```text
html.iwp-app = true
body.split-view-active = true
body.player-open = true
```

因此 App 中 `.desktop-player-main` 会整体下移。

### 2. `.desktop-player-main` 的 HTML 结构

当前结构为：

```html
<div class="desktop-player-main">
  <div class="desktop-track-meta" aria-live="polite">
    <div class="desktop-track-title" id="desktop-track-title">暂无播放</div>
    <div class="desktop-track-artist" id="desktop-track-artist"></div>
    <div class="desktop-track-album" id="desktop-track-album"></div>
  </div>
  <div class="fp-cover-wrapper">
    <img id="fp-cover" class="fp-cover" ...>
  </div>
</div>
```

因此这条 `transform` 不只移动 Cover，也会移动 Cover 上方的歌曲信息。

### 3. 位移只改变视觉位置

代码使用：

```css
transform: translateY(...)
```

这不会改变正常布局流，只会改变元素的视觉位置。因此：

- `.desktop-player-main` 原有布局空间不变；
- Cover 视觉上向下；
- 歌词列不跟随移动；
- 底部播放栏不跟随移动；
- 左栏内部的剩余空间计算不因 transform 改变；
- 较矮设备上可能出现裁剪或与其它区域关系失衡。

源码注释也明确说明了这一点：

```text
仍用 transform 视觉位移：只影响本列，歌词列完全不动、不改变任何布局尺寸。
```

---

## 三、为什么最新版本增加了这条 App 位移

最近提交 `30faf82` 修复了一个断点覆盖问题。

此前位移规则只写在：

```css
@media (min-width: 768px) and (max-width: 959px)
```

但实际 App 设备截图尺寸为：

```text
2366 × 2400 物理像素
```

如果设备 DPR 约为 2，则 CSS 宽度约为：

```text
2366 / 2 ≈ 1183 CSS px
```

这属于：

```css
@media (min-width: 960px)
```

而不是 `768–959px`。

所以此前 1.3.6.10~1.3.6.14 的规则在这台设备上根本没有匹配，导致“改了但没有变化”。

`30faf82` 将规则移出 768–959 的媒体查询，使两个分栏断点都能应用：

```css
html.iwp-app body.split-view-active.player-open .desktop-player-main {
  transform: translateY(calc(var(--vh100) * 0.08));
}
```

这解决了 App 上“位移规则不生效”的问题，但同时明确造成了 App 与网页 Cover 位置不同。

---

## 四、两张截图的尺寸说明了什么

实际文件尺寸为：

```text
App：2366 × 2400
网页：2358 × 2400
```

两张截图高度相同，宽度只差 8 个物理像素。

如果 DPR 约为 2，则两者 CSS 宽度大约为：

```text
App：约 1183 CSS px
网页：约 1179 CSS px
```

两者都属于：

```css
@media (min-width: 960px)
```

因此，本次差异不是因为：

```text
一个处于 768–959px，另一个处于 >=960px
```

更可能的区别是：

```text
App：html.iwp-app = true
网页：html.iwp-app = false
```

这与当前选择器完全吻合。

---

## 五、8% 位移的实际单位风险

规则使用：

```css
calc(var(--vh100) * 0.08)
```

当前动态视口变量为：

```css
@supports (height: 100dvh) {
  :root {
    --vh100: 100dvh;
  }
}
```

需要注意：`dvh` 使用的是 CSS 像素，不是截图文件的物理像素。

例如：

```text
截图高度：2400 物理像素
DPR：约 2
CSS 视口高度：约 1200 CSS px
```

那么实际位移大约是：

```text
1200 × 8% = 96 CSS px
96 CSS px × 2 ≈ 192 物理像素
```

这会产生非常明显的视觉下移。

历史记录中曾使用“2400 × 8% = 192px”的计算方式，但其中把物理截图像素与 CSS `dvh` 单位混在了一起。最终在设备上的实际 CSS 位移应以浏览器运行时的 `100dvh` 值为准，而不能直接用截图物理高度计算。

---

## 六、半宽屏媒体规则本身的作用

当前 `768–959px` 规则包含：

```css
body.split-view-active.player-open .full-player {
  top: 0 !important;
  bottom: auto !important;
  height: calc(var(--vh100) - var(--player-height, 118px)) !important;
}
```

以及：

```css
body.split-view-active.player-open .desktop-player-main {
  align-self: stretch !important;
  justify-content: center !important;
  padding-top: calc(var(--vh100) * 0.05) !important;
}
```

这些规则负责：

- 给左侧沉浸播放器确定高度；
- 让左侧主列有可分配的剩余高度；
- 使 Cover 和歌曲信息在左栏中垂直居中；
- 使用 5% 视口高度作为额外顶部 padding。

不过两张截图推算的 CSS 宽度都大于 960px，通常不会使用 768–959 独有的这部分规则。

两端共同使用的是 >=768 的规则：

```css
body.split-view-active.player-open .desktop-player-main {
  flex: 0 1 32%;
  width: 32%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: clamp(8px, 2vh, 24px);
  overflow: hidden;
}
```

以及：

```css
body.split-view-active.player-open .fp-cover {
  width: min(100%, 34vw, 440px);
  height: auto;
  max-width: 100%;
  max-height: min(calc(var(--vh100) * 0.48), 440px);
}
```

这些规则会对 App 和网页都生效，不能解释当前明显的两端位置差异。首要差异仍然是 App 专属的 `translateY(8%)`。

---

## 七、其它可能叠加的差异来源

虽然首要原因已经明确，但以下因素可能带来少量额外偏差。

### 1. App 与浏览器的动态视口高度不同

App 是全屏 WebView，网页端可能存在：

- 地址栏；
- 浏览器工具栏；
- 地址栏动态收起或展开；
- 不同的可视视口高度。

这些差异会影响：

```css
height: calc(var(--vh100) - ...)
max-height: min(calc(var(--vh100) * 0.48), 440px)
padding-top: calc(var(--vh100) * 0.05)
transform: translateY(calc(var(--vh100) * 0.08))
```

因此即使去除 App 专属位移，App 与网页仍可能保留小幅的高度差异，但不会再出现当前这类由显式 8% 位移造成的明显差距。

### 2. `safe-area-inset-top` 可能不同

当前顶部规则使用：

```css
.header {
  padding-top: env(safe-area-inset-top) !important;
  height: calc(56px + env(safe-area-inset-top)) !important;
}
```

播放器使用：

```css
body.ambient-active.player-open .full-player {
  padding-top: calc(56px + env(safe-area-inset-top)) !important;
}
```

如果 App WebView 报告了刘海或状态栏安全区，而网页端返回 0，那么两端会产生额外顶部偏移。

不过这通常是几十个 CSS px 或更小，当前明显的 Cover 下移仍应首先归因于 App 专属 `translateY(8%)`。

### 3. App 识别可能误判

当前 App 识别函数为：

```js
window.__iwpIsApp = function () {
  try {
    if (window.Android) return true;
    var ua = navigator.userAgent || '';
    if (/;\s*wv\)/.test(ua) || /iWebPlayer-S-APK/i.test(ua)) return true;
    if (window.screen && screen.height && window.innerHeight >= screen.height * 0.94) return true;
  } catch (e) {}
  return false;
};
```

其中最后一个判据：

```js
window.innerHeight >= screen.height * 0.94
```

可能把某些“浏览器全屏/PWA/隐藏地址栏”的网页环境误判为 App。

如果网页端也出现了 `html.iwp-app`，它也会应用 8% 位移，导致网页表现与预期不符。

当前两张图的现象更像 App 被正确识别、网页未被识别，但调试时应直接记录：

```js
document.documentElement.className
window.innerWidth
window.innerHeight
screen.width
screen.height
window.devicePixelRatio
getComputedStyle(document.querySelector('.desktop-player-main')).transform
```

其中最关键的是：

```js
document.documentElement.classList.contains('iwp-app')
```

和：

```js
getComputedStyle(document.querySelector('.desktop-player-main')).transform
```

---

## 八、当前逻辑的潜在问题

### 1. App 与网页使用两套视觉基准

当前目标是让 App 位置匹配网页，但实现方式是：

```text
网页：保持原位置
App：根据一次截图估算后额外下移 8% dvh
```

这种方式属于设备/容器特化补偿，不是通用布局规则。

只要以下条件变化，8% 就可能不再合适：

- 设备型号；
- 屏幕比例；
- DPR；
- WebView 是否全屏；
- 状态栏高度；
- 浏览器地址栏状态；
- `dvh` 实际值；
- Cover 尺寸上限是否达到 `440px`。

### 2. `transform` 不参与布局

因为位移不改变布局尺寸，所以：

- Cover 向下后可能接近底部播放栏；
- Cover 可能被 `.desktop-player-main { overflow: hidden; }` 裁剪；
- Cover 与歌词列不再保持视觉中心一致；
- 页面高度变小时，原来的 8% 补偿可能过大。

### 3. 位移规则当前无设备上限和下限

当前值是连续比例：

```css
calc(var(--vh100) * 0.08)
```

没有：

- `clamp()` 限制最小/最大偏移；
- 针对设备高度的分段策略；
- 对 Cover 实际位置的运行时测量。

因此高屏设备可能下移过多，矮屏设备也可能下移过多。

### 4. 注释中的尺寸模型与 CSS 单位不完全一致

历史说明用的是物理截图高度 `2400px`，但 CSS 使用的是 `100dvh` CSS 像素。两者需要通过 DPR 换算，不能直接相乘比较。

这会让后续维护者误以为 8% 的视觉位移就是 192 CSS px，而实际可能只有约 96 CSS px。

---

## 九、调试时最应该记录的运行时数据

要区分“App 专属位移”和“视口/安全区差异”，应在 App 与网页各记录一次：

```js
const main = document.querySelector('.desktop-player-main');
const cover = document.querySelector('#fp-cover');
const fullPlayer = document.querySelector('#full-player');

console.table({
  htmlClass: document.documentElement.className,
  bodyClass: document.body.className,
  isApp: document.documentElement.classList.contains('iwp-app'),
  innerWidth: window.innerWidth,
  innerHeight: window.innerHeight,
  clientWidth: document.documentElement.clientWidth,
  clientHeight: document.documentElement.clientHeight,
  screenWidth: window.screen?.width,
  screenHeight: window.screen?.height,
  dpr: window.devicePixelRatio,
  visualViewportWidth: window.visualViewport?.width,
  visualViewportHeight: window.visualViewport?.height,
  safeTop: getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)'),
  mainTransform: main ? getComputedStyle(main).transform : 'missing',
  mainRectTop: main?.getBoundingClientRect().top,
  coverRectTop: cover?.getBoundingClientRect().top,
  coverRectHeight: cover?.getBoundingClientRect().height,
  fullPlayerRectTop: fullPlayer?.getBoundingClientRect().top,
  fullPlayerRectHeight: fullPlayer?.getBoundingClientRect().height
});
```

其中最重要的结果是：

```text
isApp
mainTransform
mainRectTop
coverRectTop
innerHeight
visualViewportHeight
```

如果 App 显示：

```text
isApp = true
mainTransform = matrix(..., ..., ..., ..., 0, 约 96)
```

而网页显示：

```text
isApp = false
mainTransform = none
```

即可完全确认当前差异来自 App 专属位移。

---

## 十、最终判断

当前 Cover 位置不同的原因按优先级排序如下：

1. **确定原因：App 专属规则将 `.desktop-player-main` 向下移动了 `8%` 的动态视口高度。**
2. App 与网页的 `100dvh` 实际 CSS 高度可能不同。
3. App 与网页的 `safe-area-inset-top` 可能不同。
4. 两张截图推算出的 CSS 宽度都大于 960px，不是 768–959 与 >=960 的断点差异。
5. `34vw` 对 Cover 尺寸造成的差异很小，不是主要原因。
6. 当前 `transform` 只移动视觉位置，不改变布局流，存在小视口下遮挡、裁剪或与歌词/底栏关系失衡的潜在风险。

当前代码的实际布局模型是：

```text
网页半宽沉浸页：原始 Cover 位置
App 半宽沉浸页：原始位置 + 8% dvh 的向下补偿
```

如果目标是让 App 与网页的 Cover 位置完全一致，首先需要重新评估：

```css
html.iwp-app body.split-view-active.player-open .desktop-player-main {
  transform: translateY(calc(var(--vh100) * 0.08));
}
```

是否仍然应该保留，而不是继续调整 `34vw`、Cover 尺寸或半宽断点规则。
