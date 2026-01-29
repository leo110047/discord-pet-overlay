/**
 * 互動模式管理
 * 處理熱鍵切換、視窗穿透、邊框顯示、拖曳和縮放
 */

import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { currentMonitor, LogicalPosition, LogicalSize } from '@tauri-apps/api/window';

// 熱鍵設定
const HOTKEY = 'CommandOrControl+O';
const HOLD_DURATION_MS = 500;

// 互動模式狀態
let isInteractionMode = false;
let hotkeyPressedAt: number | null = null;
let holdCheckTimer: ReturnType<typeof setTimeout> | null = null;

// UI 元素
let borderOverlay: HTMLElement | null = null;
let resizeHandles: HTMLElement[] = [];

// 視窗資訊
let windowWidth: number = 0;
let windowHeight: number = 200;

// 拖曳狀態
let isDragging = false;
let isResizing = false;
let resizeDirection: 'left' | 'right' | null = null;
let dragStartX = 0;
let dragStartY = 0;
let windowStartX = 0;
let windowStartY = 0;
let windowStartWidth = 0;

// 回調函數
let onWindowConfigChange: ((x: number, y: number, width: number) => Promise<void>) | null = null;

/**
 * 初始化互動模式
 */
export async function initInteractionMode(
  initialWidth: number,
  height: number,
  configChangeCallback: (x: number, y: number, width: number) => Promise<void>
): Promise<void> {
  windowWidth = initialWidth;
  windowHeight = height;
  onWindowConfigChange = configChangeCallback;

  // 建立 UI 元素
  createBorderOverlay();
  createResizeHandles();

  // 註冊熱鍵
  await registerHotkey();

  // 預設啟用穿透模式
  await setIgnoreCursorEvents(true);

  console.log('Interaction mode initialized');
}

/**
 * 註冊全域熱鍵
 */
async function registerHotkey(): Promise<void> {
  try {
    const alreadyRegistered = await isRegistered(HOTKEY);
    if (alreadyRegistered) {
      await unregister(HOTKEY);
    }

    await register(HOTKEY, async (event) => {
      if (event.state === 'Pressed') {
        onHotkeyPressed();
      } else if (event.state === 'Released') {
        onHotkeyReleased();
      }
    });

    console.log(`Hotkey ${HOTKEY} registered`);
  } catch (error) {
    console.error('Failed to register hotkey:', error);
  }
}

/**
 * 熱鍵按下
 */
function onHotkeyPressed(): void {
  console.log('=== Hotkey PRESSED ===');
  if (hotkeyPressedAt !== null) return; // 避免重複觸發

  hotkeyPressedAt = Date.now();

  // 設定計時器檢查是否按住足夠久
  holdCheckTimer = setTimeout(() => {
    console.log('=== Hold timer fired, toggling interaction mode ===');
    if (hotkeyPressedAt !== null) {
      toggleInteractionMode();
    }
  }, HOLD_DURATION_MS);
}

/**
 * 熱鍵放開
 */
function onHotkeyReleased(): void {
  // 清除計時器
  if (holdCheckTimer) {
    clearTimeout(holdCheckTimer);
    holdCheckTimer = null;
  }
  hotkeyPressedAt = null;
}

/**
 * 切換互動模式
 */
async function toggleInteractionMode(): Promise<void> {
  isInteractionMode = !isInteractionMode;
  console.log('Interaction mode:', isInteractionMode ? 'ON' : 'OFF');

  if (isInteractionMode) {
    await enterInteractionMode();
  } else {
    await exitInteractionMode();
  }
}

/**
 * 進入互動模式
 */
async function enterInteractionMode(): Promise<void> {
  console.log('=== Entering interaction mode ===');
  const mainWindow = getCurrentWebviewWindow();

  // 確保視窗顯示
  console.log('Showing main window...');
  await mainWindow.show();

  // 關閉穿透
  console.log('Disabling ignore cursor events...');
  await setIgnoreCursorEvents(false);

  // 顯示邊框和 resize handles
  console.log('borderOverlay exists:', !!borderOverlay);
  if (borderOverlay) {
    borderOverlay.classList.add('visible');
    console.log('Border overlay visible class added');
  }
  resizeHandles.forEach(handle => handle.classList.add('visible'));
  console.log('Resize handles visible:', resizeHandles.length);

  // 綁定拖曳事件
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  console.log('=== Interaction mode ACTIVE ===');
}

/**
 * 退出互動模式
 */
async function exitInteractionMode(): Promise<void> {
  // 啟用穿透
  await setIgnoreCursorEvents(true);

  // 隱藏邊框和 resize handles
  if (borderOverlay) {
    borderOverlay.classList.remove('visible');
  }
  resizeHandles.forEach(handle => handle.classList.remove('visible'));

  // 移除拖曳事件
  document.removeEventListener('mousedown', onMouseDown);
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);

  // 重置拖曳狀態
  isDragging = false;
  isResizing = false;
}

/**
 * 設定視窗穿透
 */
async function setIgnoreCursorEvents(ignore: boolean): Promise<void> {
  try {
    const mainWindow = getCurrentWebviewWindow();
    await mainWindow.setIgnoreCursorEvents(ignore);
  } catch (error) {
    console.error('Failed to set ignore cursor events:', error);
  }
}

/**
 * 建立邊框 overlay
 */
