// scripts/auto-version.mjs
// 自动版本号生成脚本。
//
// 用法：
//   node scripts/auto-version.mjs              → 输出完整版本 (如 "1.1.6-dev+42")
//   node scripts/auto-version.mjs --base       → 仅输出 base 版本 (如 "1.1.6")
//   node scripts/auto-version.mjs --tag        → 输出 GitHub Release tag (如 "dev-1.1.6")
//
// 设计方案：
//   plugin.json 中保留 base 版本号（如 "1.1.6-dev"），其中 patch 数字是"发布系列"标记。
//   每次构建时，本脚本从 git 提交计数自动生成 build metadata（semver 标准 + 号后缀），
//   确保每个构建都有唯一、递增的版本号，无需手动修改 plugin.json。
//
//   集成方式（示例，在 build-plugin.yml 中替换当前版本读取逻辑）：
//     PLUGIN_VERSION=$(node scripts/auto-version.mjs)
//     DEV_RELEASE_VERSION=$(node scripts/auto-version.mjs --base)
//     DEV_TAG=$(node scripts/auto-version.mjs --tag)
//
//   如果希望构建时自动更新 plugin.json 的 version 字段，可在 build 脚本中调用：
//     node scripts/auto-version.mjs --write
//   这将把完整版本写回 plugin.json。

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const PLUGIN_JSON = new URL("../plugin.json", import.meta.url).pathname;

function getBaseVersion() {
  const raw = JSON.parse(readFileSync(PLUGIN_JSON, "utf-8"));
  // 去掉 -dev 后缀得到纯 base 版本
  return raw.version.replace(/-dev.*$/, "");
}

function getCommitCount() {
  try {
    const count = execSync("git rev-list --count HEAD", {
      cwd: ROOT,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return count || "0";
  } catch {
    // 非 git 环境或不支持
    return "0";
  }
}

function getShortHash() {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: ROOT,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "0000000";
  }
}

const base = getBaseVersion();
const mode = process.argv[2] || "full";

switch (mode) {
  case "--base": {
    // 仅输出 base 版本（如 "1.1.6"），用于 CI 生成 release tag
    console.log(base);
    break;
  }
  case "--tag": {
    // 输出 GitHub Release tag（如 "dev-1.1.6"）
    console.log(`dev-${base}`);
    break;
  }
  case "--write": {
    // 将完整版本写回 plugin.json（慎用，会修改源文件）
    const count = getCommitCount();
    const hash = getShortHash();
    const full = `${base}-dev.${count}+${hash}`;
    const raw = JSON.parse(readFileSync(PLUGIN_JSON, "utf-8"));
    raw.version = full;
    writeFileSync(PLUGIN_JSON, JSON.stringify(raw, null, 2) + "\n", "utf-8");
    console.log(full);
    break;
  }
  default: {
    // 输出完整版本（如 "1.1.6-dev+42"），用于构建产物标识
    const count = getCommitCount();
    const hash = getShortHash();
    console.log(`${base}-dev.${count}+${hash}`);
    break;
  }
}