import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as http from 'node:http';
import { EventEmitter } from 'node:events';

// Mock http module
vi.mock('node:http', () => {
  return {
    createServer: vi.fn(),
  };
});

// Mock child_process for browser opening
vi.mock('node:child_process', () => {
  return {
    exec: vi.fn(),
  };
});

// Import after mocking
import {
  generateState,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  RedditTokens,
  REDDIT_OAUTH_CONFIG,
} from './reddit-auth.js';

describe('generateState', () => {
  it('should generate a random state string', () => {
    const state1 = generateState();
    const state2 = generateState();

    expect(state1).toBeTruthy();
    expect(state2).toBeTruthy();
    expect(state1).not.toBe(state2);
    expect(typeof state1).toBe('string');
    expect(state1.length).toBeGreaterThan(10);
  });
});

describe('buildAuthorizationUrl', () => {
  it('should build valid Reddit authorization URL', () => {
    const state = 'test-state-123';
    const clientId = 'test-client-id';

    const url = buildAuthorizationUrl(clientId, state);

    expect(url).toContain('https://www.reddit.com/api/v1/authorize');
    expect(url).toContain(`client_id=${clientId}`);
    expect(url).toContain(`state=${state}`);
    expect(url).toContain('response_type=code');
    expect(url).toContain(`redirect_uri=${encodeURIComponent(REDDIT_OAUTH_CONFIG.redirectUri)}`);
    expect(url).toContain('duration=permanent');
    expect(url).toContain('scope=read');
  });
});

describe('exchangeCodeForTokens', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should exchange authorization code for tokens successfully', async () => {
    const mockTokens: RedditTokens = {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresIn: 86400,
      scope: 'read',
      tokenType: 'bearer',
      expiresAt: Date.now() + 86400 * 1000,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: mockTokens.accessToken,
          refresh_token: mockTokens.refreshToken,
          expires_in: mockTokens.expiresIn,
          scope: mockTokens.scope,
          token_type: mockTokens.tokenType,
        }),
    });

    const result = await exchangeCodeForTokens(
      'test-code',
      'test-client-id',
      'test-client-secret'
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.tokens.accessToken).toBe(mockTokens.accessToken);
      expect(result.tokens.refreshToken).toBe(mockTokens.refreshToken);
      expect(result.tokens.expiresIn).toBe(mockTokens.expiresIn);
    }
  });

  it('should return error for invalid authorization code', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          error: 'invalid_grant',
        }),
    });

    const result = await exchangeCodeForTokens(
      'invalid-code',
      'test-client-id',
      'test-client-secret'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('invalid_grant');
    }
  });

  it('should return error for network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await exchangeCodeForTokens(
      'test-code',
      'test-client-id',
      'test-client-secret'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Network error');
    }
  });
});

describe('refreshAccessToken', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should refresh access token successfully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 86400,
          scope: 'read',
          token_type: 'bearer',
        }),
    });

    const result = await refreshAccessToken(
      'old-refresh-token',
      'test-client-id',
      'test-client-secret'
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.tokens.accessToken).toBe('new-access-token');
    }
  });

  it('should return error for invalid refresh token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          error: 'invalid_grant',
        }),
    });

    const result = await refreshAccessToken(
      'invalid-refresh-token',
      'test-client-id',
      'test-client-secret'
    );

    expect(result.success).toBe(false);
  });
});

describe('REDDIT_OAUTH_CONFIG', () => {
  it('should have correct configuration values', () => {
    expect(REDDIT_OAUTH_CONFIG.authorizationUrl).toBe(
      'https://www.reddit.com/api/v1/authorize'
    );
    expect(REDDIT_OAUTH_CONFIG.tokenUrl).toBe(
      'https://www.reddit.com/api/v1/access_token'
    );
    expect(REDDIT_OAUTH_CONFIG.redirectUri).toBe(
      'http://localhost:8080/callback'
    );
    expect(REDDIT_OAUTH_CONFIG.scope).toBe('read');
  });
});
