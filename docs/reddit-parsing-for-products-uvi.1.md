# Config: модуль хранения credentials в ~/.config/subreddit-insights

## Problem

The application needed a way to persist OAuth credentials (access token, refresh token, expiration time) between CLI invocations. Without this, users would need to re-authenticate on every command, which is a poor user experience.

## Solution

Created a dedicated config module (`src/config.ts`) that handles reading and writing OAuth tokens to the user's config directory following XDG conventions.

Key features:
- **Secure storage**: Config file is created with `0600` permissions (owner read/write only), preventing other users from reading sensitive tokens
- **Standard location**: Uses `~/.config/subreddit-insights/config.json`, following Linux/macOS XDG Base Directory conventions
- **Graceful error handling**: Returns `null` on read errors instead of throwing, making it safe to call without try/catch
- **Auto-creates directories**: The `saveConfig` function creates the config directory if it doesn't exist

## Changed Files

- `src/config.ts` — New module with `loadConfig`, `saveConfig`, `clearConfig` functions and `Config` interface
- `src/config.test.ts` — Unit tests covering all functions and edge cases (11 tests)

## Usage

### TypeScript Interface

```typescript
interface Config {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;  // Unix timestamp in milliseconds
}
```

### Loading Config

```typescript
import { loadConfig } from './config.js';

const config = loadConfig();
if (config) {
  console.log('Access token:', config.accessToken);
  console.log('Expires at:', new Date(config.expiresAt));
} else {
  console.log('No saved config, need to authenticate');
}
```

### Saving Config

```typescript
import { saveConfig } from './config.js';

saveConfig({
  accessToken: 'your-access-token',
  refreshToken: 'your-refresh-token',
  expiresAt: Date.now() + 3600 * 1000,  // 1 hour from now
});
```

### Clearing Config (Logout)

```typescript
import { clearConfig } from './config.js';

const wasDeleted = clearConfig();
if (wasDeleted) {
  console.log('Logged out successfully');
} else {
  console.log('No config to clear');
}
```

### Getting Config Path

```typescript
import { getConfigPath } from './config.js';

console.log('Config stored at:', getConfigPath());
// Output: /home/user/.config/subreddit-insights/config.json
```

## Configuration

No environment variables needed. The config location is always:
- `~/.config/subreddit-insights/config.json`

## Security Considerations

- The config file is created with `0600` permissions, ensuring only the owner can read/write
- Tokens are stored as plain JSON — this is standard practice for CLI tools, similar to how `~/.aws/credentials` works
- Users should ensure their home directory has appropriate permissions
