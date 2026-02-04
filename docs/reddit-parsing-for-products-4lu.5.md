# Railway Deployment Configuration

## Overview

This feature adds Railway deployment configuration to the subreddit-insights web service, enabling seamless deployment to Railway.app platform.

## Changes

### New Files

- `railway.json` - Railway deployment configuration
- `src/railway.test.ts` - Tests for Railway health check requirements

### Modified Files

- `package.json` - Added `server:prod` script and `public` folder to files
- `.env.example` - Documented all required environment variables

## Railway Configuration

### railway.json

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run server:prod",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### Environment Variables

Configure these in Railway dashboard:

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for GPT analysis |
| `REDDIT_CLIENT_ID` | No | Reddit app client ID (for higher rate limits) |
| `REDDIT_CLIENT_SECRET` | No | Reddit app client secret |
| `PORT` | No | Server port (auto-set by Railway) |

### Health Check Endpoint

- **Path:** `/health`
- **Method:** GET
- **Response:**
  ```json
  {
    "ok": true,
    "apiKeyConfigured": true
  }
  ```

## Deployment Steps

1. Push code to GitHub repository
2. Connect repository to Railway
3. Configure environment variables in Railway dashboard
4. Railway auto-detects `railway.json` and deploys

## Testing

Run tests with:
```bash
npm test
```

Railway-specific tests verify:
- Health check returns 200 status
- JSON response format is correct
- Endpoint responds quickly (< 100ms)
- API key status is reported correctly

## Related Issues

- Parent epic: `reddit-parsing-for-products-4lu` (Web Service for subreddit analysis)
- Prerequisites: `4lu.2` (Express server), `4lu.3` (HTML frontend)
