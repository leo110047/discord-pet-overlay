#!/usr/bin/env node
/**
 * 版本號同步腳本
 * 用法: node scripts/sync-version.mjs <new-version>
 * 範例: node scripts/sync-version.mjs 1.0.5
 *
 * 會自動更新以下檔案的版本號：
 * - package.json
 * - src-tauri/tauri.conf.json
 * - src-tauri/Cargo.toml
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const newVersion = process.argv[2];

if (!newVersion) {
  // 如果沒有提供版本號，顯示當前版本
  console.log('當前版本號：');
  checkVersions();
  console.log('\n用法: node scripts/sync-version.mjs <new-version>');
  console.log('範例: node scripts/sync-version.mjs 1.0.5');
  process.exit(0);
}

// 驗證版本號格式
if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error('錯誤: 版本號格式不正確，應為 x.y.z 格式（例如 1.0.5）');
  process.exit(1);
}

console.log(`同步版本號到 ${newVersion}...\n`);

// 更新 package.json
const packageJsonPath = join(projectRoot, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const oldPackageVersion = packageJson.version;
packageJson.version = newVersion;
writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log(`✓ package.json: ${oldPackageVersion} -> ${newVersion}`);

// 更新 tauri.conf.json
const tauriConfPath = join(projectRoot, 'src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf-8'));
const oldTauriVersion = tauriConf.version;
tauriConf.version = newVersion;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
console.log(`✓ src-tauri/tauri.conf.json: ${oldTauriVersion} -> ${newVersion}`);

// 更新 Cargo.toml
const cargoTomlPath = join(projectRoot, 'src-tauri', 'Cargo.toml');
let cargoToml = readFileSync(cargoTomlPath, 'utf-8');
const versionMatch = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);
const oldCargoVersion = versionMatch ? versionMatch[1] : 'unknown';
cargoToml = cargoToml.replace(/^version\s*=\s*"[^"]+"/m, `version = "${newVersion}"`);
writeFileSync(cargoTomlPath, cargoToml);
console.log(`✓ src-tauri/Cargo.toml: ${oldCargoVersion} -> ${newVersion}`);

// 更新 settings.html（預設版本號）
const settingsHtmlPath = join(projectRoot, 'settings.html');
let settingsHtml = readFileSync(settingsHtmlPath, 'utf-8');
const htmlVersionMatch = settingsHtml.match(/<span id="app-version">v([^<]+)<\/span>/);
const oldHtmlVersion = htmlVersionMatch ? htmlVersionMatch[1] : 'unknown';
settingsHtml = settingsHtml.replace(
  /<span id="app-version">v[^<]+<\/span>/,
  `<span id="app-version">v${newVersion}</span>`
);
writeFileSync(settingsHtmlPath, settingsHtml);
console.log(`✓ settings.html: ${oldHtmlVersion} -> ${newVersion}`);

console.log('\n版本號同步完成！');
console.log('\n下一步：');
console.log('1. 執行 cargo generate-lockfile 更新 Cargo.lock');
console.log('2. git add . && git commit -m "chore: bump version to ' + newVersion + '"');
console.log('3. git tag v' + newVersion);
console.log('4. git push && git push --tags');

/**
 * 檢查並顯示當前版本號
 */
function checkVersions() {
  const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'));
  const tauriConf = JSON.parse(readFileSync(join(projectRoot, 'src-tauri', 'tauri.conf.json'), 'utf-8'));
  const cargoToml = readFileSync(join(projectRoot, 'src-tauri', 'Cargo.toml'), 'utf-8');
  const cargoMatch = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);
  const settingsHtml = readFileSync(join(projectRoot, 'settings.html'), 'utf-8');
  const htmlMatch = settingsHtml.match(/<span id="app-version">v([^<]+)<\/span>/);

  console.log(`  package.json:              ${packageJson.version}`);
  console.log(`  src-tauri/tauri.conf.json: ${tauriConf.version}`);
  console.log(`  src-tauri/Cargo.toml:      ${cargoMatch ? cargoMatch[1] : 'unknown'}`);
  console.log(`  settings.html:             ${htmlMatch ? htmlMatch[1] : 'unknown'}`);

  // 檢查是否一致
  const versions = [
    packageJson.version,
    tauriConf.version,
    cargoMatch ? cargoMatch[1] : null,
    htmlMatch ? htmlMatch[1] : null
  ];
  const allSame = versions.every(v => v === versions[0]);

  if (allSame) {
    console.log('\n✓ 所有版本號一致');
  } else {
    console.log('\n⚠ 警告: 版本號不一致！請執行此腳本來同步版本號');
  }
}
