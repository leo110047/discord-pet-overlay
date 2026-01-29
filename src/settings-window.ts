/**
 * 設定視窗 - 獨立的原生視窗
 */

import { emitTo } from '@tauri-apps/api/event';
import { getVersion } from '@tauri-apps/api/app';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { createApiClient, ApiError } from './api';
import {
  loadConfig,
  saveToken,
  clearToken,
  saveAllPets,
  saveSelectedPetIds,
  savePetMovementEnabled,
  savePetVisible,
  isTokenValid,
  getSpriteUrl,
} from './store';
import { AppConfig, ConnectionStatus, PetState, DEFAULT_CONFIG } from './types';

// 全域狀態
let config: AppConfig;
const apiClient = createApiClient(DEFAULT_CONFIG.serverUrl);

// DOM 元素
let elements: {
  connectionStatus: HTMLElement | null;
  statusText: HTMLElement | null;
  discordIdInput: HTMLInputElement | null;
  requestCodeBtn: HTMLButtonElement | null;
  pairCodeInput: HTMLInputElement | null;
  linkBtn: HTMLButtonElement | null;
  pairingSection: HTMLElement | null;
  connectedSection: HTMLElement | null;
  petSelector: HTMLElement | null;
  petList: HTMLElement | null;
  errorMessage: HTMLElement | null;
  visibilityToggle: HTMLInputElement | null;
  movementToggle: HTMLInputElement | null;
  logoutBtn: HTMLButtonElement | null;
  checkUpdateBtn: HTMLButtonElement | null;
  resetPositionBtn: HTMLButtonElement | null;
  appVersion: HTMLElement | null;
};

/**
 * 初始化設定視窗
 */
async function init(): Promise<void> {
  console.log('Initializing settings window...');

  // 取得 DOM 元素
  const connectionStatus = document.getElementById('connection-status');
  elements = {
    connectionStatus,
    statusText: connectionStatus?.querySelector('.status-text') as HTMLElement,
    discordIdInput: document.getElementById('discord-id') as HTMLInputElement,
    requestCodeBtn: document.getElementById('request-code-btn') as HTMLButtonElement,
    pairCodeInput: document.getElementById('pair-code') as HTMLInputElement,
    linkBtn: document.getElementById('link-btn') as HTMLButtonElement,
    pairingSection: document.getElementById('pairing-section'),
    connectedSection: document.getElementById('connected-section'),
    petSelector: document.getElementById('pet-selector'),
    petList: document.getElementById('pet-list'),
    errorMessage: document.getElementById('error-message'),
    visibilityToggle: document.getElementById('visibility-toggle') as HTMLInputElement,
    movementToggle: document.getElementById('movement-toggle') as HTMLInputElement,
    logoutBtn: document.getElementById('logout-btn') as HTMLButtonElement,
    checkUpdateBtn: document.getElementById('check-update-btn') as HTMLButtonElement,
    resetPositionBtn: document.getElementById('reset-position-btn') as HTMLButtonElement,
    appVersion: document.getElementById('app-version'),
  };

  // 載入設定
  config = await loadConfig();

  // 設定開關狀態
  if (elements.visibilityToggle) {
    elements.visibilityToggle.checked = config.petVisible !== false; // 預設為 true
  }
  if (elements.movementToggle) {
    elements.movementToggle.checked = config.petMovementEnabled;
  }
  console.log('Config loaded:', { ...config, token: config.token ? '[REDACTED]' : null });

  // 設定伺服器 URL
  apiClient.setBaseUrl(config.serverUrl);
  console.log('API client base URL set to:', config.serverUrl);

  if (config.token) {
    apiClient.setToken(config.token);
  }

  // 根據連線狀態顯示不同區塊
  const isLoggedIn = !!config.token && isTokenValid(config.tokenExpiresAt);
  updateUIForLoginState(isLoggedIn);

  // 更新連線狀態並嘗試連線
  if (isLoggedIn) {
    await tryConnect();
  } else {
    setConnectionStatus('disconnected');
  }

  // 設定事件監聽器
  setupEventListeners();

  // 顯示應用程式版本
  try {
    const version = await getVersion();
    if (elements.appVersion) {
      elements.appVersion.textContent = `v${version}`;
    }
  } catch (error) {
    console.error('Failed to get app version:', error);
  }

  console.log('Settings window initialized');
}

/**
 * 根據登入狀態更新 UI
 */
