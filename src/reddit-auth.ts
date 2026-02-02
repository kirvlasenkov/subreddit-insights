/**
 * Reddit OAuth2 Web App Flow module.
 * Handles browser-based authorization, callback server, and token management.
 */

import * as http from 'node:http';
import * as crypto from 'node:crypto';
import { exec } from 'node:child_process';

export interface RedditTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
  tokenType: string;
  expiresAt: number;
}

export interface TokenResult {
  success: true;
  tokens: RedditTokens;
}

export interface TokenError {
  success: false;
  error: string;
}

export type ExchangeTokenResult = TokenResult | TokenError;

export const REDDIT_OAUTH_CONFIG = {
  authorizationUrl: 'https://www.reddit.com/api/v1/authorize',
  tokenUrl: 'https://www.reddit.com/api/v1/access_token',
  redirectUri: 'http://localhost:8080/callback',
  scope: 'read',
  callbackPort: 8080,
} as const;

/**
 * Generate a cryptographically secure random state string for CSRF protection.
 */
export function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Build the Reddit authorization URL for OAuth2 web app flow.
 */
export function buildAuthorizationUrl(clientId: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    state: state,
    redirect_uri: REDDIT_OAUTH_CONFIG.redirectUri,
    duration: 'permanent', // Get refresh token
    scope: REDDIT_OAUTH_CONFIG.scope,
  });

  return `${REDDIT_OAUTH_CONFIG.authorizationUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access and refresh tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<ExchangeTokenResult> {
  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64'
    );

    const response = await fetch(REDDIT_OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
        'User-Agent': 'subreddit-insights-cli/0.1.0',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDDIT_OAUTH_CONFIG.redirectUri,
      }).toString(),
    });

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok || data.error) {
      const errorMessage = (data.error as string) || `HTTP ${response.status}`;
      return { success: false, error: `Token exchange failed: ${errorMessage}` };
    }

    const tokens: RedditTokens = {
      accessToken: data.access_token as string,
      refreshToken: data.refresh_token as string,
      expiresIn: data.expires_in as number,
      scope: data.scope as string,
      tokenType: data.token_type as string,
      expiresAt: Date.now() + (data.expires_in as number) * 1000,
    };

    return { success: true, tokens };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Token exchange failed: ${message}` };
  }
}

/**
 * Refresh the access token using the refresh token.
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<ExchangeTokenResult> {
  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64'
    );

    const response = await fetch(REDDIT_OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
        'User-Agent': 'subreddit-insights-cli/0.1.0',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok || data.error) {
      const errorMessage = (data.error as string) || `HTTP ${response.status}`;
      return { success: false, error: `Token refresh failed: ${errorMessage}` };
    }

    const tokens: RedditTokens = {
      accessToken: data.access_token as string,
      // Reddit may not return a new refresh token, keep the old one
      refreshToken: (data.refresh_token as string) || refreshToken,
      expiresIn: data.expires_in as number,
      scope: data.scope as string,
      tokenType: data.token_type as string,
      expiresAt: Date.now() + (data.expires_in as number) * 1000,
    };

    return { success: true, tokens };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Token refresh failed: ${message}` };
  }
}

/**
 * Open a URL in the default browser.
 */
export function openBrowser(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = process.platform;
    let command: string;

    switch (platform) {
      case 'darwin':
        command = `open "${url}"`;
        break;
      case 'win32':
        command = `start "" "${url}"`;
        break;
      default:
        // Linux and other Unix-like systems
        command = `xdg-open "${url}"`;
    }

    exec(command, (error) => {
      if (error) {
        reject(
          new Error(`Failed to open browser: ${error.message}`)
        );
      } else {
        resolve();
      }
    });
  });
}

/**
 * Start a local HTTP server to handle the OAuth callback.
 * Returns a promise that resolves with the authorization code.
 */
