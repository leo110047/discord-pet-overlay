/**
 * Discord Pet Overlay - 主程式入口（寵物 Overlay 視窗）
 */

import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { currentMonitor, LogicalPosition, LogicalSize } from '@tauri-apps/api/window';
import { createPetController } from './anim';
import { createApiClient, ApiClient, ApiError } from './api';
import { loadConfig, savePetState, savePetWindowY, isTokenValid } from './store';
import { AppConfig, PetState } from './types';

// 視窗大小常數
const WINDOW_HEIGHT = 200;

// 輪詢間隔（10 分鐘，測試用，之後會改成更長）
const POLL_INTERVAL_MS = 10 * 60 * 1000;

// 預設伺服器 URL
const DEFAULT_SERVER_URL = 'http://localhost:8787';

// 全域狀態
let config: AppConfig;
let petController: ReturnType<typeof createPetController>;
let apiClient: ApiClient;
let isConnected = false;
let pollIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * 初始化應用程式
 */
async function init(): Promise<void> {
  console.log('Initializing Discord Pet Overlay...');

  // 載入設定
  config = await loadConfig();
  console.log('Config loaded, token:', config.token ? 'exists' : 'none');

  // 初始化 API Client
  const serverUrl = config.serverUrl || DEFAULT_SERVER_URL;
  apiClient = createApiClient(serverUrl);
  if (config.token) {
    apiClient.setToken(config.token);
  }

  // 取得螢幕尺寸並調整視窗寬度為螢幕寬度
  const mainWindow = getCurrentWebviewWindow();
  const monitor = await currentMonitor();
  let screenWidth = window.innerWidth;

  if (monitor) {
    const scaleFactor = monitor.scaleFactor;
    screenWidth = Math.round(monitor.size.width / scaleFactor);
    console.log('Screen width:', screenWidth, 'Scale factor:', scaleFactor);

    // 設定視窗寬度為螢幕寬度，X 座標固定為 0
    await mainWindow.setSize(new LogicalSize(screenWidth, WINDOW_HEIGHT));
    const currentPos = await mainWindow.outerPosition();
    await mainWindow.setPosition(new LogicalPosition(0, currentPos.y));
  }

  // 初始化寵物
  const petElement = document.getElementById('pet')!;
  const petContainer = document.getElementById('pet-container')!;
  petController = createPetController(petElement, screenWidth);

  // 檢查是否已連線（有 token 且未過期）
  isConnected = !!config.token && isTokenValid(config.tokenExpiresAt);
  console.log('Token check:', {
    hasToken: !!config.token,
    expiresAt: config.tokenExpiresAt,
    isValid: isTokenValid(config.tokenExpiresAt),
    isConnected
  });

  // 套用移動設定
  petController.setMovementEnabled(config.petMovementEnabled);

  // 檢查是否顯示寵物
  const shouldShowPet = config.petVisible !== false && isConnected && config.lastPetState;

  if (shouldShowPet) {
    // 已連線且有寵物狀態且設定為顯示
    console.log('Showing pet with state:', config.lastPetState);
    petController.updateState(config.lastPetState!);
    petController.start();
    petContainer.classList.remove('hidden');
    // 顯示主視窗
    await mainWindow.show();
  } else {
    // 隱藏寵物和主視窗
    console.log('Hiding pet - visible:', config.petVisible, 'isConnected:', isConnected, 'lastPetState:', !!config.lastPetState);
    petContainer.classList.add('hidden');
    // 未登入或設定為隱藏時，不顯示主視窗
  }

  // 套用已儲存的視窗位置
  await applyInitialPosition();

  // 設定寵物點擊事件 - 打開設定視窗
  petElement.addEventListener('click', (e) => {
    e.stopPropagation();
    openSettingsWindow();
  });

  // 監聽視窗大小變更
  window.addEventListener('resize', () => {
    petController.setContainerWidth(window.innerWidth);
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
 * 套用初始視窗位置
 */
async function applyInitialPosition(): Promise<void> {
  const mainWindow = getCurrentWebviewWindow();
  const monitor = await currentMonitor();

  if (!monitor) {
    console.error('No monitor found');
    return;
  }

  const screenHeight = monitor.size.height;
  const scaleFactor = monitor.scaleFactor;
  const logicalScreenHeight = screenHeight / scaleFactor;

  // 如果有儲存的 Y 座標，使用它；否則使用預設（螢幕底部）
  let newY: number;
  if (config.petWindowY !== null && config.petWindowY > 0) {
    newY = config.petWindowY;
  } else {
    // 預設在螢幕底部
    newY = Math.round(logicalScreenHeight - WINDOW_HEIGHT);
  }

  // 確保不超出螢幕範圍
  newY = Math.max(0, Math.min(newY, logicalScreenHeight - WINDOW_HEIGHT));

  const currentPosition = await mainWindow.outerPosition();
  await mainWindow.setPosition(new LogicalPosition(currentPosition.x, newY));
  console.log('Initial window position set to y:', newY);
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
      title: '設定 - Discord Pet Overlay',
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
 * 設定事件監聯器
 */
async function setupEventListeners(): Promise<void> {
  const petContainer = document.getElementById('pet-container')!;

  // 監聯移動位置事件
  await listen<{ direction: 'up' | 'down'; step: number }>('move-position', async (event) => {
    console.log('Move position:', event.payload);
    await moveWindow(event.payload.direction, event.payload.step);
  });

  // 監聽重置位置事件
  await listen('reset-position', async () => {
    console.log('Reset position');
    await resetWindowPosition();
  });

  // 監聽寵物狀態更新（連線成功時）
  await listen<PetState>('pet-state-updated', async (event) => {
    console.log('Pet state updated, showing pet');
    isConnected = true;
    config.lastPetState = event.payload;
    await savePetState(event.payload);
    petController.updateState(event.payload);

    // 顯示寵物並開始動畫
    petContainer.classList.remove('hidden');
    petController.start();

    // 顯示主視窗（如果設定為顯示）
    if (config.petVisible !== false) {
      const mainWindow = getCurrentWebviewWindow();
      await mainWindow.show();
    }
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
    // 隱藏寵物
    petContainer.classList.add('hidden');
    petController.stop();
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
      if (isConnected && config.lastPetState) {
        petContainer.classList.remove('hidden');
        petController.start();
      }
    } else {
      await mainWindow.hide();
    }
  });

  // 監聽移動設定變更
  await listen<{ enabled: boolean }>('movement-changed', (event) => {
    console.log('Movement changed:', event.payload.enabled);
    config.petMovementEnabled = event.payload.enabled;
    petController.setMovementEnabled(event.payload.enabled);
  });
}

/**
 * 移動視窗位置
 */
async function moveWindow(direction: 'up' | 'down', step: number): Promise<void> {
  try {
    const mainWindow = getCurrentWebviewWindow();
    const monitor = await currentMonitor();

    if (!monitor) {
      console.error('No monitor found');
      return;
    }

    const screenHeight = monitor.size.height;
    const scaleFactor = monitor.scaleFactor;
    const logicalScreenHeight = screenHeight / scaleFactor;

    const currentPosition = await mainWindow.outerPosition();
    let newY = currentPosition.y;

    if (direction === 'up') {
      newY -= step;
    } else {
      newY += step;
    }

    // 確保不超出螢幕範圍
    newY = Math.max(0, Math.min(newY, logicalScreenHeight - WINDOW_HEIGHT));

    await mainWindow.setPosition(new LogicalPosition(currentPosition.x, newY));
    console.log(`Window moved ${direction} to y=${newY}`);

    // 儲存新位置
    config.petWindowY = newY;
    await savePetWindowY(newY);
  } catch (error) {
    console.error('Failed to move window:', error);
  }
}

/**
 * 重置視窗位置到螢幕底部
 */
async function resetWindowPosition(): Promise<void> {
  try {
    const mainWindow = getCurrentWebviewWindow();
    const monitor = await currentMonitor();

    if (!monitor) {
      console.error('No monitor found');
      return;
    }

    const screenHeight = monitor.size.height;
    const scaleFactor = monitor.scaleFactor;
    const logicalScreenHeight = screenHeight / scaleFactor;

    // 重置到螢幕底部
    const newY = Math.round(logicalScreenHeight - WINDOW_HEIGHT);

    const currentPosition = await mainWindow.outerPosition();
    await mainWindow.setPosition(new LogicalPosition(currentPosition.x, newY));
    console.log('Window position reset to bottom, y:', newY);

    // 儲存位置
    config.petWindowY = newY;
    await savePetWindowY(newY);
  } catch (error) {
    console.error('Failed to reset window position:', error);
  }
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
    const petState = await apiClient.getPetState();
    console.log('Poll successful, pet state:', petState);

    // 更新狀態
    config.lastPetState = petState;
    await savePetState(petState);
    petController.updateState(petState);

    // 確保寵物顯示（如果設定為顯示）
    if (config.petVisible !== false) {
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
