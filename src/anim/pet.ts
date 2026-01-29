/**
 * 寵物動畫模組
 *
 * 負責控制寵物的移動、動畫和外觀
 * 支援多隻寵物同時顯示
 */

import { PetState } from '../types';
import { getSpriteUrl as fetchSpriteUrl } from '../store/spriteCache';

/** API 伺服器 URL（由外部設定） */
let apiBaseUrl: string = '';

/**
 * 設定 API 伺服器 URL
 */
export function setApiBaseUrl(url: string): void {
  apiBaseUrl = url.replace(/\/$/, '');
}

/**
 * 取得 Sprite 完整 URL
 * 優先從快取取得，沒有則從 API 下載
 */
async function getSpriteUrl(spritePath: string): Promise<string> {
  if (!apiBaseUrl) {
    console.warn('API base URL not set, cannot load sprite');
    return '';
  }
  return fetchSpriteUrl(apiBaseUrl, spritePath);
}

/**
 * 單一寵物控制器
 */
export class PetController {
  private element: HTMLElement;
  private containerWidth: number;
  private x: number;
  private direction: 1 | -1 = 1; // 1 = 右, -1 = 左
  private speed: number = 1;
  private scale: number = 1;
  private animationFrameId: number | null = null;
  private isPaused: boolean = false;
  private isMovementEnabled: boolean = true;
  private petId: string = '';
  private spritePath: string = '';

  constructor(element: HTMLElement, containerWidth: number, initialX?: number) {
    this.element = element;
    this.containerWidth = containerWidth;
    this.x = initialX ?? Math.random() * (containerWidth - 100) + 50;
    this.direction = Math.random() > 0.5 ? 1 : -1;
    this.updatePosition();
    this.updateDirection();
  }

  /**
   * 取得寵物 ID
   */
  getPetId(): string {
    return this.petId;
  }

  /**
   * 更新寵物狀態
   */
  updateState(state: PetState): void {
    this.petId = state.odangoId;
    this.scale = state.scale;
    this.spritePath = state.spritePath;
    this.updateSprite();
    this.updateScale();
  }

  /**
   * 更新素材
   */
  private updateSprite(): void {
    if (this.spritePath) {
      // 先設定 fallback 背景色，確保視窗可見
      this.element.style.backgroundColor = '#7c3aed';
      this.element.style.borderRadius = '50%';

      // 非同步載入 sprite
      getSpriteUrl(this.spritePath).then(spriteUrl => {
        if (spriteUrl) {
          this.element.style.backgroundImage = `url("${spriteUrl}")`;
          this.element.style.backgroundColor = 'transparent';
        }
      }).catch(err => {
        console.error('Failed to load sprite:', err);
      });
    }
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
   * 取得 DOM 元素
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * 銷毀
   */
  destroy(): void {
    this.stop();
    this.element.remove();
  }
}

/**
 * 多寵物管理器
 */
export class MultiPetManager {
  private container: HTMLElement;
  private containerWidth: number;
  private controllers: Map<string, PetController> = new Map();
  private isMovementEnabled: boolean = true;
  private onPetClick: ((petId: string) => void) | null = null;

  constructor(container: HTMLElement, containerWidth: number) {
    this.container = container;
    this.containerWidth = containerWidth;
  }

  /**
   * 設定寵物點擊回調
   */
  setOnPetClick(callback: (petId: string) => void): void {
    this.onPetClick = callback;
  }

  /**
   * 更新顯示的寵物列表
   */
  updatePets(pets: PetState[]): void {
    const currentIds = new Set(this.controllers.keys());
    const newIds = new Set(pets.map(p => p.odangoId));

    // 移除不在列表中的寵物
    for (const id of currentIds) {
      if (!newIds.has(id)) {
        this.removePet(id);
      }
    }

    // 新增或更新寵物
    for (const pet of pets) {
      if (this.controllers.has(pet.odangoId)) {
        // 更新現有寵物
        this.controllers.get(pet.odangoId)!.updateState(pet);
      } else {
        // 新增寵物
        this.addPet(pet);
      }
    }
  }

  /**
   * 新增寵物
   */
  private addPet(pet: PetState): void {
    // 建立 DOM 元素
    const element = document.createElement('div');
    element.className = 'pet';
    element.dataset.petId = pet.odangoId;
    this.container.appendChild(element);

    // 建立控制器
    const controller = new PetController(element, this.containerWidth);
    controller.updateState(pet);
    controller.setMovementEnabled(this.isMovementEnabled);
    controller.start();

    // 綁定點擊事件
    element.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onPetClick) {
        this.onPetClick(pet.odangoId);
      }
    });

    this.controllers.set(pet.odangoId, controller);
  }

  /**
   * 移除寵物
   */
  private removePet(petId: string): void {
    const controller = this.controllers.get(petId);
    if (controller) {
      controller.destroy();
      this.controllers.delete(petId);
    }
  }

  /**
   * 設定容器寬度
   */
  setContainerWidth(width: number): void {
    this.containerWidth = width;
    for (const controller of this.controllers.values()) {
      controller.setContainerWidth(width);
    }
  }

  /**
   * 設定是否啟用移動
   */
  setMovementEnabled(enabled: boolean): void {
    this.isMovementEnabled = enabled;
    for (const controller of this.controllers.values()) {
      controller.setMovementEnabled(enabled);
    }
  }

  /**
   * 開始所有寵物動畫
   */
  startAll(): void {
    for (const controller of this.controllers.values()) {
      controller.start();
    }
  }

  /**
   * 停止所有寵物動畫
   */
  stopAll(): void {
    for (const controller of this.controllers.values()) {
      controller.stop();
    }
  }

  /**
   * 取得寵物數量
   */
  getPetCount(): number {
    return this.controllers.size;
  }

  /**
   * 清除所有寵物
   */
  clear(): void {
    for (const controller of this.controllers.values()) {
      controller.destroy();
    }
    this.controllers.clear();
  }

  /**
   * 銷毀
   */
  destroy(): void {
    this.clear();
  }
}

/**
 * 建立單一寵物控制器（向後相容）
 */
export function createPetController(
  element: HTMLElement,
  containerWidth: number
): PetController {
  return new PetController(element, containerWidth);
}

/**
 * 建立多寵物管理器
 */
export function createMultiPetManager(
  container: HTMLElement,
  containerWidth: number
): MultiPetManager {
  return new MultiPetManager(container, containerWidth);
}
