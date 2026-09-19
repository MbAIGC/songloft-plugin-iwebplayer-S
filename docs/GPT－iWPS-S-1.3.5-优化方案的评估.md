# GPT－iWPS-S-1.3.5 优化方案的评估

> 本评估基于当前最新源码重新检查后整理。
>
> 当前 HEAD：`61767d6`
>
> 当前工作区在评估时为干净状态。本文件只记录分析结论，不包含代码修改方案的实施结果。

## 总结结论

这份优化清单中：

- **P0 第 1 条：建议做，但需要扩大“状态一致”的判断范围**
- **P0 第 2 条：建议做**
- **P0 第 3 条：建议做**
- **P1 第 4 条：建议做，收益明确**
- **P1 第 5 条：可以做，但收益低于预期**
- **P1 第 6 条：部分已经完成，剩余收益有限**
- **P2 第 7 条：当前最值得实测，可能是流畅性优化中收益最大的**
- **P2 第 8 条：不建议为了性能重构**
- **P2 第 9 条：可以做，但属于维护性重构，不是性能优化**

---

## P0 逐项核对

### 1. `syncLayout` 早退：建议做，但不能只比较 class

当前 `syncLayout()` 每次都会完整执行：

```js
function syncLayout(reason) {
    if (_syncingLayout) return;
    _syncingLayout = true;
    try {
        const mode = currentLayoutMode();
        const wantSplit = mode !== 'narrow';

        if (document.body.classList.contains('split-view-active') !== wantSplit) {
            document.body.classList.toggle('split-view-active', wantSplit);
            ...
        }

        document.body.dataset.layout = mode;

        const bar = document.getElementById('toolbar-split');
        if (bar) bar.classList.remove('search-expand');

        if (_moveToolbarControls) _moveToolbarControls(wantSplit);
        layoutSelfCheck(mode);
    }
}
```

当前确实没有“状态未变化直接返回”。

而且它被多个事件调用：

- `resize`
- `orientationchange`
- `matchMedia.change`
- `visualViewport.resize`
- `ResizeObserver`

所以早退是有效优化。

不过不能只判断：

```js
当前 class 是否等于 wantSplit
```

因为当前布局是否正确还包括：

- `toolbar-split` 是否在 `.header` 内；
- `playlist-container` 是否在正确区域；
- `search-inline-wrap` 是否在正确区域；
- `device-container` 是否在正确区域；
- 是否需要清理 `search-expand`；
- 是否需要执行 `layoutSelfCheck()`。

当前 `layoutSelfCheck()` 明确会检查：

```js
if (el && (!header || el.parentNode !== header)) {
    problems.push('工具栏不在 header 内');
}
```

因此早退条件应该是：

> 布局模式未变化，并且工具栏及关键控件父节点都正确时才早退。

否则会削弱当前源码的自愈能力。

#### 结论

**建议做，低风险，但应使用布局签名或关键 DOM 归属检查，而不是只缓存 `mode`。**

### 2. `dataset.layout` 只在模式变化时写：建议做

当前每次 `syncLayout()` 都会执行：

```js
document.body.dataset.layout = mode;
```

即使 `mode` 没变化，也会重复写属性。

目前 `dataset.layout` 主要用于诊断，没有看到它参与 CSS 或逻辑判断。因此有两个可选方案：

#### 方案 A：仅变化时写

保留诊断能力，但减少属性写入。

#### 方案 B：直接移除

如果当前已经不需要观察布局状态，直接删除更干净。

不过需要注意：当前 `bodyClassObserver` 监听的是 body 的所有属性：

```js
bodyClassObserver.observe(document.body, { attributes: true });
```

因此 `data-layout` 的写入会触发这个 Observer。虽然回调内部只处理：

```js
if (mutation.attributeName === 'class')
```

不会执行主题逻辑，但仍会产生无意义的 MutationRecord 和回调开销。

#### 结论

**建议做。保留诊断信息的话，只在值发生变化时写；否则可以删除。**

### 3. `MutationObserver` 增加 `attributeFilter: ['class']`：明确建议做

当前代码：

```js
bodyClassObserver.observe(document.body, { attributes: true });
```

但回调实际只处理：

```js
if (mutation.attributeName === 'class') {
    ...
}
```

这是当前源码中最明确的低风险优化点。

建议改成只监听 class：

```js
bodyClassObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
});
```

这样可以过滤掉：

- `data-layout`
- `style`
- 其他未来新增的 body 属性

#### 结论

**建议做，收益明确，几乎没有行为风险。**

---

## P1 逐项核对

### 4. ResizeObserver 用 rAF 合并：建议做

当前代码：

