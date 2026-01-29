/**
 * Sprite 快取模組
 *
 * 負責從 API 下載 sprite 圖片並快取到本地
 * 使用 Tauri 的檔案系統 API 儲存到 app data 目錄
 */

import { exists, mkdir, readFile, writeFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { appDataDir } from '@tauri-apps/api/path';

/** Sprite 快取目錄名稱 */
const SPRITES_DIR = 'sprites';

/** 記憶體內的 blob URL 快取 */
const blobUrlCache: Map<string, string> = new Map();

/** 是否已初始化 */
let initialized = false;

/**
 * 初始化快取目錄
 */
async function ensureCacheDir(): Promise<void> {
  if (initialized) return;

  try {
    const dirExists = await exists(SPRITES_DIR, { baseDir: BaseDirectory.AppData });
    if (!dirExists) {
      await mkdir(SPRITES_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
    }
    initialized = true;
  } catch (error) {
    console.error('Failed to create sprites cache directory:', error);
    throw error;
  }
}

/**
 * 取得 sprite 的本地快取路徑
 * @param spritePath API 返回的 spritePath，如 'slime/stage1.gif'
 */
function getCacheFilePath(spritePath: string): string {
  // 將 / 轉換為 _ 以避免子目錄問題
  return `${SPRITES_DIR}/${spritePath.replace(/\//g, '_')}`;
}

/**
 * 檢查 sprite 是否已快取
 */
async function isCached(spritePath: string): Promise<boolean> {
  try {
    const filePath = getCacheFilePath(spritePath);
    return await exists(filePath, { baseDir: BaseDirectory.AppData });
  } catch {
    return false;
  }
}

/**
 * 從本地快取讀取 sprite
 */
async function readFromCache(spritePath: string): Promise<Uint8Array | null> {
  try {
    const filePath = getCacheFilePath(spritePath);
    const data = await readFile(filePath, { baseDir: BaseDirectory.AppData });
    return data;
  } catch {
    return null;
  }
}

/**
 * 儲存 sprite 到本地快取
 */
async function saveToCache(spritePath: string, data: Uint8Array): Promise<void> {
  try {
    await ensureCacheDir();
    const filePath = getCacheFilePath(spritePath);
    await writeFile(filePath, data, { baseDir: BaseDirectory.AppData });
  } catch (error) {
    console.error('Failed to save sprite to cache:', error);
  }
}

/**
 * 從 API 下載 sprite
 */
async function downloadSprite(baseUrl: string, spritePath: string): Promise<Uint8Array> {
  const url = `${baseUrl}/assets/${spritePath}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download sprite: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * 將 Uint8Array 轉換為 blob URL
 */
function createBlobUrl(data: Uint8Array, mimeType: string = 'image/gif'): string {
  const blob = new Blob([data as BlobPart], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * 根據檔名取得 MIME type
 */
function getMimeType(spritePath: string): string {
  if (spritePath.endsWith('.gif')) return 'image/gif';
  if (spritePath.endsWith('.png')) return 'image/png';
  if (spritePath.endsWith('.jpg') || spritePath.endsWith('.jpeg')) return 'image/jpeg';
  if (spritePath.endsWith('.webp')) return 'image/webp';
  return 'image/gif'; // 預設為 gif
}

/**
 * 取得 sprite URL（主要 API）
 *
 * 流程：
 * 1. 檢查記憶體快取
 * 2. 檢查本地檔案快取
 * 3. 從 API 下載並快取
 *
 * @param baseUrl API 伺服器 URL
 * @param spritePath API 返回的 spritePath，如 'slime/stage1.gif'
 * @returns Blob URL 供 img src 或 background-image 使用
 */
export async function getSpriteUrl(baseUrl: string, spritePath: string): Promise<string> {
  // 1. 檢查記憶體快取
  const cacheKey = spritePath;
  if (blobUrlCache.has(cacheKey)) {
    return blobUrlCache.get(cacheKey)!;
  }

  let data: Uint8Array | null = null;

  // 2. 檢查本地檔案快取
  if (await isCached(spritePath)) {
    data = await readFromCache(spritePath);
  }

  // 3. 從 API 下載
  if (!data) {
    try {
      data = await downloadSprite(baseUrl, spritePath);
      // 儲存到本地快取
      await saveToCache(spritePath, data);
    } catch (error) {
      console.error(`Failed to download sprite ${spritePath}:`, error);
      // 返回空字串，讓 UI 顯示預設圖或空白
      return '';
    }
  }

  // 建立 blob URL 並快取到記憶體
  const mimeType = getMimeType(spritePath);
  const blobUrl = createBlobUrl(data, mimeType);
  blobUrlCache.set(cacheKey, blobUrl);

  return blobUrl;
}

/**
 * 預載入多個 sprite
 */
export async function preloadSprites(baseUrl: string, spritePaths: string[]): Promise<void> {
  await Promise.all(spritePaths.map(path => getSpriteUrl(baseUrl, path)));
}

/**
 * 清除記憶體中的 blob URL 快取
 * 注意：這會釋放 blob URL，使用中的圖片可能會失效
 */
export function clearBlobUrlCache(): void {
  for (const url of blobUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  blobUrlCache.clear();
}

/**
 * 取得 app data 目錄下的 sprites 完整路徑（用於除錯）
 */
export async function getSpriteCachePath(): Promise<string> {
  const appData = await appDataDir();
  return `${appData}${SPRITES_DIR}`;
}
