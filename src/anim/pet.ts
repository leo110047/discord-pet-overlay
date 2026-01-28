/**
 * 寵物動畫模組
 *
 * 負責控制寵物的移動、動畫和外觀
 */

import { PetStage, PetState } from '../types';

// 寵物素材 Base64 (簡易像素風格)
// egg: 藍色蛋形
const EGG_SPRITE = `data:image/svg+xml,${encodeURIComponent(`
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="32" cy="36" rx="20" ry="24" fill="#5865f2"/>
  <ellipse cx="32" cy="36" rx="16" ry="20" fill="#7289da"/>
  <ellipse cx="26" cy="28" rx="4" ry="6" fill="#ffffff" opacity="0.3"/>
</svg>
`)}`;

// teen: 小型寵物
const TEEN_SPRITE = `data:image/svg+xml,${encodeURIComponent(`
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <!-- 身體 -->
  <ellipse cx="32" cy="44" rx="18" ry="16" fill="#5865f2"/>
  <!-- 頭 -->
  <circle cx="32" cy="26" r="14" fill="#7289da"/>
  <!-- 眼睛 -->
  <circle cx="26" cy="24" r="4" fill="#ffffff"/>
  <circle cx="38" cy="24" r="4" fill="#ffffff"/>
  <circle cx="27" cy="25" r="2" fill="#2c2f33"/>
  <circle cx="39" cy="25" r="2" fill="#2c2f33"/>
  <!-- 嘴巴 -->
  <path d="M28 32 Q32 36 36 32" stroke="#2c2f33" stroke-width="2" fill="none"/>
  <!-- 腳 -->
  <ellipse cx="24" cy="56" rx="6" ry="4" fill="#4752c4"/>
  <ellipse cx="40" cy="56" rx="6" ry="4" fill="#4752c4"/>
</svg>
`)}`;

// adult: 完整寵物
const ADULT_SPRITE = `data:image/svg+xml,${encodeURIComponent(`
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <!-- 身體 -->
  <ellipse cx="32" cy="42" rx="22" ry="18" fill="#5865f2"/>
  <!-- 頭 -->
  <circle cx="32" cy="22" r="16" fill="#7289da"/>
  <!-- 耳朵 -->
  <ellipse cx="18" cy="10" rx="6" ry="10" fill="#7289da"/>
  <ellipse cx="46" cy="10" rx="6" ry="10" fill="#7289da"/>
  <ellipse cx="18" cy="10" rx="4" ry="7" fill="#5865f2"/>
  <ellipse cx="46" cy="10" rx="4" ry="7" fill="#5865f2"/>
  <!-- 眼睛 -->
  <circle cx="24" cy="20" r="5" fill="#ffffff"/>
  <circle cx="40" cy="20" r="5" fill="#ffffff"/>
  <circle cx="25" cy="21" r="3" fill="#2c2f33"/>
  <circle cx="41" cy="21" r="3" fill="#2c2f33"/>
  <circle cx="26" cy="20" r="1" fill="#ffffff"/>
  <circle cx="42" cy="20" r="1" fill="#ffffff"/>
  <!-- 鼻子 -->
  <ellipse cx="32" cy="28" rx="3" ry="2" fill="#4752c4"/>
  <!-- 嘴巴 -->
  <path d="M26 32 Q32 38 38 32" stroke="#2c2f33" stroke-width="2" fill="none"/>
  <!-- 腳 -->
  <ellipse cx="22" cy="58" rx="8" ry="5" fill="#4752c4"/>
  <ellipse cx="42" cy="58" rx="8" ry="5" fill="#4752c4"/>
  <!-- 尾巴 -->
  <ellipse cx="54" cy="45" rx="8" ry="6" fill="#7289da" transform="rotate(-30 54 45)"/>
</svg>
`)}`;

/**
 * 取得階段對應的素材
 */
