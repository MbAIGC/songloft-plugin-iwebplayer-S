#!/usr/bin/env node
/**
 * iWP-S 断点覆盖审计（防「某个宽度带才出错」类回归）
 * ---------------------------------------------------------------------------
 * 背景：本项目宽屏分栏有两条断点带 —— `768–959px` 与 `≥960px`。
 *       历史上多次出现「某条规则只写在 ≥960 段里」，于是在 768–959 段出现：
 *         · 右栏歌单被氛围遮罩(z-index:135)盖住 → 歌单不见了       (1.3.5.32)
 *         · 列表没有内部滚动、缺 --split-list-top                  (1.3.5.33)
 *         · 歌曲卡片/工具栏缺氛围态「实体化保护壳」→ 透在幕布上     (1.3.5.33)
 *         · header / 底栏 z-index 低于左栏 → logo 被盖、进度条被压 (1.3.5.35)
 *       本脚本把「关注点 × 断点带」和「同一元素两段的 z-index」机械比一遍。
 *
 * 用法：
 *   node scripts/audit-breakpoints.mjs                     # 审计 static/index.html
 *   node scripts/audit-breakpoints.mjs <file>              # 审计指定文件（可用 git show 出来的旧版）
 *   node scripts/audit-breakpoints.mjs --strict            # 有发现时退出码 1（可做提交前门禁）
 * ---------------------------------------------------------------------------
 */
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const strict = argv.includes('--strict');
const file = argv.find((a) => !a.startsWith('--')) || 'static/index.html';

let html;
try {
  html = readFileSync(file, 'utf8');
} catch (e) {
  console.error(`无法读取 ${file}：${e.message}`);
  process.exit(2);
}

/* ---------- 1) 取出 <style> 内容（注释置空但保留行号） ---------- */
const rawLines = html.split(/\r?\n/);
const inCss = new Array(rawLines.length).fill(false);
let inside = false;
for (let i = 0; i < rawLines.length; i++) {
  if (/<style[^>]*>/i.test(rawLines[i]) && !inside) { inside = true; inCss[i] = true; continue; }
  if (/<\/style>/i.test(rawLines[i]) && inside) { inside = false; inCss[i] = false; continue; }
  inCss[i] = inside;
}
let inComment = false;
const cssLines = rawLines.map((l, i) => {
  if (!inCss[i]) return '';
  let out = '';
  for (let k = 0; k < l.length; k++) {
    const two = l.slice(k, k + 2);
    if (inComment) { if (two === '*/') { inComment = false; k++; } continue; }
    if (two === '/*') { inComment = true; k++; continue; }
    out += l[k];
  }
  return out;
});

/* ---------- 2) 迷你 CSS 解析：得到 {selector, media, prop, value, line} ---------- */
const decls = [];
const stack = [];
let buf = '', bufLine = 1, line = 1;
const mediaChain = () => stack.filter((f) => f.type === 'media').map((f) => f.q);
const flushDecl = () => {
  const d = buf.trim();
  buf = '';
  const top = stack[stack.length - 1];
  if (!top || top.type !== 'rule' || !d) return;
  const m = d.match(/^([-\w]+)\s*:\s*([\s\S]+)$/);
  if (m) decls.push({
    selector: top.selector,
    media: mediaChain().join(' + ') || '全局',
    prop: m[1].toLowerCase(),
    value: m[2].trim(),
    line: bufLine,
  });
};
const text = cssLines.join('\n');
for (let i = 0; i < text.length; i++) {
  const ch = text[i];
  if (ch === '\n') { line++; continue; }
  if (ch === '{') {
    const p = buf.trim(); buf = '';
    if (/^@media/i.test(p)) stack.push({ type: 'media', q: p.replace(/^@media\s*/i, '').trim() });
    else if (p.startsWith('@')) stack.push({ type: 'at', q: p });
    else stack.push({ type: 'rule', selector: p.replace(/\s+/g, ' '), line: bufLine });
    continue;
  }
  if (ch === '}') { flushDecl(); stack.pop(); continue; }
  if (ch === ';') { flushDecl(); continue; }
  if (!buf && /\s/.test(ch)) continue;
  if (!buf) bufLine = line;
  buf += ch;
}

/* 伪元素（::before / ::after）的 z-index、背景色不属于元素本身 → 过滤掉，避免误报 */
for (let i = decls.length - 1; i >= 0; i--) if (/::/.test(decls[i].selector)) decls.splice(i, 1);

