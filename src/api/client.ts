/**
 * API Client 模組
 *
 * 負責與 Discord Bot 的 Overlay API 通訊
 */

import {
  PetState,
  LinkCompleteResponse,
  LinkRequestResponse,
  ApiErrorResponse,
  HealthResponse,
} from '../types';

/**
 * API 錯誤類別
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * API Client
 */
export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // 移除尾部斜線
  }

  /**
   * 設定 Token
   */
  setToken(token: string | null): void {
    this.token = token;
  }

  /**
   * 取得 Token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * 更新 Base URL
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
  }

  /**
   * 健康檢查
   */
  async health(): Promise<HealthResponse> {
    const response = await this.request<HealthResponse>('GET', '/api/health');
    return response;
  }

  /**
   * 請求配對碼 - 透過 Bot 私訊配對碼給指定用戶
   */
  async requestPairCode(discordId: string): Promise<LinkRequestResponse> {
    const response = await this.request<LinkRequestResponse>(
      'POST',
      '/api/link/request',
      { discordId }
    );
    return response;
  }

  /**
   * 完成配對流程
   */
  async linkComplete(code: string): Promise<LinkCompleteResponse> {
    const response = await this.request<LinkCompleteResponse>(
      'POST',
      '/api/link/complete',
      { code }
    );
    return response;
  }

  /**
   * 取得所有寵物狀態
   */
  async getPets(): Promise<PetState[]> {
    if (!this.token) {
      throw new ApiError(401, 'NO_TOKEN', 'No token set');
    }

    const response = await this.request<PetState[]>(
      'GET',
      '/api/me/pets',
      undefined,
      true
    );
    return response;
  }

  /**
   * 取得寵物狀態（舊 API，保留向後相容）
   * @deprecated 請使用 getPets() 取得所有寵物
   */
  async getPetState(): Promise<PetState> {
    const pets = await this.getPets();
    // 返回第一隻活躍的寵物，或第一隻寵物
    const activePet = pets.find(p => p.isActive) || pets[0];
    if (!activePet) {
      throw new ApiError(404, 'NO_PET', 'No pets found');
    }
    return activePet;
  }

  /**
   * 發送 HTTP 請求
   */
  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    requireAuth: boolean = false
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (requireAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as ApiErrorResponse;
        throw new ApiError(
          response.status,
          errorData.code || 'UNKNOWN_ERROR',
          errorData.message || 'An error occurred'
        );
      }

      return data as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      // 網路錯誤
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ApiError(0, 'NETWORK_ERROR', 'Unable to connect to server');
      }

      throw new ApiError(0, 'UNKNOWN_ERROR', String(error));
    }
  }
}

/**
 * 建立 API Client 實例
 */
export function createApiClient(baseUrl: string): ApiClient {
  return new ApiClient(baseUrl);
}
