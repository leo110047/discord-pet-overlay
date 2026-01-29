/**
 * ODANGO - 主程式入口（寵物 Overlay 視窗）
 */

import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { currentMonitor, LogicalPosition, LogicalSize } from '@tauri-apps/api/window';
import { createMultiPetManager, MultiPetManager, setApiBaseUrl } from './anim';
import { createApiClient, ApiClient, ApiError } from './api';
import { loadConfig, saveAllPets, saveSelectedPetIds, saveWindowConfig, isTokenValid } from './store';
import { AppConfig, PetState } from './types';
import { initInteractionMode, updateWindowWidth } from './interaction-mode';

// 視窗大小常數
const WINDOW_HEIGHT = 200;

// 輪詢間隔（10 分鐘，測試用，之後會改成更長）
const POLL_INTERVAL_MS = 10 * 60 * 1000;

// 預設伺服器 URL
const DEFAULT_SERVER_URL = 'http://localhost:8787';

// 全域狀態
let config: AppConfig;
let petManager: MultiPetManager;
let apiClient: ApiClient;
let isConnected = false;
let pollIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * 初始化應用程式
 */
async function init(): Promise<void> {
  console.log('Initializing ODANGO...');

  // 載入設定
  config = await loadConfig();
  console.log('Config loaded, token:', config.token ? 'exists' : 'none');

  // 初始化 API Client
  const serverUrl = config.serverUrl || DEFAULT_SERVER_URL;
  apiClient = createApiClient(serverUrl);
  setApiBaseUrl(serverUrl); // 設定 sprite 快取的 API 基礎 URL
  if (config.token) {
    apiClient.setToken(config.token);
  }

  // 取得螢幕尺寸並調整視窗
  const mainWindow = getCurrentWebviewWindow();
  const monitor = await currentMonitor();
  let screenWidth = window.innerWidth;

  if (monitor) {
    const scaleFactor = monitor.scaleFactor;
    screenWidth = Math.round(monitor.size.width / scaleFactor);
    const logicalScreenHeight = monitor.size.height / scaleFactor;
    console.log('Screen width:', screenWidth, 'Screen height:', logicalScreenHeight, 'Scale factor:', scaleFactor);

    // 使用儲存的寬度或螢幕寬度
    const windowWidthToUse = config.windowWidth || screenWidth;

    // 設定視窗大小
    await mainWindow.setSize(new LogicalSize(windowWidthToUse, WINDOW_HEIGHT));

    // 套用儲存的視窗位置
    const savedX = config.windowPosition?.x ?? 0;
    const savedY = config.petWindowY ?? Math.round(logicalScreenHeight - WINDOW_HEIGHT);
    await mainWindow.setPosition(new LogicalPosition(savedX, savedY));

    screenWidth = windowWidthToUse;
  }

  // 初始化多寵物管理器
  const petContainer = document.getElementById('pet-container')!;
  petManager = createMultiPetManager(petContainer, screenWidth);

  // 設定寵物點擊事件 - 打開設定視窗
  petManager.setOnPetClick(() => {
    openSettingsWindow();
  });

  // 檢查是否已連線（有 token 且未過期）
  isConnected = !!config.token && isTokenValid(config.tokenExpiresAt);
  console.log('Token check:', {
    hasToken: !!config.token,
    expiresAt: config.tokenExpiresAt,
    isValid: isTokenValid(config.tokenExpiresAt),
    isConnected
  });

  // 套用移動設定
  petManager.setMovementEnabled(config.petMovementEnabled);

  // 檢查是否顯示寵物
  const hasPets = config.allPets.length > 0;
  const shouldShowPet = config.petVisible !== false && isConnected && hasPets;

  if (shouldShowPet) {
    // 已連線且有寵物狀態且設定為顯示
    const petsToShow = getSelectedPets();
    console.log('Showing pets:', petsToShow.length);
    petManager.updatePets(petsToShow);
    petContainer.classList.remove('hidden');
    // 顯示主視窗
    await mainWindow.show();
  } else {
    // 隱藏寵物和主視窗
    console.log('Hiding pet - visible:', config.petVisible, 'isConnected:', isConnected, 'hasPets:', hasPets);
    petContainer.classList.add('hidden');
    // 未登入或設定為隱藏時，不顯示主視窗
  }

  // 初始化互動模式（熱鍵喚醒調整視窗）
  await initInteractionMode(screenWidth, WINDOW_HEIGHT, async (x, y, width) => {
    // 視窗配置變更時的回調
    console.log('Window config changed:', { x, y, width });
    config.windowPosition = { x, y };
    config.petWindowY = y;
    config.windowWidth = width;
    await saveWindowConfig(x, y, width);
    // 更新寵物活動範圍
    petManager.setContainerWidth(width);
    updateWindowWidth(width);
  });

  // 監聯視窗大小變更
  window.addEventListener('resize', () => {
    petManager.setContainerWidth(window.innerWidth);
    updateWindowWidth(window.innerWidth);
  });

  // 監聽來自設定視窗的事件
  await setupEventListeners();

  // 開始 Discord 偵測
  startDiscordCheck();

  // 如果已連線，啟動自動輪詢
  if (isConnected) {
    startPolling();
  }

  console.log('Initialization complete, connected:', isConnected);
}

