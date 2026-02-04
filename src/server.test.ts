import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createApp, startServer, type AppError } from './server.js';
import type { Express } from 'express';
import type { Server } from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('createApp', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  describe('CORS middleware', () => {
    it('should include CORS headers in response', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:8080');

      expect(response.headers['access-control-allow-origin']).toBe('*');
    });

    it('should handle OPTIONS preflight requests', async () => {
      const response = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:8080')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(204);
    });
  });

  describe('JSON parsing middleware', () => {
    it('should parse JSON body correctly', async () => {
      // Add a test endpoint that echoes the body
      app.post('/test-json', (req, res) => {
        res.json({ received: req.body });
      });

      const testData = { message: 'Hello, World!' };
      const response = await request(app)
        .post('/test-json')
        .send(testData)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.received).toEqual(testData);
    });

    it('should handle empty JSON body', async () => {
      app.post('/test-empty-json', (req, res) => {
        res.json({ received: req.body });
      });

      const response = await request(app)
        .post('/test-empty-json')
        .send({})
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.received).toEqual({});
    });
  });

  describe('Health check endpoint', () => {
    it('should return ok status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('Static files middleware', () => {
    const publicDir = path.join(__dirname, '..', 'public');
    const testFile = path.join(publicDir, 'test-static.txt');

    beforeAll(() => {
      // Create a test static file
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      fs.writeFileSync(testFile, 'Static file content');
    });

    afterAll(() => {
      // Clean up test file
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });

    it('should serve static files from public folder', async () => {
      const response = await request(app).get('/test-static.txt');

      expect(response.status).toBe(200);
      expect(response.text).toBe('Static file content');
    });

    it('should return 404 for non-existent static files', async () => {
      const response = await request(app).get('/non-existent-file.txt');

      expect(response.status).toBe(404);
    });
  });
});

describe('Error handling middleware', () => {
  it('should handle errors with custom status code', async () => {
    // Create a fresh app with test route registered before error handler
    const testApp = express();
    testApp.use(cors());
    testApp.use(express.json());

    // Add test route
    testApp.get('/test-error', (_req: Request, _res: Response, next: NextFunction) => {
      const error: AppError = new Error('Custom error message');
      error.status = 400;
      error.code = 'CUSTOM_ERROR';
      next(error);
    });

    // Error handler at the end
    testApp.use((err: AppError, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || 500;
      res.status(status).json({
        error: {
          message: err.message || 'Internal Server Error',
          code: err.code,
        },
      });
    });

    const response = await request(testApp).get('/test-error');

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Custom error message');
    expect(response.body.error.code).toBe('CUSTOM_ERROR');
  });

  it('should default to 500 status for errors without status', async () => {
    // Create a fresh app with test route registered before error handler
    const testApp = express();
    testApp.use(cors());
    testApp.use(express.json());

    // Add test route
    testApp.get('/test-error-500', (_req: Request, _res: Response, next: NextFunction) => {
      next(new Error('Server error'));
    });

    // Error handler at the end
    testApp.use((err: AppError, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || 500;
      res.status(status).json({
        error: {
          message: err.message || 'Internal Server Error',
          code: err.code,
        },
      });
    });

    const response = await request(testApp).get('/test-error-500');

    expect(response.status).toBe(500);
    expect(response.body.error.message).toBe('Server error');
  });
});

describe('startServer', () => {
  let server: Server;

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  it('should start server on specified port', async () => {
    const testPort = 3456;
    server = startServer(testPort);

    // Give the server a moment to start
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await request(`http://localhost:${testPort}`).get('/health');
    expect(response.status).toBe(200);
  });
});
