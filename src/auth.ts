/**
 * Auth CLI commands module.
 * Provides login, logout, and status commands for Reddit authentication.
 * Uses browser-based authentication (no Reddit App required).
 */

import {
  loadConfig,
  saveConfig,
  clearConfig,
  hasBrowserAuth,
  type Config,
} from './config.js';
import { browserLogin, filterEssentialCookies } from './browser-auth.js';

export interface AuthSuccessResult {
  success: true;
  message: string;
}

export interface AuthErrorResult {
  success: false;
  error: string;
}

export interface AuthStatusResult {
  success: true;
  loggedIn: boolean;
  username?: string;
}

export type AuthResult = AuthSuccessResult | AuthErrorResult;
export type StatusResult = AuthStatusResult | AuthErrorResult;

/**
 * Perform browser-based login.
 * Opens a real browser window for user to log in manually.
 * No Reddit App required - just username and password.
 */
export async function authBrowserLogin(): Promise<AuthResult> {
  const result = await browserLogin();

  if (!result.success) {
    return result;
  }

  const config: Config = {
    authType: 'browser',
    cookies: filterEssentialCookies(result.cookies),
    username: result.username,
    cookiesUpdatedAt: Date.now(),
  };

  saveConfig(config);

  return {
    success: true,
    message: `Successfully logged in as ${result.username}!`,
  };
}

/**
 * Clear saved credentials.
 */
export async function authLogout(): Promise<AuthResult> {
  const wasCleared = clearConfig();

  if (wasCleared) {
    return {
      success: true,
      message: 'Successfully logged out from Reddit.',
    };
  }

  return {
    success: true,
    message: 'You were not logged in.',
  };
}

/**
 * Check current authentication status.
 */
export async function authStatus(): Promise<StatusResult> {
  const config = loadConfig();

  if (!config || !hasBrowserAuth(config)) {
    return {
      success: true,
      loggedIn: false,
    };
  }

  return {
    success: true,
    loggedIn: true,
    username: config.username,
  };
}
