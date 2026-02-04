# Application-Only OAuth: Authorization Module Without User Login

## Problem

The subreddit-insights CLI tool needed a way to authenticate with Reddit's API using OAuth without requiring users to log in with their Reddit account. The public JSON API has limitations, and authenticated requests provide:
- Higher rate limits (100 req/min vs lower limits for anonymous)
- More reliable access to Reddit data
- Required for future web service implementation

Reddit supports "Application-Only OAuth" using the `client_credentials` grant type, which allows applications to access public data without user authentication.

## Solution

Implemented an Application-Only OAuth module (`src/app-only-auth.ts`) that:

1. **`getAppOnlyToken(clientId, clientSecret)`** - Fetches an access token from Reddit using client credentials
   - Makes POST request to `https://www.reddit.com/api/v1/access_token`
   - Uses Basic authentication with base64-encoded credentials
   - Returns a typed result with either success + token or error message

2. **`isAppOnlyTokenExpired(token, bufferMs?)`** - Checks if a token is expired or about to expire
   - Default buffer of 5 minutes to allow proactive refresh
   - Customizable buffer time

3. **`AppOnlyTokenManager`** class - Manages token lifecycle with caching and auto-refresh
   - Caches token in memory
   - Automatically fetches new token when expired
   - Provides `clearToken()` for testing/logout scenarios

## Changed Files

- `src/app-only-auth.ts` — New module with OAuth implementation
- `src/app-only-auth.test.ts` — Comprehensive unit tests (15 test cases)

## Usage

### Direct Token Fetching

```typescript
import { getAppOnlyToken } from './app-only-auth.js';

const result = await getAppOnlyToken(
  process.env.REDDIT_CLIENT_ID,
  process.env.REDDIT_CLIENT_SECRET
);

if (result.success) {
  console.log('Access token:', result.token.accessToken);
  console.log('Expires at:', new Date(result.token.expiresAt));
} else {
  console.error('Error:', result.error);
}
```

### Using Token Manager (Recommended)

```typescript
import { AppOnlyTokenManager } from './app-only-auth.js';

const tokenManager = new AppOnlyTokenManager(
  process.env.REDDIT_CLIENT_ID,
  process.env.REDDIT_CLIENT_SECRET
);

// Get a valid token (fetches new one if needed)
const accessToken = await tokenManager.getAccessToken();

if (accessToken) {
  // Use token for authenticated requests
  const response = await fetch('https://oauth.reddit.com/r/programming/hot', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': 'your-app/1.0.0'
    }
  });
}
```

### Checking Token Expiry

```typescript
import { isAppOnlyTokenExpired, AppOnlyToken } from './app-only-auth.js';

const token: AppOnlyToken = /* ... */;

// Check with default 5-minute buffer
if (isAppOnlyTokenExpired(token)) {
  console.log('Token needs refresh');
}

// Check with custom 1-minute buffer
if (isAppOnlyTokenExpired(token, 60 * 1000)) {
  console.log('Token needs refresh (1-min buffer)');
}
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REDDIT_CLIENT_ID` | Yes | Reddit app client ID from [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps) |
| `REDDIT_CLIENT_SECRET` | Yes | Reddit app client secret |

### Creating Reddit App Credentials

1. Go to [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps)
2. Click "create another app..."
3. Choose "script" type for CLI tools or "web app" for web services
4. Note the client ID (under app name) and client secret

## API Response Types

```typescript
interface AppOnlyToken {
  accessToken: string;   // Bearer token for API requests
  tokenType: string;     // Usually "bearer"
  expiresIn: number;     // Seconds until expiry (typically 86400 = 24h)
  scope: string;         // Granted scopes (usually "*" for app-only)
  expiresAt: number;     // Unix timestamp when token expires
}

type GetAppOnlyTokenResult =
  | { success: true; token: AppOnlyToken }
  | { success: false; error: string };
```

## Rate Limits

With Application-Only OAuth, the rate limit is **100 requests per minute** per client ID. This is significantly higher than anonymous access and sufficient for most use cases.
