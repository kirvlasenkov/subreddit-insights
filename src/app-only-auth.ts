/**
 * Reddit Application-Only OAuth module.
 * Uses client_credentials grant type - no user login required.
 * Provides access to public Reddit data with 100 req/min rate limit.
 *
 * @see https://github.com/reddit-archive/reddit/wiki/OAuth2#application-only-oauth
 */

const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const USER_AGENT = 'subreddit-insights-cli/0.1.0';

export interface AppOnlyToken {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  scope: string;
  expiresAt: number;
}

export interface AppOnlyTokenResult {
  success: true;
  token: AppOnlyToken;
}

export interface AppOnlyTokenError {
  success: false;
  error: string;
}

export type GetAppOnlyTokenResult = AppOnlyTokenResult | AppOnlyTokenError;

/**
 * Get an application-only access token using client credentials.
 * This token provides read-only access to public Reddit data.
 *
 * @param clientId - Reddit app client ID
 * @param clientSecret - Reddit app client secret
 * @returns Token result with access token or error
 */
export async function getAppOnlyToken(
  clientId: string,
  clientSecret: string
): Promise<GetAppOnlyTokenResult> {
  if (!clientId) {
    return { success: false, error: 'Client ID is required' };
  }

  if (!clientSecret) {
    return { success: false, error: 'Client secret is required' };
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64'
    );

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
      }).toString(),
    });

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok || data.error) {
      const errorMessage =
        (data.error as string) ||
        (data.message as string) ||
        `HTTP ${response.status}`;
      return {
        success: false,
        error: `Failed to get app-only token: ${errorMessage}`,
      };
    }

    const token: AppOnlyToken = {
      accessToken: data.access_token as string,
      tokenType: data.token_type as string,
      expiresIn: data.expires_in as number,
      scope: data.scope as string,
      expiresAt: Date.now() + (data.expires_in as number) * 1000,
    };

    return { success: true, token };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to get app-only token: ${message}` };
  }
}

/**
 * Check if an app-only token is expired or about to expire.
 *
 * @param token - The token to check
 * @param bufferMs - Buffer time in milliseconds (default 5 minutes)
 * @returns true if token is expired or will expire within buffer time
 */
export function isAppOnlyTokenExpired(
  token: AppOnlyToken,
  bufferMs = 5 * 60 * 1000
): boolean {
  return Date.now() >= token.expiresAt - bufferMs;
}

/**
 * Token manager for caching and auto-refreshing app-only tokens.
 */
export class AppOnlyTokenManager {
  private token: AppOnlyToken | null = null;
  private clientId: string;
  private clientSecret: string;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * Get a valid access token, fetching a new one if needed.
   * @returns Access token string or null on failure
   */
  async getAccessToken(): Promise<string | null> {
    if (this.token && !isAppOnlyTokenExpired(this.token)) {
      return this.token.accessToken;
    }

    const result = await getAppOnlyToken(this.clientId, this.clientSecret);

    if (!result.success) {
      console.error(`App-only auth error: ${result.error}`);
      return null;
    }

    this.token = result.token;
    return this.token.accessToken;
  }

  /**
   * Clear the cached token (for testing or logout).
   */
  clearToken(): void {
    this.token = null;
  }

  /**
   * Get the current token (if any).
   */
  getCurrentToken(): AppOnlyToken | null {
    return this.token;
  }
}
