/**
 * 類型定義
 */

/**
 * 寵物種類（由後端動態定義）
 */
export type PetSpecies = string;

/**
 * 寵物成長階段
 */
export type PetStage = 'egg' | 'stage1' | 'stage2' | 'stage3';

/**
 * Sprite 預設朝向
 */
export type SpriteFacing = 'left' | 'right';

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
  /** 當前階段的顯示名稱（如「噴火龍」） */
  stageName: string;
  /** Sprite 圖片路徑，如 'slime/stage1.gif' */
  spritePath: string;
  /** Sprite 預設朝向（用於動畫翻轉） */
  defaultFacing?: SpriteFacing;
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
 * 單隻寵物的顯示設定
 */
export interface PetDisplaySettings {
  /** 是否啟用移動 */
  movementEnabled: boolean;
  /** 移動速度（0.3 ~ 2.0） */
  movementSpeed: number;
}

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
  /** 每隻寵物的個別顯示設定 */
  petSettings: Record<string, PetDisplaySettings>;
  windowPosition: { x: number; y: number } | null;
  /** 寵物視窗 Y 座標（null 表示使用預設底部位置） */
  petWindowY: number | null;
  /** 寵物視窗寬度（null 表示使用螢幕寬度） */
  windowWidth: number | null;
}

/**
 * 預設寵物顯示設定
 */
export const DEFAULT_PET_SETTINGS: PetDisplaySettings = {
  movementEnabled: true,
  movementSpeed: 1.0,
};

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
  petSettings: {},
  windowPosition: null,
  petWindowY: null,
  windowWidth: null,
};
