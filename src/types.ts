/**
 * 類型定義
 */

/**
 * 寵物種類
 */
export type PetSpecies = 'egg' | 'slime' | 'fox' | 'dragon' | 'charmander' | 'agumon' | 'wooper' | 'diglett' | 'ditto';

/**
 * 寵物成長階段
 */
export type PetStage = 'egg' | 'stage1' | 'stage2' | 'stage3';

/**
 * 寵物狀態
 */
export interface PetState {
  /** 寵物 ID */
  odangoId: string;
  /** 擁有者 Discord user ID */
  userId: string;
  /** 寵物種類 */
  species: PetSpecies;
  /** 累積經驗值（永久） */
  xp: number;
  /** 寵物大小（1.0 ~ 1.6） */
  scale: number;
  /** 進化階段 */
  stage: PetStage;
  /** Sprite 圖片路徑，如 'slime/stage1.gif' */
  spritePath: string;
  /** 是否等待孵化選擇 */
  pendingHatch: boolean;
  /** 孵化選項（僅 pendingHatch=true 時有值） */
  hatchOptions?: string[];
  /** 是否為當前使用的寵物 */
  isActive?: boolean;
  /** 最後更新時間 */
  lastUpdatedAt: string;
}

/**
 * 配對完成回應
 */
export interface LinkCompleteResponse {
  token: string;
  userId: string;
  expiresAt: string;
}

/**
 * API 錯誤回應
 */
export interface ApiErrorResponse {
  error: string;
  code: string;
  message: string;
}

/**
 * 健康檢查回應
 */
export interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
  pollMinSeconds: number;
}

/**
 * 請求配對碼回應
 */
export interface LinkRequestResponse {
  success: boolean;
  message: string;
  expiresAt: string;
}

/**
 * 請求配對碼錯誤回應（包含冷卻時間）
 */
export interface LinkRequestErrorResponse extends ApiErrorResponse {
  retryAfter?: number;
}

/**
 * 連線狀態
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

/**
 * 應用設定
 */
export interface AppConfig {
  serverUrl: string;
  token: string | null;
  userId: string | null;
  tokenExpiresAt: string | null;
  pollIntervalMinutes: number;
  /** 所有寵物狀態（快取） */
  allPets: PetState[];
  /** 選擇要顯示的寵物 ID 列表 */
  selectedPetIds: string[];
  windowPosition: { x: number; y: number } | null;
  /** 寵物視窗 Y 座標（null 表示使用預設底部位置） */
  petWindowY: number | null;
  /** 寵物視窗寬度（null 表示使用螢幕寬度） */
  windowWidth: number | null;
  /** 寵物是否啟用移動（預設 true） */
  petMovementEnabled: boolean;
  /** 寵物是否顯示（預設 true） */
  petVisible: boolean;
}

/**
 * 預設設定
 */
export const DEFAULT_CONFIG: AppConfig = {
  serverUrl: 'https://api.leo-pet-api.com',
  token: null,
  userId: null,
  tokenExpiresAt: null,
  pollIntervalMinutes: 60,
  allPets: [],
  selectedPetIds: [],
  windowPosition: null,
  petWindowY: null,
  windowWidth: null,
  petMovementEnabled: true,
  petVisible: true,
};
