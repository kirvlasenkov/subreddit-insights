import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';

// Mock fs module
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
  };
});

// Import after mocking
import {
  findBrowserExecutable,
  isLoggedIn,
  cookiesToHeader,
  filterEssentialCookies,
} from './browser-auth.js';
import type { Cookie } from 'puppeteer-core';

describe('findBrowserExecutable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when no browser found', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = findBrowserExecutable();

    expect(result).toBeNull();
  });

  it('should return first found browser path', () => {
    // Return true for the second path checked
    let callCount = 0;
    vi.mocked(fs.existsSync).mockImplementation(() => {
      callCount++;
      return callCount === 2;
    });

    const result = findBrowserExecutable();

    expect(result).not.toBeNull();
  });

  it('should check BROWSER_PATH env variable first', () => {
    const originalEnv = process.env.BROWSER_PATH;
    process.env.BROWSER_PATH = '/custom/browser/path';
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const result = findBrowserExecutable();

    expect(result).toBe('/custom/browser/path');
    expect(fs.existsSync).toHaveBeenCalledWith('/custom/browser/path');

    // Cleanup
    if (originalEnv) {
      process.env.BROWSER_PATH = originalEnv;
    } else {
      delete process.env.BROWSER_PATH;
    }
  });
});

describe('isLoggedIn', () => {
  it('should return true when reddit_session cookie exists', () => {
    const cookies: Cookie[] = [
      { name: 'reddit_session', value: 'abc123', domain: '.reddit.com' } as Cookie,
    ];

    expect(isLoggedIn(cookies)).toBe(true);
  });

  it('should return true when token_v2 cookie exists', () => {
    const cookies: Cookie[] = [
      { name: 'token_v2', value: 'xyz789', domain: '.reddit.com' } as Cookie,
    ];

    expect(isLoggedIn(cookies)).toBe(true);
  });

  it('should return false when no session cookies exist', () => {
    const cookies: Cookie[] = [
      { name: 'other_cookie', value: 'value', domain: '.reddit.com' } as Cookie,
    ];

    expect(isLoggedIn(cookies)).toBe(false);
  });

  it('should return false for empty cookies array', () => {
    expect(isLoggedIn([])).toBe(false);
  });
});

describe('cookiesToHeader', () => {
  it('should convert cookies array to header string', () => {
    const cookies: Cookie[] = [
      { name: 'cookie1', value: 'value1' } as Cookie,
      { name: 'cookie2', value: 'value2' } as Cookie,
    ];

    const header = cookiesToHeader(cookies);

    expect(header).toBe('cookie1=value1; cookie2=value2');
  });

  it('should return empty string for empty array', () => {
    expect(cookiesToHeader([])).toBe('');
  });
});

describe('filterEssentialCookies', () => {
  it('should filter only essential Reddit cookies', () => {
    const cookies: Cookie[] = [
      { name: 'reddit_session', value: 'session123' } as Cookie,
      { name: 'token_v2', value: 'token123' } as Cookie,
      { name: 'loid', value: 'loid123' } as Cookie,
      { name: 'edgebucket', value: 'edge123' } as Cookie,
      { name: 'tracking_cookie', value: 'track123' } as Cookie,
      { name: 'random_cookie', value: 'random' } as Cookie,
    ];

    const filtered = filterEssentialCookies(cookies);

    expect(filtered).toHaveLength(4);
    expect(filtered.map((c) => c.name)).toEqual([
      'reddit_session',
      'token_v2',
      'loid',
      'edgebucket',
    ]);
  });

  it('should return empty array when no essential cookies', () => {
    const cookies: Cookie[] = [
      { name: 'tracking', value: 'value' } as Cookie,
    ];

    expect(filterEssentialCookies(cookies)).toHaveLength(0);
  });
});
