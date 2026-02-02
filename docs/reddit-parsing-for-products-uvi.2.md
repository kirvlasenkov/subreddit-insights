# OAuth: Browser-based Authorization Module

## Problem

The subreddit-insights CLI tool needed authenticated access to Reddit's API to enable features that require user authorization. Reddit's public JSON API has limitations, and certain functionality (like accessing private subreddits or user-specific data) requires OAuth2 authentication.

The challenge was implementing the OAuth2 "web app flow" which requires:
- Opening a browser for user login
- Running a local HTTP server to receive the callback
- Securely exchanging authorization codes for tokens
- Managing token expiration and refresh

## Solution

Implemented a complete Reddit OAuth2 web app flow module (`src/reddit-auth.ts`) that handles the entire authentication lifecycle:

1. **Browser-based Authorization**: Opens the user's default browser to Reddit's authorization page
2. **Local Callback Server**: Starts an HTTP server on `localhost:8080` to receive the OAuth callback
3. **CSRF Protection**: Uses cryptographically secure random state strings to prevent CSRF attacks
4. **Token Exchange**: Exchanges authorization codes for access and refresh tokens
5. **Automatic Token Refresh**: Detects expired tokens and refreshes them automatically

## Changed Files

- `src/reddit-auth.ts` — New module implementing the complete OAuth2 flow:
  - `generateState()` — Creates secure random state for CSRF protection
  - `buildAuthorizationUrl()` — Constructs Reddit OAuth authorization URL
  - `exchangeCodeForTokens()` — Exchanges auth code for tokens
  - `refreshAccessToken()` — Refreshes expired access tokens
  - `openBrowser()` — Cross-platform browser opening (macOS, Windows, Linux)
  - `startCallbackServer()` — Local HTTP server for OAuth callback
  - `isTokenExpired()` — Checks if token needs refresh (5-minute buffer)
  - `authorizeReddit()` — Full authorization flow orchestration
  - `getValidAccessToken()` — Gets valid token, refreshing if needed

- `src/reddit-auth.test.ts` — Unit tests covering:
  - State generation (uniqueness, format)
  - Authorization URL construction
  - Token exchange (success, invalid code, network errors)
  - Token refresh (success, invalid token)
  - Configuration validation

## Usage

### Prerequisites

You need Reddit OAuth2 credentials:
1. Go to https://www.reddit.com/prefs/apps
2. Create a "web app"
3. Set redirect URI to `http://localhost:8080/callback`
4. Note your client ID and client secret

### Full Authorization Flow

```typescript
import { authorizeReddit, getValidAccessToken, RedditTokens } from './reddit-auth.js';

// Initial authorization (opens browser)
const result = await authorizeReddit('your-client-id', 'your-client-secret');

if (result.success) {
  console.log('Access token:', result.tokens.accessToken);
  // Store tokens for later use
}
```

### Refreshing Tokens

```typescript
import { getValidAccessToken, RedditTokens } from './reddit-auth.js';

// Get valid token (automatically refreshes if expired)
const result = await getValidAccessToken(
  storedTokens,
  'your-client-id',
  'your-client-secret'
);

if (result.success) {
  // Use result.tokens.accessToken for API calls
}
```

### Building Authorization URL Manually

```typescript
import { generateState, buildAuthorizationUrl } from './reddit-auth.js';

const state = generateState();
const authUrl = buildAuthorizationUrl('your-client-id', state);
// Direct user to authUrl
```

## Configuration

The module uses these defaults (defined in `REDDIT_OAUTH_CONFIG`):

| Setting | Value | Description |
|---------|-------|-------------|
| `callbackPort` | `8080` | Local server port for OAuth callback |
| `redirectUri` | `http://localhost:8080/callback` | Must match Reddit app settings |
| `scope` | `read` | Requested permissions |
| `authorizationUrl` | `https://www.reddit.com/api/v1/authorize` | Reddit OAuth endpoint |
| `tokenUrl` | `https://www.reddit.com/api/v1/access_token` | Token exchange endpoint |

## Token Structure

```typescript
interface RedditTokens {
  accessToken: string;   // Bearer token for API calls
  refreshToken: string;  // Used to get new access tokens
  expiresIn: number;     // Token lifetime in seconds (typically 86400)
  scope: string;         // Granted permissions
  tokenType: string;     // Always "bearer"
  expiresAt: number;     // Unix timestamp when token expires
}
```

## Security Features

- **CSRF Protection**: 64-character random hex state parameter
- **Secure Token Exchange**: Basic auth with Base64-encoded credentials
- **Token Expiration Buffer**: Tokens are refreshed 5 minutes before expiry
- **State Validation**: Callback server validates state to prevent attacks
- **Timeout Protection**: Callback server times out after 5 minutes if no response