/* ---------- 3) 断点带归类 ---------- */
const bandOf = (media) => {
  if (!media || media === '全局') return '全局';
  const m = media;
  if (/max-width:\s*959px/.test(m)) return '768-959';
  if (/min-width:\s*960px/.test(m)) return '≥960';
  if (/max-width:\s*1099px/.test(m)) return '≤1099';
  if (/min-width:\s*768px/.test(m)) return '≥768';
  if (/min-width:\s*600px/.test(m)) return '≥600';
  if (/max-height/.test(m)) return '按高度';
  if (/prefers-color-scheme/.test(m)) return '暗色(prefers)';
  return m;
};
const SPLIT_BANDS = ['768-959', '≥960'];

/* ---------- 4) 关注点清单（跨分栏带必须成对出现） ---------- */
const CONCERNS = [
  ['右栏列宽 50%/margin-left', (d) => /split-view-active[^{]*\.playlist/.test(d.selector)
      && ((d.prop === 'width' && /^50%/.test(d.value)) || (d.prop === 'margin-left' && /^50%/.test(d.value)))],
  ['右栏 z-index 抬升(遮罩之上)', (d) => d.prop === 'z-index' && /^140/.test(d.value)],
  ['列表内部滚动(max-height)', (d) => d.prop === 'max-height' && /var\(--split-list-top/.test(d.value)],
  ['--split-list-top 定义', (d) => d.prop === '--split-list-top'],
  ['--player-height 定义', (d) => d.prop === '--player-height'],
  ['左栏 .full-player 列宽/高度', (d) => /split-view-active[^{]*\.full-player/.test(d.selector) && /width|height|top/.test(d.prop)],
  ['底栏 .player-bar 列宽', (d) => /split-view-active[^{]*\.player-bar/.test(d.selector)
      && ((d.prop === 'width' && /^50%/.test(d.value)) || (d.prop === 'left' && /^0/.test(d.value)))],
  ['底栏 .player-bar 层级', (d) => /split-view-active[^{]*\.player-bar/.test(d.selector) && d.prop === 'z-index'],
  ['header 层级(z-index:260)', (d) => d.prop === 'z-index' && /^260/.test(d.value)],
  ['下拉层级(select-options:300)', (d) => d.prop === 'z-index' && /^300/.test(d.value)],
  ['工具栏层级(220)', (d) => d.prop === 'z-index' && /^220/.test(d.value)],
  ['搜索框层级(210)', (d) => d.prop === 'z-index' && /^210/.test(d.value)],
  ['氛围保护壳(.song-item 0.85 底)', (d) => /ambient-active[^{]*\.song-item/.test(d.selector) && /rgba\(255, 255, 255, 0\.85\)/.test(d.value)],
  ['氛围保护壳(工具栏 0.85 底)', (d) => /ambient-active[^{]*toolbar-split-inner/.test(d.selector) && /rgba\(255, 255, 255, 0\.85\)/.test(d.value)],
  ['氛围保护壳(#device-val 0.85 底)', (d) => /ambient-active[^{]*#device-val/.test(d.selector) && /rgba\(255, 255, 255, 0\.85\)/.test(d.value)],
  ['透明结界(header 透明)', (d) => /ambient-active[^{]*\.header/.test(d.selector)
      && d.prop === 'background' && /^transparent/.test(d.value)],
  ['进度条分栏定位(top:-14px)', (d) => /\.progress-container/.test(d.selector)
      && d.prop === 'top' && /^-14px/.test(d.value)],
  ['手机手势箭头隐藏(.drawer-handle/.up-arrow)', (d) => /split-view-active[^{]*\.(drawer-handle|up-arrow)\s*$/.test(d.selector)
      && ((d.prop === 'display' && /^none/.test(d.value)) || (d.prop === 'visibility' && /^hidden/.test(d.value)))],
  ['氛围遮罩分栏全宽', (d) => /fp-ambient-bg/.test(d.selector)
      && d.prop === 'width' && /^100%/.test(d.value)],
];

/* ---------- 5) z-index 逐元素比对（两段不一致 → 多半是层叠 bug） ---------- */
const Z_TARGETS = [
  // 注意：正则都以 \s*$ 结尾 —— 目标必须是该选择器的"末尾元素"，
  // 否则 `body.split-view-active .playlist #playlist-opts` 这种后代选择器会被误算成 .playlist。
  ['header', /split-view-active[^{]*\.header\s*$/],
  ['.player-bar', /split-view-active[^{]*\.player-bar\s*$/],
  ['.full-player', /split-view-active[^{]*\.full-player\s*$/],
  ['.playlist / .playlist-grid', /split-view-active[^{]*\.playlist(-grid)?\s*$/],
  ['#playlist-row', /#playlist-row\s*$/],
  ['#fp-ambient-bg', /fp-ambient-bg\s*$/],
  ['.toolbar-split-inner', /toolbar-split-inner\s*$/],
  ['.select-options', /\.select-options\s*$/],
  ['#device-val', /#device-val\s*$/],
  ['.split-toggle-btn', /split-toggle-btn\s*$/],
  ['#loading', /#loading\s*$/],
  ['.progress-container', /\.progress-container\s*$/],
  ['.fp-corner-tools', /fp-corner-tools\s*$/],
];

const problems = [];
console.log(`iWP-S 断点覆盖审计  ——  ${file}\n`);

console.log('【1】关注点 × 分栏带（768–959 与 ≥960 必须成对）');
for (const [name, hit] of CONCERNS) {
  const byBand = new Map();
  for (const d of decls) if (hit(d)) {
    const b = bandOf(d.media);
    if (!byBand.has(b)) byBand.set(b, []);
    byBand.get(b).push(d.line);
  }
  const has959 = byBand.has('768-959');
  const has960 = byBand.has('≥960');
  const global = byBand.has('全局');
  const mark = (has959 && has960) || global ? '✅' : (has959 || has960) ? '⚠️' : '❔';
  const detail = SPLIT_BANDS.map((b) => `${b}:${byBand.has(b) ? '✓' : '✗'}`).join('  ');
  const refs = [];
  for (const b of [...SPLIT_BANDS, '全局']) if (byBand.has(b)) refs.push(`${b}=行${byBand.get(b).slice(0, 3).join(',')}`);
  console.log(`  ${mark} ${name.padEnd(30)} ${detail}${refs.length ? '   ' + refs.join(' ') : ''}`);
  if (mark === '⚠️') problems.push(`关注点「${name}」只在 ${has959 ? '768-959' : '≥960'} 段出现，另一段缺失`);
}

console.log('\n【2】同一元素在两段的 z-index');
for (const [name, re] of Z_TARGETS) {
  const vals = { '768-959': [], '≥960': [] };
  let global = null;
  for (const d of decls) {
    if (d.prop !== 'z-index') continue;
    // 多选择器规则（A, B, C { ... }）只有在"每个选择器都命中该元素"时才计入，避免串味
    const parts = d.selector.split(',').map((x) => x.trim());
    if (!parts.length || !parts.every((x) => re.test(x))) continue;
    const n = parseInt(d.value, 10);
    if (Number.isNaN(n)) continue;
    const b = bandOf(d.media);
    if (b === '768-959' || b === '≥960') vals[b].push({ n, line: d.line });
    else if (b === '全局' && !global) global = { n, line: d.line };
  }
  const uniq = (arr) => [...new Set(arr.map((x) => x.n))].sort((x, y) => x - y);
  const A = uniq(vals['768-959']), C = uniq(vals['≥960']);
  const fmt = (arr) => (arr.length ? arr.join('/') : '—');
  if (!A.length && !C.length) {
    console.log(`  ·  ${name.padEnd(26)} 两段均未单独设置（用全局 ${global ? global.n : '—'}）`);
    continue;
  }
  const same = fmt(A) === fmt(C);
  console.log(`  ${same ? '✅' : '⚠️'} ${name.padEnd(26)} 768-959:${fmt(A)}   ≥960:${fmt(C)}`);
  if (!same) problems.push(`「${name}」的 z-index 两段不一致（768-959: ${fmt(A)} / ≥960: ${fmt(C)}）`);
}

console.log('\n【3】结论');
if (problems.length === 0) {
  console.log('  ✅ 未发现跨断点带缺失或不一致。');
} else {
  problems.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
  console.log(`\n  共 ${problems.length} 项需人工确认（有些可能是有意为之，例如只在宽屏才需要的规则）。`);
}
process.exit(strict && problems.length ? 1 : 0);
