/**
 * Tests for auth CLI commands module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as config from './config.js';
import * as redditAuth from './reddit-auth.js';
import {
  authLogin,
  authLogout,
  authStatus,
} from './auth.js';

// Mock dependencies
vi.mock('./config.js');
vi.mock('./reddit-auth.js');

describe('auth module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset console.log mock
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('authLogin', () => {
    it('should successfully login and save tokens', async () => {
      const mockTokens: redditAuth.RedditTokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
        scope: 'read',
        tokenType: 'bearer',
        expiresAt: Date.now() + 3600000,
      };

      vi.mocked(redditAuth.authorizeReddit).mockResolvedValue({
        success: true,
        tokens: mockTokens,
      });
      vi.mocked(config.saveConfig).mockImplementation(() => {});

      const result = await authLogin('client-id', 'client-secret');

      expect(result.success).toBe(true);
      expect(redditAuth.authorizeReddit).toHaveBeenCalledWith('client-id', 'client-secret');
      expect(config.saveConfig).toHaveBeenCalledWith({
        authType: 'oauth',
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        expiresAt: mockTokens.expiresAt,
      });
    });

    it('should return error when authorization fails', async () => {
      vi.mocked(redditAuth.authorizeReddit).mockResolvedValue({
        success: false,
        error: 'Authorization denied: access_denied',
      });

      const result = await authLogin('client-id', 'client-secret');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Authorization denied: access_denied');
      }
      expect(config.saveConfig).not.toHaveBeenCalled();
    });

    it('should return error when client credentials are missing', async () => {
      const result = await authLogin('', 'client-secret');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('client ID');
      }
      expect(redditAuth.authorizeReddit).not.toHaveBeenCalled();
    });

    it('should return error when client secret is missing', async () => {
      const result = await authLogin('client-id', '');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('client secret');
      }
      expect(redditAuth.authorizeReddit).not.toHaveBeenCalled();
    });
  });

  describe('authLogout', () => {
    it('should successfully logout and clear config', async () => {
      vi.mocked(config.clearConfig).mockReturnValue(true);

      const result = await authLogout();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.message).toContain('logged out');
      }
      expect(config.clearConfig).toHaveBeenCalled();
    });

    it('should indicate when no credentials were stored', async () => {
      vi.mocked(config.clearConfig).mockReturnValue(false);

      const result = await authLogout();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.message).toContain('not logged in');
      }
    });
  });

  describe('authStatus', () => {
    it('should show logged in status with valid OAuth token', async () => {
      const mockConfig: config.Config = {
        authType: 'oauth',
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() + 3600000, // 1 hour from now
      };

      vi.mocked(config.loadConfig).mockReturnValue(mockConfig);
      vi.mocked(config.hasBrowserAuth).mockReturnValue(false);
      vi.mocked(config.hasOAuthAuth).mockReturnValue(true);

      const result = await authStatus();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.loggedIn).toBe(true);
        expect(result.authType).toBe('oauth');
        expect(result.tokenValid).toBe(true);
        expect(result.expiresAt).toBe(mockConfig.expiresAt);
      }
    });

    it('should show logged in but expired status', async () => {
      const mockConfig: config.Config = {
        authType: 'oauth',
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() - 3600000, // 1 hour ago
      };

      vi.mocked(config.loadConfig).mockReturnValue(mockConfig);
      vi.mocked(config.hasBrowserAuth).mockReturnValue(false);
      vi.mocked(config.hasOAuthAuth).mockReturnValue(true);

      const result = await authStatus();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.loggedIn).toBe(true);
        expect(result.tokenValid).toBe(false);
      }
    });

    it('should show logged in status with browser auth', async () => {
      const mockConfig: config.Config = {
        authType: 'browser',
        cookies: [{ name: 'reddit_session', value: 'abc123' }] as config.Config['cookies'],
        username: 'testuser',
        cookiesUpdatedAt: Date.now(),
      };

      vi.mocked(config.loadConfig).mockReturnValue(mockConfig);
      vi.mocked(config.hasBrowserAuth).mockReturnValue(true);

      const result = await authStatus();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.loggedIn).toBe(true);
        expect(result.authType).toBe('browser');
        expect(result.username).toBe('testuser');
      }
    });

    it('should show not logged in status when no config', async () => {
      vi.mocked(config.loadConfig).mockReturnValue(null);
      vi.mocked(config.hasBrowserAuth).mockReturnValue(false);
      vi.mocked(config.hasOAuthAuth).mockReturnValue(false);

      const result = await authStatus();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.loggedIn).toBe(false);
        expect(result.tokenValid).toBe(false);
      }
    });
  });
});
