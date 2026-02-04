import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAppOnlyToken,
  isAppOnlyTokenExpired,
  AppOnlyTokenManager,
  AppOnlyToken,
} from './app-only-auth.js';

describe('getAppOnlyToken', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should return error when clientId is empty', async () => {
    const result = await getAppOnlyToken('', 'secret');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Client ID is required');
    }
  });

  it('should return error when clientSecret is empty', async () => {
    const result = await getAppOnlyToken('client-id', '');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Client secret is required');
    }
  });

  it('should get app-only token successfully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'test-access-token',
          token_type: 'bearer',
          expires_in: 86400,
          scope: '*',
        }),
    });

    const result = await getAppOnlyToken('test-client-id', 'test-client-secret');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.token.accessToken).toBe('test-access-token');
      expect(result.token.tokenType).toBe('bearer');
      expect(result.token.expiresIn).toBe(86400);
      expect(result.token.scope).toBe('*');
      expect(result.token.expiresAt).toBeGreaterThan(Date.now());
    }

    // Verify correct request format
    expect(global.fetch).toHaveBeenCalledWith(
      'https://www.reddit.com/api/v1/access_token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': expect.any(String),
        }),
        body: 'grant_type=client_credentials',
      })
    );

    // Verify Basic auth header
    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = callArgs[1].headers;
    expect(headers.Authorization).toMatch(/^Basic /);
  });

  it('should return error for invalid credentials', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () =>
        Promise.resolve({
          error: 'invalid_grant',
        }),
    });

    const result = await getAppOnlyToken('invalid-id', 'invalid-secret');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('invalid_grant');
    }
  });

  it('should return error for network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await getAppOnlyToken('test-client-id', 'test-client-secret');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Network error');
    }
  });

  it('should handle HTTP error status without error field', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    const result = await getAppOnlyToken('test-client-id', 'test-client-secret');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('HTTP 500');
    }
  });
});

describe('isAppOnlyTokenExpired', () => {
  it('should return false for valid token', () => {
    const token: AppOnlyToken = {
      accessToken: 'test',
      tokenType: 'bearer',
      expiresIn: 86400,
      scope: '*',
      expiresAt: Date.now() + 86400 * 1000, // 24 hours from now
    };

    expect(isAppOnlyTokenExpired(token)).toBe(false);
  });

  it('should return true for expired token', () => {
    const token: AppOnlyToken = {
      accessToken: 'test',
      tokenType: 'bearer',
      expiresIn: 86400,
      scope: '*',
      expiresAt: Date.now() - 1000, // 1 second ago
    };

    expect(isAppOnlyTokenExpired(token)).toBe(true);
  });

  it('should return true for token expiring within buffer time', () => {
    const token: AppOnlyToken = {
      accessToken: 'test',
      tokenType: 'bearer',
      expiresIn: 86400,
      scope: '*',
      expiresAt: Date.now() + 2 * 60 * 1000, // 2 minutes from now (within 5 min buffer)
    };

    expect(isAppOnlyTokenExpired(token)).toBe(true);
  });

  it('should use custom buffer time', () => {
    const token: AppOnlyToken = {
      accessToken: 'test',
      tokenType: 'bearer',
      expiresIn: 86400,
      scope: '*',
      expiresAt: Date.now() + 2 * 60 * 1000, // 2 minutes from now
    };

    // With 1 minute buffer, token should not be expired
    expect(isAppOnlyTokenExpired(token, 60 * 1000)).toBe(false);
  });
});

describe('AppOnlyTokenManager', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should fetch new token on first call', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'new-token',
          token_type: 'bearer',
          expires_in: 86400,
          scope: '*',
        }),
    });

    const manager = new AppOnlyTokenManager('client-id', 'client-secret');
    const token = await manager.getAccessToken();

    expect(token).toBe('new-token');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should return cached token on subsequent calls', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'cached-token',
          token_type: 'bearer',
          expires_in: 86400,
          scope: '*',
        }),
    });

    const manager = new AppOnlyTokenManager('client-id', 'client-secret');

    const token1 = await manager.getAccessToken();
    const token2 = await manager.getAccessToken();

    expect(token1).toBe('cached-token');
    expect(token2).toBe('cached-token');
    expect(global.fetch).toHaveBeenCalledTimes(1); // Only one fetch
  });

  it('should return null on auth error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'invalid_grant' }),
    });

    const manager = new AppOnlyTokenManager('invalid-id', 'invalid-secret');
    const token = await manager.getAccessToken();

    expect(token).toBeNull();
  });

  it('should clear cached token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'token',
          token_type: 'bearer',
          expires_in: 86400,
          scope: '*',
        }),
    });

    const manager = new AppOnlyTokenManager('client-id', 'client-secret');

    await manager.getAccessToken();
    expect(manager.getCurrentToken()).not.toBeNull();

    manager.clearToken();
    expect(manager.getCurrentToken()).toBeNull();
  });

  it('should get current token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'my-token',
          token_type: 'bearer',
          expires_in: 86400,
          scope: '*',
        }),
    });

    const manager = new AppOnlyTokenManager('client-id', 'client-secret');

    expect(manager.getCurrentToken()).toBeNull();

    await manager.getAccessToken();

    const currentToken = manager.getCurrentToken();
    expect(currentToken).not.toBeNull();
    expect(currentToken?.accessToken).toBe('my-token');
  });
});