/**
 * 取得選擇要顯示的寵物
 */
function getSelectedPets(): PetState[] {
  if (config.selectedPetIds.length === 0) {
    // 如果沒有選擇，預設顯示 isActive 的寵物
    const activePet = config.allPets.find(p => p.isActive);
    return activePet ? [activePet] : (config.allPets.length > 0 ? [config.allPets[0]] : []);
  }

  // 根據選擇的 ID 過濾
  return config.allPets.filter(p => config.selectedPetIds.includes(p.odangoId));
}

/**
 * 打開設定視窗
 */
async function openSettingsWindow(): Promise<void> {
  try {
    // 檢查設定視窗是否已存在
    const existingWindow = await WebviewWindow.getByLabel('settings');
    if (existingWindow) {
      await existingWindow.show();
      await existingWindow.setFocus();
      return;
    }

    // 建立新的設定視窗
    const settingsWindow = new WebviewWindow('settings', {
      url: '/settings.html',
      title: '設定 - ODANGO',
      width: 400,
      height: 600,
      minWidth: 360,
      minHeight: 400,
      resizable: true,
      center: true,
    });

    settingsWindow.once('tauri://created', () => {
      console.log('Settings window created');
    });

    settingsWindow.once('tauri://error', (e) => {
      console.error('Failed to create settings window:', e);
    });
  } catch (error) {
    console.error('Error opening settings window:', error);
  }
}

/**
 * 設定事件監聽器
 */
async function setupEventListeners(): Promise<void> {
  const petContainer = document.getElementById('pet-container')!;

  // 監聽寵物列表更新（連線成功時）
  await listen<PetState[]>('pets-updated', async (event) => {
    console.log('Pets updated, count:', event.payload.length);
    isConnected = true;
    config.allPets = event.payload;
    await saveAllPets(event.payload);

    // 更新顯示的寵物
    const petsToShow = getSelectedPets();
    petManager.updatePets(petsToShow);

    // 顯示寵物並開始動畫
    if (petsToShow.length > 0) {
      petContainer.classList.remove('hidden');

      // 顯示主視窗（如果設定為顯示）
      if (config.petVisible !== false) {
        const mainWindow = getCurrentWebviewWindow();
        await mainWindow.show();
      }
    }
  });

  // 監聽選擇的寵物變更
  await listen<string[]>('selected-pets-changed', async (event) => {
    console.log('Selected pets changed:', event.payload);
    config.selectedPetIds = event.payload;
    await saveSelectedPetIds(event.payload);

    // 更新顯示的寵物
    const petsToShow = getSelectedPets();
    petManager.updatePets(petsToShow);
  });

  // 監聯連線成功事件
  await listen<{ token: string; userId: string }>('linked', (event) => {
    console.log('Linked successfully');
    isConnected = true;
    // 更新 API client token
    apiClient.setToken(event.payload.token);
    // 啟動自動輪詢
    startPolling();
  });

  // 監聽登出事件
  await listen('logged-out', async () => {
    console.log('Logged out, hiding pet');
    isConnected = false;
    // 停止輪詢
    stopPolling();
    // 清除 token
    apiClient.setToken(null);
    // 清除寵物
    petManager.clear();
    petContainer.classList.add('hidden');
    // 隱藏主視窗
    const mainWindow = getCurrentWebviewWindow();
    await mainWindow.hide();
  });

  // 監聽顯示/隱藏設定變更
  await listen<{ visible: boolean }>('visibility-changed', async (event) => {
    console.log('Visibility changed:', event.payload.visible);
    config.petVisible = event.payload.visible;
    const mainWindow = getCurrentWebviewWindow();
    if (event.payload.visible) {
      await mainWindow.show();
      if (isConnected && config.allPets.length > 0) {
        const petsToShow = getSelectedPets();
        petManager.updatePets(petsToShow);
        petContainer.classList.remove('hidden');
      }
    } else {
      await mainWindow.hide();
    }
  });

  // 監聽移動設定變更
  await listen<{ enabled: boolean }>('movement-changed', (event) => {
    console.log('Movement changed:', event.payload.enabled);
    config.petMovementEnabled = event.payload.enabled;
    petManager.setMovementEnabled(event.payload.enabled);
  });

  // 監聽重置視窗位置
  await listen('reset-position', async () => {
    console.log('=== Resetting window position ===');
    const mainWindow = getCurrentWebviewWindow();
    const monitor = await currentMonitor();

    if (monitor) {
      const scaleFactor = monitor.scaleFactor;
      const screenWidth = Math.round(monitor.size.width / scaleFactor);
      const screenHeight = Math.round(monitor.size.height / scaleFactor);
      const newY = screenHeight - WINDOW_HEIGHT;

      console.log('Screen:', screenWidth, 'x', screenHeight, 'scaleFactor:', scaleFactor);
      console.log('New position: x=0, y=', newY, 'width=', screenWidth, 'height=', WINDOW_HEIGHT);

      // 先顯示視窗（避免在隱藏狀態下設定位置無效）
      await mainWindow.show();
      await mainWindow.setFocus();

      // 重置為螢幕寬度和底部位置
      await mainWindow.setSize(new LogicalSize(screenWidth, WINDOW_HEIGHT));
      await mainWindow.setPosition(new LogicalPosition(0, newY));

      // 更新設定
      config.windowPosition = { x: 0, y: newY };
      config.petWindowY = newY;
      config.windowWidth = screenWidth;
      config.petVisible = true;
      await saveWindowConfig(0, newY, screenWidth);

      // 更新寵物活動範圍
      petManager.setContainerWidth(screenWidth);
      updateWindowWidth(screenWidth);

      console.log('Window position reset complete');
    } else {
      console.error('No monitor found!');
    }
  });
}