function getSpriteForStage(stage: PetStage): string {
  switch (stage) {
    case 'egg':
      return EGG_SPRITE;
    case 'teen':
      return TEEN_SPRITE;
    case 'adult':
      return ADULT_SPRITE;
    default:
      return EGG_SPRITE;
  }
}

/**
 * 寵物控制器
 */
export class PetController {
  private element: HTMLElement;
  private containerWidth: number;
  private x: number;
  private direction: 1 | -1 = 1; // 1 = 右, -1 = 左
  private speed: number = 1;
  private scale: number = 1;
  private stage: PetStage = 'egg';
  private animationFrameId: number | null = null;
  private isPaused: boolean = false;
  private isMovementEnabled: boolean = true; // 是否啟用移動

  constructor(element: HTMLElement, containerWidth: number) {
    this.element = element;
    this.containerWidth = containerWidth;
    this.x = 50; // 初始位置
    this.updatePosition();
    this.updateSprite();
  }

  /**
   * 更新寵物狀態
   */
  updateState(state: PetState): void {
    this.scale = state.scale;
    this.stage = state.stage;
    this.updateSprite();
    this.updateScale();
  }

  /**
   * 更新素材
   */
  private updateSprite(): void {
    const sprite = getSpriteForStage(this.stage);
    this.element.style.backgroundImage = `url("${sprite}")`;
  }

  /**
   * 更新大小
   */
  private updateScale(): void {
    const baseSize = 64;
    const size = Math.round(baseSize * this.scale);
    this.element.style.width = `${size}px`;
    this.element.style.height = `${size}px`;
  }

  /**
   * 更新位置
   */
  private updatePosition(): void {
    this.element.style.left = `${this.x}px`;
  }

  /**
   * 更新方向
   */
  private updateDirection(): void {
    if (this.direction === -1) {
      this.element.classList.add('facing-left');
    } else {
      this.element.classList.remove('facing-left');
    }
  }

  /**
   * 開始動畫循環
   */
  start(): void {
    if (this.animationFrameId !== null) return;

    this.element.classList.add('walking');
    this.animate();
  }

  /**
   * 停止動畫循環
   */
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.element.classList.remove('walking');
  }

  /**
   * 暫停/繼續
   */
  togglePause(): void {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.element.classList.remove('walking');
    } else {
      this.element.classList.add('walking');
    }
  }

  /**
   * 設定容器寬度
   */
  setContainerWidth(width: number): void {
    this.containerWidth = width;
  }

  /**
   * 設定是否啟用移動
   */
  setMovementEnabled(enabled: boolean): void {
    this.isMovementEnabled = enabled;
    if (!enabled) {
      this.element.classList.remove('walking');
    } else if (!this.isPaused && this.animationFrameId !== null) {
      this.element.classList.add('walking');
    }
  }

  /**
   * 取得是否啟用移動
   */
  isMovementEnabledState(): boolean {
    return this.isMovementEnabled;
  }

  /**
   * 動畫主循環
   */
  private animate = (): void => {
    if (!this.isPaused && this.isMovementEnabled) {
      // 移動
      this.x += this.speed * this.direction;

      // 邊界檢測與反彈
      const petWidth = this.element.offsetWidth;
      if (this.x <= 10) {
        this.x = 10;
        this.direction = 1;
        this.updateDirection();
      } else if (this.x >= this.containerWidth - petWidth - 10) {
        this.x = this.containerWidth - petWidth - 10;
        this.direction = -1;
        this.updateDirection();
      }

      this.updatePosition();
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  /**
   * 設定位置
   */
  setPosition(x: number): void {
    this.x = x;
    this.updatePosition();
  }

  /**
   * 取得位置
   */
  getPosition(): number {
    return this.x;
  }

  /**
   * 銷毀
   */
  destroy(): void {
    this.stop();
  }
}

/**
 * 建立寵物控制器
 */
export function createPetController(
  element: HTMLElement,
  containerWidth: number
): PetController {
  return new PetController(element, containerWidth);
}