function updateUIForLoginState(isLoggedIn: boolean): void {
  if (elements.pairingSection) {
    elements.pairingSection.classList.toggle('hidden', isLoggedIn);
  }
  if (elements.connectedSection) {
    elements.connectedSection.classList.toggle('hidden', !isLoggedIn);
  }
}

/**
 * 設定事件監聯器
 */
function setupEventListeners(): void {
  console.log('Setting up event listeners');

  // Discord ID 輸入 - 只允許數字
  elements.discordIdInput?.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    input.value = input.value.replace(/\D/g, '');
  });

  // 發送配對碼按鈕
  elements.requestCodeBtn?.addEventListener('click', async () => {
    console.log('Request code button clicked');
    const discordId = elements.discordIdInput!.value.trim();
    console.log('Discord ID:', discordId);

    if (!discordId || discordId.length < 17) {
      showError('請輸入有效的 Discord ID（17-20 位數字）');
      return;
    }

    hideError();
    setRequestCodeButtonLoading(true);

    try {
      console.log('Calling requestPairCode with:', discordId);
      await apiClient.requestPairCode(discordId);
      console.log('Request successful');
      showSuccess('配對碼已發送到你的 Discord 私訊！');
    } catch (error) {
      console.error('Request failed:', error);
      if (error instanceof ApiError) {
        switch (error.code) {
          case 'INVALID_DISCORD_ID':
            showError('Discord ID 格式不正確');
            break;
          case 'COOLDOWN_ACTIVE':
            showError('請稍後再試（冷卻中）');
            break;
          case 'CANNOT_DM_USER':
            showError('無法發送私訊，請確認已開啟「允許伺服器成員私訊」');
            break;
          case 'USER_NOT_FOUND':
            showError('找不到此 Discord 用戶');
            break;
          case 'BOT_NOT_AVAILABLE':
            showError('Bot 目前無法使用，請稍後再試');
            break;
          case 'NETWORK_ERROR':
            showError('無法連線到伺服器，請稍後再試');
            break;
          default:
            showError(`錯誤: ${error.code} - ${error.message}`);
        }
      } else {
        console.error('Unknown error:', error);
        showError(`發生未知錯誤: ${String(error)}`);
      }
    } finally {
      setRequestCodeButtonLoading(false);
    }
  });

  // 配對碼輸入 - 只允許數字
  elements.pairCodeInput?.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    input.value = input.value.replace(/\D/g, '').slice(0, 6);
  });

  // 連結按鈕
  elements.linkBtn?.addEventListener('click', async () => {
    const pairCode = elements.pairCodeInput!.value.trim();

    if (pairCode.length !== 6) {
      showError('請輸入 6 位數配對碼');
      return;
    }

    hideError();
    setLinkButtonLoading(true);

    try {
      await performLink(pairCode);
      elements.pairCodeInput!.value = '';
    } catch {
      // 錯誤已處理
    } finally {
      setLinkButtonLoading(false);
    }
  });

  // 顯示/隱藏寵物開關
  elements.visibilityToggle?.addEventListener('change', async (e) => {
    const visible = (e.target as HTMLInputElement).checked;
    console.log('Visibility toggle changed:', visible);
    config.petVisible = visible;
    await savePetVisible(visible);
    await emitTo('main', 'visibility-changed', { visible });
  });

  // 移動開關
  elements.movementToggle?.addEventListener('change', async (e) => {
    const enabled = (e.target as HTMLInputElement).checked;
    console.log('Movement toggle changed:', enabled);
    config.petMovementEnabled = enabled;
    await savePetMovementEnabled(enabled);
    await emitTo('main', 'movement-changed', { enabled });
  });

  // 登出按鈕
  elements.logoutBtn?.addEventListener('click', async () => {
    console.log('Logout button clicked');
    const confirmed = await ask('確定要登出嗎？你需要重新配對才能使用。', {
      title: '登出確認',
      kind: 'warning',
    });
    console.log('Logout confirmed:', confirmed);
    if (confirmed) {
      await clearToken();
      config.token = null;
      config.userId = null;
      config.tokenExpiresAt = null;
      config.allPets = [];
      config.selectedPetIds = [];
      apiClient.setToken('');
      setConnectionStatus('disconnected');
      updateUIForLoginState(false);
      hideError();
      hidePetSelector();
      // 通知主視窗已登出
      await emitTo('main', 'logged-out', {});
    }
  });

  // 檢查更新按鈕
  elements.checkUpdateBtn?.addEventListener('click', async () => {
    console.log('Check update button clicked');
    await checkForUpdates();
  });

  // 重置視窗位置按鈕
  elements.resetPositionBtn?.addEventListener('click', async () => {
    console.log('Reset position button clicked');
    await resetWindowPosition();
  });
}

