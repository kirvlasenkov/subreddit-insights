/**
 * Tests for auth CLI commands module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as config from './config.js';
import * as browserAuth from './browser-auth.js';
import {
  authBrowserLogin,
  authLogout,
  authStatus,
} from './auth.js';

// Mock dependencies
vi.mock('./config.js');
vi.mock('./browser-auth.js');

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

  describe('authBrowserLogin', () => {
    it('should successfully login and save cookies', async () => {
      const mockCookies = [
        { name: 'reddit_session', value: 'abc123' },
        { name: 'token_v2', value: 'xyz789' },
      ];

      vi.mocked(browserAuth.browserLogin).mockResolvedValue({
        success: true,
        cookies: mockCookies as browserAuth.BrowserAuthResult['cookies'],
        username: 'testuser',
      });
      vi.mocked(browserAuth.filterEssentialCookies).mockReturnValue(mockCookies as browserAuth.BrowserAuthResult['cookies']);
      vi.mocked(config.saveConfig).mockImplementation(() => {});

      const result = await authBrowserLogin();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.message).toContain('testuser');
      }
      expect(config.saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          authType: 'browser',
          username: 'testuser',
        })
      );
    });

    it('should return error when browser login fails', async () => {
      vi.mocked(browserAuth.browserLogin).mockResolvedValue({
        success: false,
        error: 'No browser found',
      });

      const result = await authBrowserLogin();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('No browser found');
      }
      expect(config.saveConfig).not.toHaveBeenCalled();
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
        expect(result.username).toBe('testuser');
      }
    });

    it('should show not logged in status when no config', async () => {
      vi.mocked(config.loadConfig).mockReturnValue(null);
      vi.mocked(config.hasBrowserAuth).mockReturnValue(false);

      const result = await authStatus();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.loggedIn).toBe(false);
      }
    });

    it('should show not logged in when cookies expired', async () => {
      const mockConfig: config.Config = {
        authType: 'browser',
        cookies: [{ name: 'reddit_session', value: 'abc123' }] as config.Config['cookies'],
        username: 'testuser',
        cookiesUpdatedAt: Date.now() - 40 * 24 * 60 * 60 * 1000, // 40 days ago
      };

      vi.mocked(config.loadConfig).mockReturnValue(mockConfig);
      vi.mocked(config.hasBrowserAuth).mockReturnValue(false); // Expired

      const result = await authStatus();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.loggedIn).toBe(false);
      }
    });
  });
});
