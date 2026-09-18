// 构建后脚本（对应 docs/iwebplayer-s缓存问题分析.md 的方案 A）：
// 给构建产物里的「会长期缓存」的资源引用注入文件内容 sha256 前 8 位。
// 内容不变 → URL 不变（继续吃 immutable 缓存）；内容变了 → URL 自动变 → 旧缓存自然失效。
//
// 覆盖范围（宿主对子资源发 `public, max-age=31536000, immutable`，图片同样吃一年缓存）：
//   1) dist/_build/static/index.html 里所有 ./static/*.js 的 <script src> ?v=
//   2) 同一页面里的 <meta id="app-logo"> 图片（页头 logo / favicon / apple-touch-icon 都由它派生）
//   3) <link rel="manifest"> 指向的 PWA manifest 本体 ?v=
//   4) PWA manifest 内 icons[].src 的图片 ?v=
// 注意：只改构建目录，不回写源码；源码里的 ?v= 是历史占位值，构建时会被覆盖。
//
// 用法：songloft-plugin build && node scripts/inject-version-hashes.mjs
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, posix } from "node:path";
import JSZip from "jszip";

const ROOT = process.cwd();
const BUILD = join(ROOT, "dist", "_build");
const STATIC = join(BUILD, "static");
const INDEX = join(STATIC, "index.html");
const OUT_ZIP = join(ROOT, "dist", "iwebplayer-s.jsplugin.zip");

function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

// 按「相对 static/ 的路径」取文件内容哈希前 8 位；文件不存在时返回空串
function hashStaticAsset(relFromStatic) {
  try {
    return sha256Hex(readFileSync(join(STATIC, relFromStatic))).slice(0, 8);
  } catch {
    return "";
  }
}

function canonicalZipHash(buildDir) {
  const entries = [];
  (function walk(dir) {
    for (const item of readdirSync(dir)) {
      const full = join(dir, item);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else {
        const rel = posix.normalize(relative(buildDir, full).replace(/\\/g, "/"));
        if (rel === "plugin.json") continue;
        entries.push({ path: rel, hash: sha256Hex(readFileSync(full)) });
      }
    }
  })(buildDir);
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const hasher = createHash("sha256");
  for (const e of entries) {
    hasher.update(`${e.path}\n${e.hash}\n`);
  }
  return hasher.digest("hex");
}

// 0) 读取构建产物 plugin.json 的实际版本（dev 流程里是临时改过的构建版本，如 1.1.6.02-dev）
const manifestPath = join(BUILD, "plugin.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

// 1) PWA manifest：给 icons[].src 注入内容哈希（先剥掉可能存在的旧 ?v=，保证幂等）
const PWA_MANIFEST = join(STATIC, "manifest.json");
let pwaManifest = null;
let iconHashed = 0;
try {
  pwaManifest = JSON.parse(readFileSync(PWA_MANIFEST, "utf8"));
  if (Array.isArray(pwaManifest.icons)) {
    for (const icon of pwaManifest.icons) {
      if (!icon || typeof icon.src !== "string") continue;
      const hash = hashStaticAsset(icon.src.split("?")[0].replace(/^\.\//, ""));
      if (!hash) continue;
      icon.src = `${icon.src.split("?")[0]}?v=${hash}`;
      iconHashed += 1;
    }
  }
  writeFileSync(PWA_MANIFEST, JSON.stringify(pwaManifest, null, 2) + "\n");
  console.log(`[inject] ?v= hashes injected: ${iconHashed} PWA manifest icons`);
} catch (e) {
  console.warn("[inject] ⚠️ 跳过 PWA manifest 图标哈希:", String(e));
}

// 2) index.html：注入 ?v= 内容哈希（JS + 图片 + PWA manifest 本体）+ 真实 APP_VERSION
let html = readFileSync(INDEX, "utf8");
let replaced = 0;
html = html.replace(
  /(<script[^>]*src="\.\/static\/([^"?]+\.js))(?:\?v[^"]*)?"/g,
  (whole, prefix, file) => {
    let hash;
    try {
      hash = sha256Hex(readFileSync(join(STATIC, file))).slice(0, 8);
    } catch {
      return whole;
    }
    replaced += 1;
    return `${prefix}?v=${hash}"`;
  }
);
// 注入页头 logo（同时是 favicon / apple-touch-icon 的来源）
let assetHashed = 0;
html = html.replace(
  /(<meta\s+id="app-logo"\s+content="\.\/static\/)([^"?]+)(?:\?v[^"]*)?"/g,
  (whole, prefix, file) => {
    const hash = hashStaticAsset(file);
    if (!hash) return whole;
    assetHashed += 1;
    return `${prefix}${file}?v=${hash}"`;
  }
);

// 注入 PWA manifest 本体（manifest 内容已被上一步改写，这里用的是改写后的哈希）
const manifestHash = sha256Hex(readFileSync(PWA_MANIFEST)).slice(0, 8);
html = html.replace(
  /(<link[^>]*rel="manifest"[^>]*href=")(\.\/static\/manifest\.json)(?:\?v[^"]*)?"/g,
  (whole, prefix, file) => {
    assetHashed += 1;
    return `${prefix}${file}?v=${manifestHash}"`;
  }
);

// 注入真实插件版本号到 window.APP_VERSION（源文件为 __APP_VERSION__ 占位符）
const beforeAppVersion = html;
html = html.replace(
  /window\.APP_VERSION\s*=\s*'[^']*'/,
  `window.APP_VERSION = '${manifest.version}'`
);
if (html === beforeAppVersion) {
  console.error("[inject] ❌ 未找到 window.APP_VERSION，APP_VERSION 注入失败");
  process.exit(1);
} else {
  console.log(`[inject] APP_VERSION injected: ${manifest.version}`);
}
writeFileSync(INDEX, html);
console.log(`[inject] ?v= hashes injected: ${replaced} script tags, ${assetHashed} image/manifest refs`);

// 2) 更新 plugin.json 的 zipHash（与 builder 一致：排除 plugin.json 自身）
manifest.zipHash = canonicalZipHash(BUILD);
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`[inject] zipHash updated: ${manifest.zipHash.slice(0, 12)}…`);

// 3) 重新打包（与 builder 相同结构：DEFLATE，目录递归，无目录条目）
const zip = new JSZip();
(function addDir(z, dir, prefix) {
  for (const item of readdirSync(dir)) {
    const full = join(dir, item);
    const zipPath = prefix ? `${prefix}/${item}` : item;
    if (statSync(full).isDirectory()) {
      addDir(z, full, zipPath);
    } else {
      z.file(zipPath, readFileSync(full));
    }
  }
})(zip, BUILD, "");
const zipBuffer = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
});
writeFileSync(OUT_ZIP, zipBuffer);
console.log(
  `[inject] zip written: ${OUT_ZIP} (${(zipBuffer.length / 1024).toFixed(1)} KB)`
);
