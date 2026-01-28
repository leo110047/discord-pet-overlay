/**
 * API Client 測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient, ApiError } from './client';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ApiClient', () => {
  let client: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ApiClient('http://localhost:8787');
  });

  describe('health', () => {
    it('should return health status on success', async () => {
      const mockResponse = {
        status: 'ok',
        version: '1.0.0',
        timestamp: '2024-01-01T00:00:00.000Z',
        pollMinSeconds: 3600,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.health();

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/health',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
  });

  describe('linkComplete', () => {
    it('should return token on success', async () => {
      const mockResponse = {
        token: 'jwt-token',
        userId: 'user-123',
        expiresAt: '2024-12-31T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.linkComplete('123456');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/link/complete',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ code: '123456' }),
        })
      );
    });

    it('should throw ApiError on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          error: 'unauthorized',
          code: 'CODE_NOT_FOUND',
          message: 'Invalid pair code',
        }),
      });

      try {
        await client.linkComplete('000000');
        // 如果沒有拋出錯誤，測試應該失敗
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(401);
        expect((error as ApiError).code).toBe('CODE_NOT_FOUND');
      }
    });
  });

  describe('getPetState', () => {
    it('should throw error when no token set', async () => {
      await expect(client.getPetState()).rejects.toThrow(ApiError);
    });

    it('should return pet state when token is set', async () => {
      client.setToken('valid-token');

      const mockResponse = {
        userId: 'user-123',
        xp: 500,
        scale: 1.5,
        stage: 'teen',
        breakdown: {
          msgCount: 100,
          voiceMinutes: 200,
          eventCount: 0,
        },
        lastUpdatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getPetState();

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/me/pet-state',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer valid-token',
          }),
        })
      );
    });
  });

  describe('setBaseUrl', () => {
    it('should update base URL and remove trailing slash', () => {
      client.setBaseUrl('http://example.com/');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      });

      client.health();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://example.com/api/health',
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      try {
        await client.health();
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).code).toBe('NETWORK_ERROR');
      }
    });
  });
});
