# Reddit API: OAuth Fallback Integration

## Problem

When users authenticate with Reddit OAuth and try to access private subreddits or subreddits that require authentication, the public Reddit API (`www.reddit.com`) returns a 403 Forbidden error. This prevents authenticated users from accessing content they have permissions to view.

The existing implementation only used the public API endpoint and had no mechanism to leverage OAuth tokens for authenticated requests.

## Solution

Implemented an OAuth fallback mechanism in the Reddit client:

1. **Primary request**: First, try the public API (`www.reddit.com`)
2. **Fallback on 403**: If the public API returns 403 and an OAuth token is available, automatically switch to the OAuth API (`oauth.reddit.com`) with a Bearer token
3. **Sticky OAuth mode**: Once OAuth mode is activated, all subsequent requests in the same fetch operation use the OAuth endpoint

This approach ensures backward compatibility (public API works without authentication) while enabling access to private content for authenticated users.

## Changed Files

- `src/reddit.ts` — Added OAuth fallback logic:
  - New `TokenProvider` type for providing access tokens
  - `setTokenProvider()` function to configure the token provider
  - `resetOAuthMode()` helper for testing
  - Modified `fetchWithRetry()` to detect 403 errors and switch to OAuth
  - Modified URL building to support both public and OAuth endpoints
  - Added `Authorization: Bearer <token>` header for OAuth requests

- `src/reddit.test.ts` — Added 4 new test cases:
  - Falls back to OAuth when public API returns 403
  - Returns error when 403 and no token provider is set
  - Returns error when 403 and token provider returns null
  - Uses OAuth for all subsequent requests after fallback

## Usage

### Setting Up the Token Provider

```typescript
import { setTokenProvider } from './reddit.js';
import { getValidAccessToken } from './reddit-auth.js';

// Set up token provider before fetching data
setTokenProvider(async () => {
  return await getValidAccessToken();
});
```

### How It Works

1. When `fetchRedditData()` is called, it first tries the public API
2. If a 403 response is received:
   - Checks if a token provider is configured
   - Calls the token provider to get an access token
   - If a valid token is returned, switches to OAuth mode
   - Retries the request using `oauth.reddit.com` with `Authorization: Bearer <token>`
3. All subsequent requests in the same operation use OAuth

### Console Output

When fallback occurs, users see:
```
Public API returned 403, falling back to OAuth...
```

### API Endpoints

| Mode   | Base URL                    | Auth Header              |
|--------|----------------------------|--------------------------|
| Public | `https://www.reddit.com`   | None                     |
| OAuth  | `https://oauth.reddit.com` | `Bearer <access_token>`  |

## Integration with CLI

The CLI auth system (from issue `uvi.3`) integrates with this fallback:

```typescript
// In cli.ts, before analyzing a subreddit:
setTokenProvider(async () => {
  return await getValidAccessToken();
});
```

This ensures that if a user is logged in (`subreddit-insights auth login`), their OAuth token will be used when accessing private subreddits.