export function startCallbackServer(
  expectedState: string,
  timeoutMs = 300000 // 5 minutes
): Promise<{ success: true; code: string } | { success: false; error: string }> {
  return new Promise((resolve) => {
    let resolved = false;

    const server = http.createServer((req, res) => {
      if (resolved) return;

      const url = new URL(req.url || '', `http://localhost:${REDDIT_OAUTH_CONFIG.callbackPort}`);

      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      // Send response to browser
      res.writeHead(200, { 'Content-Type': 'text/html' });

      if (error) {
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>Authorization Failed</title></head>
          <body>
            <h1>Authorization Failed</h1>
            <p>Error: ${error}</p>
            <p>You can close this window.</p>
          </body>
          </html>
        `);
        resolved = true;
        server.close();
        resolve({ success: false, error: `Authorization denied: ${error}` });
        return;
      }

      if (!code) {
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>Authorization Failed</title></head>
          <body>
            <h1>Authorization Failed</h1>
            <p>No authorization code received.</p>
            <p>You can close this window.</p>
          </body>
          </html>
        `);
        resolved = true;
        server.close();
        resolve({ success: false, error: 'No authorization code received' });
        return;
      }

      if (state !== expectedState) {
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>Authorization Failed</title></head>
          <body>
            <h1>Authorization Failed</h1>
            <p>State mismatch - possible CSRF attack.</p>
            <p>You can close this window.</p>
          </body>
          </html>
        `);
        resolved = true;
        server.close();
        resolve({ success: false, error: 'State mismatch - possible CSRF attack' });
        return;
      }

      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Authorization Successful</title></head>
        <body>
          <h1>Authorization Successful!</h1>
          <p>You can close this window and return to the terminal.</p>
        </body>
        </html>
      `);

      resolved = true;
      server.close();
      resolve({ success: true, code });
    });

    // Set timeout
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        server.close();
        resolve({ success: false, error: 'Authorization timeout - no response received' });
      }
    }, timeoutMs);

    server.on('close', () => {
      clearTimeout(timeout);
    });

    server.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ success: false, error: `Server error: ${err.message}` });
      }
    });

    server.listen(REDDIT_OAUTH_CONFIG.callbackPort, () => {
      console.log(
        `Callback server listening on http://localhost:${REDDIT_OAUTH_CONFIG.callbackPort}`
      );
    });
  });
}

/**
 * Check if tokens are expired or about to expire (within 5 minutes).
 */
export function isTokenExpired(tokens: RedditTokens): boolean {
  const bufferMs = 5 * 60 * 1000; // 5 minutes buffer
  return Date.now() >= tokens.expiresAt - bufferMs;
}

/**
 * Perform the full OAuth2 authorization flow.
 * Opens browser for user login, waits for callback, exchanges code for tokens.
 */
export async function authorizeReddit(
  clientId: string,
  clientSecret: string
): Promise<ExchangeTokenResult> {
  const state = generateState();
  const authUrl = buildAuthorizationUrl(clientId, state);

  console.log('');
  console.log('Opening browser for Reddit authorization...');
  console.log('If the browser does not open, please visit this URL manually:');
  console.log('');
  console.log(authUrl);
  console.log('');

  // Start callback server before opening browser
  const serverPromise = startCallbackServer(state);

  // Open browser
  try {
    await openBrowser(authUrl);
  } catch (error) {
    console.log(
      'Could not open browser automatically. Please visit the URL above manually.'
    );
  }

  console.log('Waiting for authorization...');

  // Wait for callback
  const callbackResult = await serverPromise;

  if (!callbackResult.success) {
    return callbackResult;
  }

  console.log('Authorization code received. Exchanging for tokens...');

  // Exchange code for tokens
  const tokenResult = await exchangeCodeForTokens(
    callbackResult.code,
    clientId,
    clientSecret
  );

  if (tokenResult.success) {
    console.log('Successfully obtained Reddit access token!');
  }

  return tokenResult;
}

/**
 * Get a valid access token, refreshing if necessary.
 */
export async function getValidAccessToken(
  tokens: RedditTokens,
  clientId: string,
  clientSecret: string
): Promise<ExchangeTokenResult> {
  if (!isTokenExpired(tokens)) {
    return { success: true, tokens };
  }

  console.log('Access token expired, refreshing...');
  return refreshAccessToken(tokens.refreshToken, clientId, clientSecret);
}