function createBorderOverlay(): void {
  borderOverlay = document.createElement('div');
  borderOverlay.id = 'interaction-border';
  borderOverlay.className = 'interaction-border';
  document.body.appendChild(borderOverlay);
}

/**
 * 建立 resize handles
 */
function createResizeHandles(): void {
  const positions = ['left', 'right'] as const;

  positions.forEach(pos => {
    const handle = document.createElement('div');
    handle.className = `resize-handle resize-handle-${pos}`;
    handle.dataset.direction = pos;
    document.body.appendChild(handle);
    resizeHandles.push(handle);
  });
}

/**
 * 滑鼠按下事件
 */
async function onMouseDown(e: MouseEvent): Promise<void> {
  const target = e.target as HTMLElement;

  // 檢查是否點擊 resize handle
  if (target.classList.contains('resize-handle')) {
    // 先取得目前視窗位置，用於左側 resize 時調整位置
    const pos = await getCurrentWindowPosition();
    windowStartX = pos.x;
    windowStartY = pos.y;

    isResizing = true;
    resizeDirection = target.dataset.direction as 'left' | 'right';
    dragStartX = e.screenX;
    windowStartWidth = windowWidth;
    e.preventDefault();
    return;
  }

  // 檢查是否點擊邊框區域（用於拖曳）
  if (target.id === 'interaction-border' || target === document.body) {
    // 先取得目前視窗位置，再啟用拖曳（避免異步問題）
    const pos = await getCurrentWindowPosition();
    windowStartX = pos.x;
    windowStartY = pos.y;

    isDragging = true;
    dragStartX = e.screenX;
    dragStartY = e.screenY;

    e.preventDefault();
  }
}

/**
 * 滑鼠移動事件
 */
async function onMouseMove(e: MouseEvent): Promise<void> {
  if (isDragging) {
    const deltaX = e.screenX - dragStartX;
    const deltaY = e.screenY - dragStartY;

    const newX = windowStartX + deltaX;
    const newY = windowStartY + deltaY;

    // 加入邊界檢查，確保視窗不會完全移出螢幕
    const monitor = await currentMonitor();
    if (monitor) {
      const scaleFactor = monitor.scaleFactor;
      const screenWidth = monitor.size.width / scaleFactor;
      const screenHeight = monitor.size.height / scaleFactor;

      // 確保至少有 100px 在螢幕內
      const clampedX = Math.max(-windowWidth + 100, Math.min(screenWidth - 100, newX));
      const clampedY = Math.max(0, Math.min(screenHeight - 50, newY));

      await setWindowPosition(clampedX, clampedY);
    } else {
      await setWindowPosition(newX, newY);
    }
  } else if (isResizing && resizeDirection) {
    const deltaX = e.screenX - dragStartX;

    let newWidth = windowStartWidth;
    let newX = windowStartX;

    if (resizeDirection === 'right') {
      newWidth = windowStartWidth + deltaX;
    } else if (resizeDirection === 'left') {
      newWidth = windowStartWidth - deltaX;
      newX = windowStartX + deltaX;
    }

    // 限制最小寬度
    newWidth = Math.max(400, newWidth);

    // 如果達到最小寬度，停止調整 X 位置
    if (resizeDirection === 'left' && newWidth === 400) {
      newX = windowStartX + (windowStartWidth - 400);
    }

    await setWindowWidthAndPosition(newWidth, newX, windowStartY);
  }
}

/**
 * 滑鼠放開事件
 */
async function onMouseUp(): Promise<void> {
  if (isDragging || isResizing) {
    isDragging = false;
    isResizing = false;
    resizeDirection = null;

    // 儲存新的視窗設定
    if (onWindowConfigChange) {
      const pos = await getCurrentWindowPosition();
      await onWindowConfigChange(pos.x, pos.y, windowWidth);
    }
  }
}

/**
 * 取得目前視窗位置
 */
async function getCurrentWindowPosition(): Promise<{ x: number; y: number }> {
  const mainWindow = getCurrentWebviewWindow();
  const monitor = await currentMonitor();
  const scaleFactor = monitor?.scaleFactor || 1;
  const pos = await mainWindow.outerPosition();

  return {
    x: pos.x / scaleFactor,
    y: pos.y / scaleFactor
  };
}

/**
 * 設定視窗位置
 */
async function setWindowPosition(x: number, y: number): Promise<void> {
  const mainWindow = getCurrentWebviewWindow();
  await mainWindow.setPosition(new LogicalPosition(x, y));
}

/**
 * 同時設定視窗寬度和位置（用於左側 resize）
 */
async function setWindowWidthAndPosition(width: number, x: number, y: number): Promise<void> {
  const mainWindow = getCurrentWebviewWindow();

  windowWidth = width;
  await mainWindow.setPosition(new LogicalPosition(x, y));
  await mainWindow.setSize(new LogicalSize(width, windowHeight));
}

/**
 * 更新視窗寬度（外部呼叫）
 */
export function updateWindowWidth(width: number): void {
  windowWidth = width;
}

/**
 * 取得目前是否在互動模式
 */
export function isInInteractionMode(): boolean {
  return isInteractionMode;
}

/**
 * 清理資源
 */
export async function cleanupInteractionMode(): Promise<void> {
  try {
    await unregister(HOTKEY);
  } catch (error) {
    console.error('Failed to unregister hotkey:', error);
  }

  if (borderOverlay) {
    borderOverlay.remove();
  }
  resizeHandles.forEach(handle => handle.remove());
}
