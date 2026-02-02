# CLI: Auth Command

## Problem

The Reddit OAuth2 module (`reddit-auth.ts`) implemented in the previous issue provided the core functionality for authentication, but there was no way for users to actually use it from the command line. Users needed a simple CLI interface to:

- Log in to Reddit and save their credentials
- Log out and clear saved credentials
- Check their current authentication status

Without this, the OAuth functionality remained inaccessible to end users of the CLI tool.

## Solution

Added a new `auth` command to the CLI with three subcommands:

1. **`auth login`** — Opens browser for Reddit OAuth flow, saves tokens to config file
2. **`auth logout`** — Clears saved credentials from the config file
3. **`auth status`** — Shows current authentication state (logged in/out, token validity)

The implementation connects the OAuth module (`reddit-auth.ts`) with the config module (`config.ts`) through a new auth module (`auth.ts`) that provides a clean API for the CLI.

## Changed Files

- `src/auth.ts` — New module providing auth command logic:
  - `authLogin(clientId, clientSecret)` — Performs OAuth flow and saves tokens
  - `authLogout()` — Clears saved credentials
  - `authStatus()` — Returns current authentication state with token validity

- `src/auth.test.ts` — Unit tests for auth module covering:
  - Login with valid/invalid credentials
  - Logout when logged in vs already logged out
  - Status checks for logged in, logged out, and expired tokens

- `src/cli.ts` — Added `auth` command with subcommands:
  - `auth login --client-id <id> --client-secret <secret>`
  - `auth logout`
  - `auth status`

## Usage

### Prerequisites

You need Reddit OAuth2 credentials:
1. Go to https://www.reddit.com/prefs/apps
2. Create a "web app"
3. Set redirect URI to `http://localhost:8080/callback`
4. Note your client ID and client secret

### Login

```bash
subreddit-insights auth login --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET
```

This opens your browser for Reddit authorization. After you approve, the tokens are saved automatically.

Output on success:
```
Successfully logged in to Reddit!
```

### Check Status

```bash
subreddit-insights auth status
```

Output when logged in:
```
Logged in to Reddit.
Token valid until: 2/4/2026, 10:30:00 AM
```

Output when not logged in:
```
Not logged in to Reddit.

To login, run:
  subreddit-insights auth login --client-id <id> --client-secret <secret>
```

### Logout

```bash
subreddit-insights auth logout
```

Output:
```
Successfully logged out from Reddit.
```

## Architecture

The auth flow works as follows:

```
CLI (cli.ts)
    ↓
Auth Module (auth.ts)
    ↓
┌───────────┬───────────┐
│           │           │
OAuth       Config
(reddit-auth.ts)  (config.ts)
    │           │
    ↓           ↓
Browser     ~/.subreddit-insights/config.json
```

## Result Types

The auth module returns typed results for each operation:

```typescript
interface AuthSuccessResult {
  success: true;
  message: string;
}

interface AuthErrorResult {
  success: false;
  error: string;
}

interface AuthStatusResult {
  success: true;
  loggedIn: boolean;
  tokenValid: boolean;
  expiresAt?: number;  // Unix timestamp
}
```

## Token Validity

The status command shows whether the saved token is still valid. Tokens are considered expired 5 minutes before their actual expiration time (buffer for API calls). Expired tokens will be automatically refreshed on next use.