```js
new ResizeObserver(() => syncLayout('ro'))
    .observe(document.documentElement);
```

同时，`syncLayout()` 会修改：

- body class；
- body style；
- dataset；
- 多个控件的 DOM 父节点；
- 控件 class。

这些操作可能再次影响布局，从而引发 ResizeObserver 回调。

当前有：

```js
let _syncingLayout = false;
```

可以防止同步重入，但不能防止同一帧多次异步回调。

因此当前可能出现：

```text
ResizeObserver
  → syncLayout
  → DOM / 样式变化
  → ResizeObserver
  → syncLayout
```

使用 rAF 合并是合适的：

- 同一帧只执行一次；
- 减少 ResizeObserver 高频触发；
- 保留现有状态判据；
- 不改变布局判据。

#### 结论

**建议做，属于低风险性能优化。**

### 5. `moveToolbarControls` 记忆化：可以做，但收益没有清单描述得那么大

当前 `moveToolbarControls()` 每次都会先执行多次查询：

```js
getElementById(...)
querySelector(...)
```

然后执行若干 `parentNode` 检查。

但是实际 DOM 搬运已经有保护：

```js
if (pc && pc.parentNode !== tbsPlaylist) ...
if (mz && mz.parentNode !== tbsPlaylist) ...
if (sw && sw.parentNode !== inner) ...
if (dc && deviceInner && dc.parentNode !== deviceInner) ...
```

所以它虽然每次都会查询，但真正的 DOM 搬运并不是每次发生。

需要注意一个更重要的问题：

当前 `moveToolbarControls()` 不只是做 DOM 搬运，还会执行：

```js
if (si) si.placeholder = ...
applyWideSearchMode()
```

因此即使 `isSplit` 没变化，也可能存在模式同步需求。

如果简单写成：

```js
if (lastIsSplit === isSplit) return;
```

可能导致：

- 搜索模式没有同步；
- placeholder 没更新；
- 其他控件被外部代码移动后无法恢复；
- 初始化期间 DOM 还没准备好时无法自愈。

#### 结论

**可以做，但应缓存完整布局签名或仅减少重复查询，不建议只按 `isSplit` 早退。收益中等。**

### 6. 滚动监听：当前已经是 passive，但还没有 rAF

当前 `online.js`：

```js
window.addEventListener('scroll', () => {
    if (window.currentPlaylist !== '在线资源') return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const clientHeight = window.innerHeight || document.documentElement.clientHeight;
    const scrollHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
    );
    ...
}, { passive: true });
```

所以清单中的：

> 滚动监听加 `{ passive: true }`

当前已经完成。

但 `scrollHeight` 仍然是在每个 scroll 事件中同步读取。移动端滚动过程中，这会增加主线程布局读取压力。

不过要区分影响范围：

- 这段监听只在 `currentPlaylist === '在线资源'` 时继续执行；
- 它主要负责在线搜索结果的分页加载；
- 它不直接参与全屏播放器的歌词动画；
- 也不直接触发 `syncLayout()`。

因此它值得优化，但不是当前播放器卡顿的第一嫌疑。

#### 结论

**passive 已完成；将读取和分页判断合并到 rAF 可以做，但优先级低于氛围态卡片的 backdrop-filter。**

---

## P2 逐项核对

### 7. 去掉氛围态卡片 `backdrop-filter`：当前确实是最值得实测的性能项

当前最新源码在 768–959 和 ≥960 两个断点中，都有类似规则：

```css
body.ambient-active.split-view-active .song-item,
body.ambient-active.split-view-active .pl-card-b,
body.ambient-active.split-view-active .toolbar-split-inner,
body.ambient-active.split-view-active .search-input-box,
body.ambient-active.split-view-active #device-val {
    backdrop-filter: blur(25px) !important;
    -webkit-backdrop-filter: blur(25px) !important;
}
```

同时还有：

```css
body.ambient-active.player-open .full-player,
body.ambient-active.player-open .player-bar {
    backdrop-filter: blur(20px) !important;
}
```

以及：

```css
.player-bar::before {
    backdrop-filter: blur(7px);
}
```

这意味着氛围态可能同时存在多层实时模糊：

1. `#fp-ambient-bg` 本身的背景模糊；
2. 播放器底部卡片模糊；
3. 歌曲卡片模糊；
4. 工具栏卡片模糊；
5. 设备选择器模糊；
6. 某些按钮和弹窗模糊。

特别是右侧列表滚动时，多个 `.song-item` / `.pl-card-b` 都参与合成，Android WebView 上确实可能明显掉帧。

当前源码注释还明确写着：

```css
/* 卡片背景已经被氛围背景模糊过 */
```