/**
 * 執行配對流程
 */
async function performLink(pairCode: string): Promise<void> {
  setConnectionStatus('connecting');

  try {
    const result = await apiClient.linkComplete(pairCode);

    // 儲存 Token
    config.token = result.token;
    config.userId = result.userId;
    config.tokenExpiresAt = result.expiresAt;

    await saveToken(result.token, result.userId, result.expiresAt);
    apiClient.setToken(result.token);

    console.log('Link successful, userId:', result.userId);

    // 更新 UI
    updateUIForLoginState(true);

    // 連線成功
    await tryConnect();

    // 通知主視窗已連線
    await emitTo('main', 'linked', { token: result.token, userId: result.userId });
  } catch (error) {
    setConnectionStatus('disconnected');

    if (error instanceof ApiError) {
      switch (error.code) {
        case 'CODE_NOT_FOUND':
          showError('配對碼無效');
          break;
        case 'CODE_EXPIRED':
          showError('配對碼已過期，請重新取得');
          break;
        case 'CODE_ALREADY_USED':
          showError('配對碼已使用過');
          break;
        case 'TOO_MANY_ATTEMPTS':
          showError('嘗試次數過多，請重新取得配對碼');
          break;
        case 'NETWORK_ERROR':
          showError('無法連線到伺服器');
          break;
        default:
          showError(error.message);
      }
    } else {
      showError('發生未知錯誤');
    }

    throw error;
  }
}

/**
 * 嘗試連線並取得寵物狀態
 */
async function tryConnect(): Promise<void> {
  setConnectionStatus('connecting');

  try {
    const pets = await apiClient.getPets();
    console.log('Got pets:', pets.length);

    // 更新設定中的寵物列表
    config.allPets = pets;
    await saveAllPets(pets);

    // 顯示寵物選擇器
    renderPetList(pets);

    setConnectionStatus('connected');

    // 通知主視窗更新寵物列表
    await emitTo('main', 'pets-updated', pets);
  } catch (error) {
    console.error('Failed to connect:', error);

    if (error instanceof ApiError) {
      if (error.code === 'INVALID_TOKEN' || error.code === 'MISSING_TOKEN') {
        await clearToken();
        config.token = null;
        config.tokenExpiresAt = null;
        showError('認證已過期，請重新配對');
        updateUIForLoginState(false);
      } else if (error.code === 'NETWORK_ERROR') {
        showError('無法連線到伺服器，請確認後端服務已啟動');
        // 網路錯誤時也顯示配對區塊，讓用戶可以重新連線
        updateUIForLoginState(false);
      }
    } else {
      showError('連線失敗');
      updateUIForLoginState(false);
    }

    setConnectionStatus('disconnected');
  }
}

/**
 * 設定連線狀態
 */
function setConnectionStatus(status: ConnectionStatus): void {
  if (!elements.connectionStatus || !elements.statusText) return;

  elements.connectionStatus.classList.remove('connected', 'disconnected', 'connecting');
  elements.connectionStatus.classList.add(status);

  switch (status) {
    case 'connected':
      elements.statusText.textContent = '已連線';
      break;
    case 'connecting':
      elements.statusText.textContent = '連線中...';
      break;
    case 'disconnected':
      elements.statusText.textContent = '未連線';
      break;
  }
}

/**
 * 渲染寵物列表
 */
