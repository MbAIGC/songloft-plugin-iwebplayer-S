#!/usr/bin/env node
// 🔐 构建产物一致性校验：版本 / URL / 产物完整性（CI 门禁最后一环）
import { readFileSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const fail = (msg) => { console.error(`❌ ${msg}`); failures++; };
const ok = (msg) => console.log(`✅ ${msg}`);

// 1) plugin.json 与 package.json 版本一致
const plugin = JSON.parse(readFileSync(join(root, 'plugin.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
if (plugin.version !== pkg.version) fail(`plugin.json 版本(${plugin.version}) ≠ package.json(${pkg.version})`);
else ok(`版本一致: ${plugin.version}`);

// 2) 产物存在且非空
const zip = join(root, 'dist', 'iwebplayer-s.jsplugin.zip');
if (!existsSync(zip)) fail('dist/iwebplayer-s.jsplugin.zip 不存在');
else if (statSync(zip).size < 100 * 1024) fail(`产物过小(${statSync(zip).size}B)，疑似未完整构建`);
else ok(`产物存在: ${(statSync(zip).size / 1024).toFixed(1)} KB`);

// 3) zip 内 plugin.json 的 updateUrl（自动更新入口）与版本一致（用 unzip 解出清单再校验）
if (existsSync(zip)) {
  try {
    const inner = execFileSync('unzip', ['-p', zip, 'plugin.json'], { encoding: 'utf8' });
    const innerManifest = JSON.parse(inner);
    if (innerManifest.version !== plugin.version) {
      fail(`zip 内 version(${innerManifest.version}) ≠ plugin.json(${plugin.version})`);
    } else {
      ok(`zip 内 version 一致`);
    }
    // 🔐 自动更新契约：plugin.json 不再保存动态 download_url（易过期），
    // 改为 updateUrl 指向 CI 维护的 manifest.json（JSON：version + download_url）。
    // 此处只校验 updateUrl 已配置且为 http(s) 地址（分支无关，main 亦适用）。
    const updateUrl = innerManifest.updateUrl || '';
    if (!updateUrl || !/^https?:\/\//.test(updateUrl)) {
      fail(`zip 内 updateUrl 未配置或非 http(s) 地址（自动更新入口缺失）`);
    } else {
      ok(`zip 内 updateUrl 已配置: ${updateUrl}`);
    }
  } catch (e) {
    fail('zip 校验异常（unzip 不可用或清单损坏）: ' + String(e).split('\n')[0]);
  }
}

process.exit(failures ? 1 : 0);