/**
 * 啟動自動輪詢
 */
function startPolling(): void {
  // 避免重複啟動
  if (pollIntervalId) {
    console.log('Polling already started');
    return;
  }

  console.log(`Starting auto-polling every ${POLL_INTERVAL_MS / 1000 / 60} minutes`);

  // 設定定時輪詢
  pollIntervalId = setInterval(pollPetState, POLL_INTERVAL_MS);
}

/**
 * 停止自動輪詢
 */
function stopPolling(): void {
  if (pollIntervalId) {
    console.log('Stopping auto-polling');
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
}

/**
 * 輪詢寵物狀態
 */
async function pollPetState(): Promise<void> {
  if (!isConnected || !apiClient.getToken()) {
    console.log('Not connected, skipping poll');
    return;
  }

  console.log('Polling pet state...');

  try {
    const pets = await apiClient.getPets();
    console.log('Poll successful, pet count:', pets.length);

    // 更新狀態
    config.allPets = pets;
    await saveAllPets(pets);

    // 更新顯示的寵物
    const petsToShow = getSelectedPets();
    petManager.updatePets(petsToShow);

    // 確保寵物顯示（如果設定為顯示）
    if (config.petVisible !== false && petsToShow.length > 0) {
      const petContainer = document.getElementById('pet-container');
      petContainer?.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Poll failed:', error);

    // 如果是認證錯誤，停止輪詢（讓用戶重新登入）
    if (error instanceof ApiError) {
      if (error.code === 'INVALID_TOKEN' || error.code === 'MISSING_TOKEN') {
        console.log('Token invalid, stopping polling');
        stopPolling();
        isConnected = false;
      }
    }
    // 其他錯誤（如網路問題）靜默處理，下次輪詢會再試
  }
}

/**
 * 開始 Discord 偵測
 */
function startDiscordCheck(): void {
  // 立即檢查一次
  checkDiscordStatus();

  // 每 30 秒檢查一次
  setInterval(checkDiscordStatus, 30000);
}

/**
 * 檢查 Discord 是否正在運行
 */
async function checkDiscordStatus(): Promise<void> {
  try {
    const isRunning = await invoke<boolean>('is_discord_running');
    const warningEl = document.getElementById('discord-warning');

    if (warningEl) {
      // 只在已連線時顯示警告
      if (isConnected && !isRunning) {
        warningEl.classList.remove('hidden');
      } else {
        warningEl.classList.add('hidden');
      }
    }
  } catch (error) {
    console.error('Failed to check Discord status:', error);
  }
}

// 啟動應用程式
document.addEventListener('DOMContentLoaded', init);
