/**
 * Auth CLI commands module.
 * Provides login, logout, and status commands for Reddit OAuth.
 */

import { loadConfig, saveConfig, clearConfig, type Config } from './config.js';
import { authorizeReddit } from './reddit-auth.js';

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
  tokenValid: boolean;
  expiresAt?: number;
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
      tokenValid: false,
    };
  }

  const bufferMs = 5 * 60 * 1000; // 5 minutes buffer
  const isValid = Date.now() < config.expiresAt - bufferMs;

  return {
    success: true,
    loggedIn: true,
    tokenValid: isValid,
    expiresAt: config.expiresAt,
  };
}
