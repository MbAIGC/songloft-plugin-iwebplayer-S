// 构建后脚本：给 dist/_build/static/index.html 里所有 ./static/*.js 的 ?v=
// 注入文件内容 sha256 前 8 位。内容不变 → URL 不变（继续吃 immutable 缓存）；
// 内容变了 → URL 自动变 → 旧浏览器缓存自然失效。
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

// 1) 注入 ?v= 内容哈希 + 真实 APP_VERSION
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
console.log(`[inject] ?v= hashes injected: ${replaced} script tags`);

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
