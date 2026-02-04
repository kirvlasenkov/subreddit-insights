# Express Server: Basic Structure and Middleware

**Issue ID:** `reddit-parsing-for-products-4lu.2`
**Type:** Task
**Parent Epic:** `reddit-parsing-for-products-4lu` (Web Service for Subreddit Analysis)

## Problem

The CLI tool `subreddit-insights` needed to be expanded into a web service to provide subreddit analysis through an HTTP API. This required creating a foundational Express server with essential middleware and infrastructure before adding API endpoints.

## Solution

Created an Express server with modular architecture, including:

1. **CORS Middleware** — Allows cross-origin requests from any domain
2. **JSON Parsing** — Parses incoming JSON request bodies
3. **Static Files** — Serves files from the `public/` directory
4. **Error Handling** — Centralized error handler with structured JSON responses
5. **Health Check Endpoint** — `/health` endpoint for monitoring

The server uses a factory function pattern (`createApp()`) to make testing easier and allow multiple instances if needed.

## Changed Files

- `src/server.ts` — Main server module with `createApp()` and `startServer()` functions
- `src/server.test.ts` — Comprehensive tests for all middleware and endpoints
- `package.json` — Added dependencies (express, cors) and npm scripts
- `public/.gitkeep` — Placeholder to ensure the public directory exists

## New Dependencies

```json
{
  "dependencies": {
    "express": "^5.2.1",
    "cors": "^2.8.6"
  },
  "devDependencies": {
    "@types/express": "^5.0.6",
    "@types/cors": "^2.8.19",
    "@types/supertest": "^6.0.3",
    "supertest": "^7.2.2"
  }
}
```

## Usage

### Running the Server

```bash
# Development mode (with hot reload via tsx)
npm run server

# Production mode (requires build first)
npm run build
npm run server:build
```

### Configuration

The server port can be configured via environment variable:

```bash
PORT=8080 npm run server
```

Default port is `3000`.

### Health Check

```bash
curl http://localhost:3000/health
# Response: {"status":"ok"}
```

### Static Files

Place any static files in the `public/` directory and they will be served at the root path:

```
public/
  index.html    -> http://localhost:3000/index.html
  styles.css    -> http://localhost:3000/styles.css
```

### Programmatic Usage

The server exports two functions for programmatic use:

```typescript
import { createApp, startServer } from './server.js';

// Create Express app without starting the server
const app = createApp();

// Start server on specific port
const server = startServer(8080);
```

### Error Handling

Errors thrown in route handlers are caught by the error middleware and returned as JSON:

```typescript
// In a route handler:
const error: AppError = new Error('Something went wrong');
error.status = 400;
error.code = 'VALIDATION_ERROR';
next(error);

// Response:
// HTTP 400
// {
//   "error": {
//     "message": "Something went wrong",
//     "code": "VALIDATION_ERROR"
//   }
// }
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Express App                     │
├─────────────────────────────────────────────────┤
│  Middleware Stack (in order):                   │
│  1. CORS                                        │
│  2. JSON Body Parser                            │
│  3. Static Files (public/)                      │
│  4. Routes (/health, future API routes)         │
│  5. Error Handler (must be last)                │
└─────────────────────────────────────────────────┘
```

## Testing

All middleware and functionality is tested using `supertest`:

```bash
npm test
```

Tests cover:
- CORS headers and preflight requests
- JSON body parsing
- Health check endpoint
- Static file serving
- Error handling with custom status codes
- Server startup on configurable port