因此建议优先做 A/B 测试：

```css
backdrop-filter: none;
-webkit-backdrop-filter: none;
```

保留半透明背景、边框和阴影。

#### 风险

这条不是完全“零行为变化”，因为视觉上可能改变：

- 卡片透出背景的柔和程度；
- 动态氛围颜色穿透效果；
- 卡片边缘层次。

但它是最可能对“流畅性”有实际收益的优化。

#### 结论

**值得单独实测，当前性能优化中优先级最高。不要和其他结构重构一起做。**

### 8. 用 CSS 变量替代 `ambient-active`：不建议为了性能改

当前 `ambient-active` 确实被大量选择器使用，但这本身不等于性能问题。

例如：

```css
body.ambient-active.split-view-active .song-item
body.ambient-active.split-view-active .pl-card-b
body.ambient-active.split-view-active .toolbar-split-inner
```

CSS 引擎不会因为有 20 多条规则，就在每一帧对全部规则做昂贵重算。真正可能造成高成本的是：

- 大面积元素重绘；
- 多层 `backdrop-filter`；
- 滚动时的合成；
- 频繁读取布局；
- 动画与滤镜叠加。

把 body class 改成 CSS 变量可能降低不了实际成本，反而会：

- 降低状态可读性；
- 使现有 selector 更复杂；
- 增加主题和断点覆盖风险；
- 破坏已有的状态自检逻辑。

#### 结论

**当前不建议改。除非 Performance 面板明确证明 style recalculation 是主要瓶颈。**

### 9. 合并两段氛围保护壳：属于维护优化，不是性能优化

最新源码确实存在两段重复：

- `@media (min-width: 768px) and (max-width: 959px)`
- `@media (min-width: 960px)`

两边都有重复的：

- `.song-item`
- `.pl-card-b`
- `.toolbar-split-inner`
- `.search-input-box`
- `#device-val`
- dark theme overrides
- z-index 和滚动规则

但这两段现在存在的意义，是为了覆盖不同断点下的布局差异。最近提交也反复修复过：

- 768–959 列表被遮挡；
- 缺少内部滚动；
- `#loading` 层级错误；
- 氛围保护壳缺失；
- 960 以上和 768–959 行为不一致。

所以直接合并有回归风险。

#### 结论

**可以以后做，但不应把它当作性能优化。建议先保持现状，除非准备配套完整的 768/959/960 断点回归测试。**

---

## 当前源码里另外值得关注的两个点

### 1. `layoutSelfCheck()` 自身会制造诊断 DOM

当状态不一致时，它会创建：

```js
_layoutWarnBadge = document.createElement('div');
```

这在异常状态下是合理的，但如果当前问题还没有彻底消失，诊断 Badge 可能会留在页面上，并且每次 `syncLayout()` 都会执行检查。

它不是常态性能问题，但建议确认生产环境是否还需要这个可见诊断 Badge。

### 2. `syncLayout()` 的事件源仍然很多

当前有：

```js
resize
orientationchange
matchMedia.change
visualViewport.resize
ResizeObserver
```

虽然它们统一进入 `syncLayout()`，这比旧版本已经好很多，但当前 `syncLayout()` 没有：

- rAF 合并；
- 模式未变化早退；
- dataset 写入保护；
- `moveToolbarControls` 布局签名缓存。

所以当前最实际的低风险优化顺序是：

1. `MutationObserver` 添加 `attributeFilter`
2. `dataset.layout` 仅变化时写
3. ResizeObserver 回调 rAF 合并
4. `syncLayout` 增加完整状态早退
5. 再考虑 `moveToolbarControls` 查询优化
6. 单独 A/B 测试移除氛围卡片 `backdrop-filter`

---

## 最终判断

| 项目 | 建议 |
|---|---|
| `syncLayout` 早退 | 建议，需检查 DOM 归属 |
| `dataset.layout` 条件写入 | 建议 |
| MutationObserver `attributeFilter` | 强烈建议 |
| ResizeObserver + rAF | 建议 |
| `moveToolbarControls` 记忆化 | 可做，中等收益 |
| scroll passive | 已完成 |
| scroll 读取放 rAF | 可做，优先级较低 |
| 去掉氛围卡片 backdrop-filter | 最值得实测 |
| ambient class 改 CSS 变量 | 暂不建议 |
| 合并两段氛围规则 | 可做，但仅是维护重构 |

整体来看，最新代码已经解决了之前的主要“布局状态竞态”问题。现在剩余的优化重点已经从“修复缩放/布局正确性”转向：

> 降低多事件源重复布局同步，以及减少氛围态多层 backdrop-filter 带来的合成开销。
