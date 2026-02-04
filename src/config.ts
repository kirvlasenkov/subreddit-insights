/**
 * Config module for storing authentication credentials.
 * Supports both OAuth tokens and browser session cookies.
 * Stores data in ~/.config/subreddit-insights/config.json
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Cookie } from 'puppeteer-core';

export type AuthType = 'oauth' | 'browser';

export interface Config {
  authType: AuthType;
  // OAuth fields
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  // Browser auth fields
  cookies?: Cookie[];
  username?: string;
  cookiesUpdatedAt?: number;
}

const CONFIG_DIR = '.config/subreddit-insights';
const CONFIG_FILE = 'config.json';

/**
 * Get the full path to the config file.
 */
export function getConfigPath(): string {
  return path.join(os.homedir(), CONFIG_DIR, CONFIG_FILE);
}

/**
 * Get the config directory path.
 */
function getConfigDir(): string {
  return path.join(os.homedir(), CONFIG_DIR);
}

/**
 * Load config from disk.
 * Returns null if config doesn't exist or is invalid.
 */
export function loadConfig(): Config | null {
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as Config;
  } catch {
    return null;
  }
}

/**
 * Save config to disk.
 * Creates the config directory if it doesn't exist.
 * Sets file permissions to 0600 (owner read/write only).
 */
export function saveConfig(config: Config): void {
  const configDir = getConfigDir();
  const configPath = getConfigPath();

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
}

/**
 * Clear config by deleting the config file.
 * Returns true if file was deleted, false otherwise.
 */
export function clearConfig(): boolean {
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    return false;
  }

  try {
    fs.unlinkSync(configPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if config has valid browser cookies.
 * Cookies are considered valid for 30 days.
 */
export function hasBrowserAuth(config: Config | null): boolean {
  if (!config || config.authType !== 'browser') {
    return false;
  }

  if (!config.cookies || config.cookies.length === 0) {
    return false;
  }

  // Check if cookies are not too old (30 days)
  if (config.cookiesUpdatedAt) {
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - config.cookiesUpdatedAt > thirtyDays) {
      return false;
    }
  }

  return true;
}

/**
 * Check if config has valid OAuth tokens.
 */
export function hasOAuthAuth(config: Config | null): boolean {
  if (!config || config.authType !== 'oauth') {
    return false;
  }

  return !!(config.accessToken && config.refreshToken);
}

/**
 * Get cookies header string from config.
 */
export function getCookiesHeader(config: Config | null): string | null {
  if (!hasBrowserAuth(config)) {
    return null;
  }

  return config!.cookies!
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}
