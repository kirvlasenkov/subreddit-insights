/**
 * Auth CLI commands module.
 * Provides login, logout, and status commands for Reddit authentication.
 * Supports both OAuth and browser-based authentication.
 */

import {
  loadConfig,
  saveConfig,
  clearConfig,
  hasBrowserAuth,
  hasOAuthAuth,
  type Config,
} from './config.js';
import { authorizeReddit } from './reddit-auth.js';
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
  authType: 'oauth' | 'browser' | 'none';
  tokenValid: boolean;
  expiresAt?: number;
  username?: string;
}

export type AuthResult = AuthSuccessResult | AuthErrorResult;
export type StatusResult = AuthStatusResult | AuthErrorResult;

/**
 * Perform OAuth login flow.
 * Opens browser for Reddit authorization and saves tokens.
 */
export async function authLogin(
  clientId: string,
  clientSecret: string
): Promise<AuthResult> {
  if (!clientId) {
    return { success: false, error: 'Reddit client ID is required' };
  }

  if (!clientSecret) {
    return { success: false, error: 'Reddit client secret is required' };
  }

  const result = await authorizeReddit(clientId, clientSecret);

  if (!result.success) {
    return result;
  }

  const config: Config = {
    authType: 'oauth',
    accessToken: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken,
    expiresAt: result.tokens.expiresAt,
  };

  saveConfig(config);

  return {
    success: true,
    message: 'Successfully logged in to Reddit!',
  };
}

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

  if (!config) {
    return {
      success: true,
      loggedIn: false,
      authType: 'none',
      tokenValid: false,
    };
  }

  // Check browser auth
  if (hasBrowserAuth(config)) {
    return {
      success: true,
      loggedIn: true,
      authType: 'browser',
      tokenValid: true,
      username: config.username,
    };
  }

  // Check OAuth auth
  if (hasOAuthAuth(config)) {
    const bufferMs = 5 * 60 * 1000; // 5 minutes buffer
    const isValid = Date.now() < (config.expiresAt || 0) - bufferMs;

    return {
      success: true,
      loggedIn: true,
      authType: 'oauth',
      tokenValid: isValid,
      expiresAt: config.expiresAt,
    };
  }

  return {
    success: true,
    loggedIn: false,
    authType: 'none',
    tokenValid: false,
  };
}
