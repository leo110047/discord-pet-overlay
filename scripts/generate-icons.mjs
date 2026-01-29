#!/usr/bin/env node
/**
 * 生成應用程式 icon 各種尺寸
 * 用法: node scripts/generate-icons.mjs <source-image>
 *
 * 需要先安裝 sharp: npm install sharp
 */

import sharp from 'sharp';
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const iconsDir = join(projectRoot, 'src-tauri', 'icons');

const sourceImage = process.argv[2];

if (!sourceImage) {
  console.error('用法: node scripts/generate-icons.mjs <source-image>');
  console.error('例如: node scripts/generate-icons.mjs ./odango-icon.png');
  process.exit(1);
}

if (!existsSync(sourceImage)) {
  console.error(`找不到圖片: ${sourceImage}`);
  process.exit(1);
}

async function generateIcons() {
  console.log(`從 ${sourceImage} 生成 icons...`);

  // PNG 尺寸
  const pngSizes = [
    { size: 32, name: '32x32.png' },
    { size: 128, name: '128x128.png' },
    { size: 256, name: '128x128@2x.png' },  // Retina
    { size: 256, name: '256x256.png' },
    { size: 512, name: 'icon.png' },
  ];

  // 生成各種 PNG 尺寸 (確保 RGBA 格式)
  for (const { size, name } of pngSizes) {
    const outputPath = join(iconsDir, name);
    await sharp(sourceImage)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()  // 確保有 alpha 通道 (RGBA)
      .png()
      .toFile(outputPath);
    console.log(`✓ 生成 ${name} (${size}x${size}) [RGBA]`);
  }

  // 生成 ICO (Windows) - 需要多個尺寸
  const icoSizes = [16, 32, 48, 64, 128, 256];
  const icoTempFiles = [];

  for (const size of icoSizes) {
    const tempPath = join(iconsDir, `temp_${size}.png`);
    await sharp(sourceImage)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(tempPath);
    icoTempFiles.push(tempPath);
  }

  // 使用 ImageMagick 或 png2ico 合併成 ICO
  // 如果沒有這些工具，就用最大的 PNG 作為 ICO
  const icoPath = join(iconsDir, 'icon.ico');
  try {
    // 嘗試使用 ImageMagick
    const tempFilesStr = icoTempFiles.join(' ');
    execSync(`convert ${tempFilesStr} ${icoPath}`, { stdio: 'pipe' });
    console.log('✓ 生成 icon.ico (使用 ImageMagick)');
  } catch {
    // ImageMagick 不可用，複製 256x256 作為 ico
    await sharp(sourceImage)
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(icoPath);
    console.log('✓ 生成 icon.ico (256x256 PNG)');
    console.log('  提示: 安裝 ImageMagick 可生成多尺寸 ICO');
  }

  // 清理臨時檔案
  for (const tempFile of icoTempFiles) {
    try {
      execSync(`rm ${tempFile}`, { stdio: 'pipe' });
    } catch {}
  }

  // 生成 ICNS (macOS)
  const icnsPath = join(iconsDir, 'icon.icns');
  try {
    // 建立 iconset 資料夾
    const iconsetDir = join(iconsDir, 'icon.iconset');
    if (!existsSync(iconsetDir)) {
      mkdirSync(iconsetDir);
    }

    // macOS iconset 需要的尺寸
    const icnsSizes = [
      { size: 16, name: 'icon_16x16.png' },
      { size: 32, name: 'icon_16x16@2x.png' },
      { size: 32, name: 'icon_32x32.png' },
      { size: 64, name: 'icon_32x32@2x.png' },
      { size: 128, name: 'icon_128x128.png' },
      { size: 256, name: 'icon_128x128@2x.png' },
      { size: 256, name: 'icon_256x256.png' },
      { size: 512, name: 'icon_256x256@2x.png' },
      { size: 512, name: 'icon_512x512.png' },
      { size: 1024, name: 'icon_512x512@2x.png' },
    ];

    for (const { size, name } of icnsSizes) {
      await sharp(sourceImage)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(join(iconsetDir, name));
    }

    // 使用 iconutil 生成 icns
    execSync(`iconutil -c icns ${iconsetDir} -o ${icnsPath}`, { stdio: 'pipe' });
    console.log('✓ 生成 icon.icns');

    // 清理 iconset
    execSync(`rm -rf ${iconsetDir}`, { stdio: 'pipe' });
  } catch (e) {
    console.log('⚠ 無法生成 icon.icns (需要 macOS 的 iconutil)');
    console.log(`  錯誤: ${e.message}`);
  }

  console.log('\n完成！所有 icon 已生成到 src-tauri/icons/');
}

generateIcons().catch(console.error);
