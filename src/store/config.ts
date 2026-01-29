/**
 * 設定儲存模組
 *
 * 使用 Tauri Store plugin 來持久化儲存設定
 */

import { load, Store } from '@tauri-apps/plugin-store';
import { AppConfig, DEFAULT_CONFIG, PetState } from '../types';

const STORE_PATH = 'config.json';
let store: Store | null = null;

/**
 * 取得 Store 實例
 */
async function getStore(): Promise<Store> {
  if (!store) {
    store = await load(STORE_PATH, { defaults: {} });
  }
  return store;
}

/**
 * 載入設定
 */
export async function loadConfig(): Promise<AppConfig> {
  try {
    const s = await getStore();

    const serverUrl = await s.get<string>('serverUrl') ?? DEFAULT_CONFIG.serverUrl;
    const token = await s.get<string>('token') ?? DEFAULT_CONFIG.token;
    const userId = await s.get<string>('userId') ?? DEFAULT_CONFIG.userId;
    const tokenExpiresAt = await s.get<string>('tokenExpiresAt') ?? DEFAULT_CONFIG.tokenExpiresAt;
    const pollIntervalMinutes = await s.get<number>('pollIntervalMinutes') ?? DEFAULT_CONFIG.pollIntervalMinutes;
    const allPets = await s.get<PetState[]>('allPets') ?? DEFAULT_CONFIG.allPets;
    const selectedPetIds = await s.get<string[]>('selectedPetIds') ?? DEFAULT_CONFIG.selectedPetIds;
    const windowPosition = await s.get<{ x: number; y: number }>('windowPosition') ?? DEFAULT_CONFIG.windowPosition;
    const petWindowY = await s.get<number>('petWindowY') ?? DEFAULT_CONFIG.petWindowY;
    const windowWidth = await s.get<number>('windowWidth') ?? DEFAULT_CONFIG.windowWidth;
    const petMovementEnabled = await s.get<boolean>('petMovementEnabled') ?? DEFAULT_CONFIG.petMovementEnabled;
    const petVisible = await s.get<boolean>('petVisible') ?? DEFAULT_CONFIG.petVisible;

    return {
      serverUrl,
      token,
      userId,
      tokenExpiresAt,
      pollIntervalMinutes,
      allPets,
      selectedPetIds,
      windowPosition,
      petWindowY,
      windowWidth,
      petMovementEnabled,
      petVisible,
    };
  } catch (error) {
    console.error('Failed to load config:', error);
    return DEFAULT_CONFIG;
  }
}

/**
 * 儲存設定
 */
export async function saveConfig(config: Partial<AppConfig>): Promise<void> {
  try {
    const s = await getStore();

    for (const [key, value] of Object.entries(config)) {
      await s.set(key, value);
    }

    await s.save();
  } catch (error) {
    console.error('Failed to save config:', error);
    throw error;
  }
}

/**
 * 儲存 Server URL
 */
export async function saveServerUrl(url: string): Promise<void> {
  await saveConfig({ serverUrl: url });
}

/**
 * 儲存 Token 資訊
 */
export async function saveToken(token: string, userId: string, expiresAt: string): Promise<void> {
  await saveConfig({
    token,
    userId,
    tokenExpiresAt: expiresAt,
  });
}

/**
 * 清除 Token 資訊
 */
export async function clearToken(): Promise<void> {
  await saveConfig({
    token: null,
    userId: null,
    tokenExpiresAt: null,
  });
}

/**
 * 儲存輪詢間隔
 */
export async function savePollInterval(minutes: number): Promise<void> {
  await saveConfig({ pollIntervalMinutes: Math.max(5, minutes) });
}

/**
 * 儲存所有寵物狀態
 */
export async function saveAllPets(pets: PetState[]): Promise<void> {
  await saveConfig({ allPets: pets });
}

/**
 * 儲存選擇的寵物 ID 列表
 */
export async function saveSelectedPetIds(ids: string[]): Promise<void> {
  await saveConfig({ selectedPetIds: ids });
}

/**
 * 儲存視窗位置
 */
export async function saveWindowPosition(x: number, y: number): Promise<void> {
  await saveConfig({ windowPosition: { x, y } });
}

/**
 * 儲存寵物視窗 Y 座標
 */
export async function savePetWindowY(y: number): Promise<void> {
  await saveConfig({ petWindowY: y });
}

/**
 * 儲存寵物移動設定
 */
export async function savePetMovementEnabled(enabled: boolean): Promise<void> {
  await saveConfig({ petMovementEnabled: enabled });
}

/**
 * 儲存寵物顯示設定
 */
export async function savePetVisible(visible: boolean): Promise<void> {
  await saveConfig({ petVisible: visible });
}

/**
 * 儲存視窗配置（位置和寬度）
 */
export async function saveWindowConfig(x: number, y: number, width: number): Promise<void> {
  await saveConfig({
    windowPosition: { x, y },
    petWindowY: y,
    windowWidth: width,
  });
}

/**
 * 檢查 Token 是否有效（未過期）
 */
export function isTokenValid(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) > new Date();
}
