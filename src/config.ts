/**
 * Config module for storing OAuth credentials.
 * Stores tokens in ~/.config/subreddit-insights/config.json
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface Config {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
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