async function renderPetList(pets: PetState[]): Promise<void> {
  if (!elements.petList || !elements.petSelector) return;

  if (pets.length === 0) {
    elements.petList.innerHTML = '<div class="pet-list-empty">尚無寵物</div>';
    elements.petSelector.classList.add('hidden');
    return;
  }

  elements.petSelector.classList.remove('hidden');

  // 決定哪些寵物被選中
  const selectedIds = config.selectedPetIds.length > 0
    ? config.selectedPetIds
    : pets.filter(p => p.isActive).map(p => p.odangoId);

  // 先渲染 HTML 結構（沒有 sprite）
  elements.petList.innerHTML = pets.map(pet => {
    const isSelected = selectedIds.includes(pet.odangoId);
    const stageText = getStageText(pet.stage);

    return `
      <div class="pet-item ${isSelected ? 'selected' : ''}" data-pet-id="${pet.odangoId}" data-sprite-path="${pet.spritePath}">
        <input type="checkbox" class="pet-item-checkbox" ${isSelected ? 'checked' : ''} />
        <div class="pet-item-sprite loading"></div>
        <div class="pet-item-info">
          <div class="pet-item-name">${pet.species}</div>
          <div class="pet-item-details">${stageText} · ${pet.scale.toFixed(2)}x</div>
        </div>
        ${pet.isActive ? '<span class="pet-item-badge active">使用中</span>' : ''}
      </div>
    `;
  }).join('');

  // 綁定點擊事件
  const petItems = elements.petList.querySelectorAll('.pet-item');
  petItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const checkbox = item.querySelector('.pet-item-checkbox') as HTMLInputElement;

      // 如果點擊的不是 checkbox 本身，則切換 checkbox
      if ((e.target as HTMLElement).className !== 'pet-item-checkbox') {
        checkbox.checked = !checkbox.checked;
      }

      item.classList.toggle('selected', checkbox.checked);

      // 更新選擇的寵物
      updateSelectedPets();
    });
  });

  // 非同步載入 sprite 圖片
  const serverUrl = config.serverUrl || DEFAULT_CONFIG.serverUrl;
  petItems.forEach(async (item) => {
    const spritePath = (item as HTMLElement).dataset.spritePath;
    const spriteEl = item.querySelector('.pet-item-sprite') as HTMLElement;

    if (spritePath && spriteEl) {
      try {
        const spriteUrl = await getSpriteUrl(serverUrl, spritePath);
        if (spriteUrl) {
          spriteEl.style.backgroundImage = `url('${spriteUrl}')`;
        }
        spriteEl.classList.remove('loading');
      } catch (error) {
        console.error('Failed to load sprite:', spritePath, error);
        spriteEl.classList.remove('loading');
        spriteEl.classList.add('error');
      }
    }
  });
}

/**
 * 取得階段文字
 */
function getStageText(stage: string): string {
  const stageNames: Record<string, string> = {
    egg: '蛋',
    stage1: '階段 1',
    stage2: '階段 2',
    stage3: '階段 3',
  };
  return stageNames[stage] || stage;
}

/**
 * 更新選擇的寵物
 */
async function updateSelectedPets(): Promise<void> {
  if (!elements.petList) return;

  const checkboxes = elements.petList.querySelectorAll('.pet-item-checkbox:checked');
  const selectedIds = Array.from(checkboxes).map(cb => {
    const item = (cb as HTMLElement).closest('.pet-item') as HTMLElement;
    return item.dataset.petId!;
  });

  console.log('Selected pets:', selectedIds);

  config.selectedPetIds = selectedIds;
  await saveSelectedPetIds(selectedIds);

  // 通知主視窗
  await emitTo('main', 'selected-pets-changed', selectedIds);
}

/**
 * 隱藏寵物選擇器
 */
function hidePetSelector(): void {
  elements.petSelector?.classList.add('hidden');
  if (elements.petList) {
    elements.petList.innerHTML = '';
  }
}

/**
 * 顯示錯誤訊息
 */
function showError(message: string): void {
  if (elements.errorMessage) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.remove('hidden');
  }
}

/**
 * 隱藏錯誤訊息
 */
function hideError(): void {
  elements.errorMessage?.classList.add('hidden');
}

/**
 * 設定連結按鈕載入狀態
 */
function setLinkButtonLoading(loading: boolean): void {
  if (elements.linkBtn) {
    elements.linkBtn.disabled = loading;
    elements.linkBtn.textContent = loading ? '連線中...' : '連結';
  }
}

/**
 * 設定發送配對碼按鈕載入狀態
 */
function setRequestCodeButtonLoading(loading: boolean): void {
  if (elements.requestCodeBtn) {
    elements.requestCodeBtn.disabled = loading;
    elements.requestCodeBtn.textContent = loading ? '發送中...' : '發送配對碼';
  }
}

/**
 * 顯示成功訊息
 */
