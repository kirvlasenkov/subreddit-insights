import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';

// Mock fs module
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

// Mock os module for homedir
vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return {
    ...actual,
    homedir: vi.fn(() => '/home/testuser'),
  };
});

// Import after mocking
import {
  loadConfig,
  saveConfig,
  clearConfig,
  getConfigPath,
  type Config,
} from './config.js';

describe('getConfigPath', () => {
  it('should return path in ~/.config/subreddit-insights', () => {
    const configPath = getConfigPath();
    expect(configPath).toBe('/home/testuser/.config/subreddit-insights/config.json');
  });
});

describe('loadConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when config file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const config = loadConfig();

    expect(config).toBeNull();
    expect(fs.existsSync).toHaveBeenCalledWith(
      '/home/testuser/.config/subreddit-insights/config.json'
    );
  });

  it('should load and parse config when file exists', () => {
    const mockConfig: Config = {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: 1234567890,
    };

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

    const config = loadConfig();

    expect(config).toEqual(mockConfig);
    expect(fs.readFileSync).toHaveBeenCalledWith(
      '/home/testuser/.config/subreddit-insights/config.json',
      'utf-8'
    );
  });

  it('should return null when config file contains invalid JSON', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('not valid json');

    const config = loadConfig();

    expect(config).toBeNull();
  });

  it('should return null when reading file throws error', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const config = loadConfig();

    expect(config).toBeNull();
  });
});

describe('saveConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create config directory and save config file', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const config: Config = {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: 1234567890,
    };

    saveConfig(config);

    expect(fs.mkdirSync).toHaveBeenCalledWith(
      '/home/testuser/.config/subreddit-insights',
      { recursive: true }
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/home/testuser/.config/subreddit-insights/config.json',
      JSON.stringify(config, null, 2),
      { mode: 0o600 }
    );
  });

  it('should not recreate directory if it exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const config: Config = {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: 1234567890,
    };

    saveConfig(config);

    expect(fs.mkdirSync).not.toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('should save config with restricted permissions (0600)', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const config: Config = {
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: 0,
    };

    saveConfig(config);

    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(writeCall[2]).toEqual({ mode: 0o600 });
  });
});

describe('clearConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete config file when it exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const result = clearConfig();

    expect(result).toBe(true);
    expect(fs.unlinkSync).toHaveBeenCalledWith(
      '/home/testuser/.config/subreddit-insights/config.json'
    );
  });

  it('should return false when config file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = clearConfig();

    expect(result).toBe(false);
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });

  it('should return false when deletion fails', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.unlinkSync).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const result = clearConfig();

    expect(result).toBe(false);
  });
});
