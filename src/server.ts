import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AppError extends Error {
  status?: number;
  code?: string;
}

export function createApp() {
  const app = express();

  // CORS middleware
  app.use(cors());

  // JSON parsing middleware
  app.use(express.json());

  // Static files middleware (serve from public folder)
  const publicPath = path.join(__dirname, '..', 'public');
  app.use(express.static(publicPath));

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Error handling middleware (must be last)
  app.use((err: AppError, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';

    console.error(`[Error] ${status}: ${message}`);
    if (err.stack) {
      console.error(err.stack);
    }

    res.status(status).json({
      error: {
        message,
        code: err.code,
      },
    });
  });

  return app;
}

export function startServer(port: number = 3000) {
  const app = createApp();

  const server = app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });

  return server;
}

// Start server if this file is run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const port = parseInt(process.env.PORT || '3000', 10);
  startServer(port);
}