function showSuccess(message: string): void {
  if (elements.errorMessage) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.remove('hidden');
    elements.errorMessage.style.background = 'rgba(35, 134, 54, 0.15)';
    elements.errorMessage.style.borderColor = 'rgba(35, 134, 54, 0.3)';
    elements.errorMessage.style.color = '#3ba55d';

    // 5 秒後自動隱藏
    setTimeout(() => {
      hideError();
      // 恢復錯誤樣式
      if (elements.errorMessage) {
        elements.errorMessage.style.background = '';
        elements.errorMessage.style.borderColor = '';
        elements.errorMessage.style.color = '';
      }
    }, 5000);
  }
}

/**
 * 檢查更新
 */
async function checkForUpdates(): Promise<void> {
  if (!elements.checkUpdateBtn) return;

  const originalText = elements.checkUpdateBtn.textContent;
  elements.checkUpdateBtn.disabled = true;
  elements.checkUpdateBtn.textContent = '檢查中...';

  try {
    const update = await check();

    if (update) {
      console.log('Update available:', update.version);

      const confirmed = await ask(
        `發現新版本 v${update.version}！\n\n更新內容：\n${update.body || '無說明'}\n\n是否立即下載並安裝？`,
        {
          title: '發現更新',
          kind: 'info',
          okLabel: '更新',
          cancelLabel: '稍後',
        }
      );

      if (confirmed) {
        elements.checkUpdateBtn.textContent = '下載中...';

        // 下載並安裝更新
        let contentLength = 0;
        let downloaded = 0;
        await update.downloadAndInstall((event) => {
          if (event.event === 'Started') {
            contentLength = (event.data as { contentLength?: number }).contentLength || 0;
            console.log(`Download started, size: ${contentLength}`);
          } else if (event.event === 'Progress') {
            downloaded += (event.data as { chunkLength: number }).chunkLength;
            if (contentLength > 0) {
              const percent = Math.round((downloaded / contentLength) * 100);
              elements.checkUpdateBtn!.textContent = `下載中... ${percent}%`;
            }
          } else if (event.event === 'Finished') {
            console.log('Download finished');
          }
        });

        // 詢問是否重新啟動
        const restartConfirmed = await ask('更新已下載完成，是否立即重新啟動？', {
          title: '更新完成',
          kind: 'info',
          okLabel: '重新啟動',
          cancelLabel: '稍後',
        });

        if (restartConfirmed) {
          await relaunch();
        }
      }
    } else {
      console.log('No update available');
      await message('目前已是最新版本！', {
        title: '檢查更新',
        kind: 'info',
      });
    }
  } catch (error) {
    console.error('Failed to check for updates:', error);
    await message(`檢查更新失敗：${String(error)}`, {
      title: '錯誤',
      kind: 'error',
    });
  } finally {
    elements.checkUpdateBtn!.disabled = false;
    elements.checkUpdateBtn!.textContent = originalText;
  }
}

/**
 * 重置視窗位置到螢幕底部
 */
async function resetWindowPosition(): Promise<void> {
  try {
    console.log('=== resetWindowPosition called ===');

    // 直接取得並控制主視窗
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const { currentMonitor, LogicalPosition, LogicalSize } = await import('@tauri-apps/api/window');

    const mainWindow = await WebviewWindow.getByLabel('main');
    if (!mainWindow) {
      console.error('Main window not found!');
      await message('找不到主視窗', { title: '錯誤', kind: 'error' });
      return;
    }

    const monitor = await currentMonitor();
    if (!monitor) {
      console.error('No monitor found!');
      await message('找不到顯示器', { title: '錯誤', kind: 'error' });
      return;
    }

    const scaleFactor = monitor.scaleFactor;
    const screenWidth = Math.round(monitor.size.width / scaleFactor);
    const screenHeight = Math.round(monitor.size.height / scaleFactor);
    const windowHeight = 200;
    const newY = screenHeight - windowHeight;

    console.log('Screen:', screenWidth, 'x', screenHeight);
    console.log('New position: x=0, y=', newY);

    // 重置視窗
    await mainWindow.setSize(new LogicalSize(screenWidth, windowHeight));
    await mainWindow.setPosition(new LogicalPosition(0, newY));
    await mainWindow.show();
    await mainWindow.setFocus();

    // 通知主視窗更新設定
    await emitTo('main', 'reset-position', {});

    await message('視窗位置已重置！', {
      title: '重置成功',
      kind: 'info',
    });
  } catch (error) {
    console.error('Failed to reset window position:', error);
    await message(`重置失敗：${String(error)}`, {
      title: '錯誤',
      kind: 'error',
    });
  }
}

// 啟動設定視窗
document.addEventListener('DOMContentLoaded', init);
