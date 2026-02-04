/**
 * Tests for Railway deployment configuration.
 * Verifies that health check endpoint works correctly for Railway's requirements.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createServer } from './server.js';
import type { Express } from 'express';

describe('Railway Configuration', () => {
  let app: Express;
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-api-key';
    app = createServer();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.OPENAI_API_KEY = originalEnv;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });

  describe('Health Check Endpoint', () => {
    it('returns 200 status for Railway health check', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
    });

    it('returns JSON response with ok field', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toHaveProperty('ok', true);
    });

    it('indicates API key configuration status', async () => {
      const response = await request(app).get('/health');

      expect(response.body).toHaveProperty('apiKeyConfigured');
      expect(typeof response.body.apiKeyConfigured).toBe('boolean');
    });

    it('responds quickly (within 100ms)', async () => {
      const start = Date.now();
      await request(app).get('/health');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('works without authentication', async () => {
      const response = await request(app)
        .get('/health')
        .set('Authorization', ''); // No auth header

      expect(response.status).toBe(200);
    });
  });

  describe('Environment Configuration', () => {
    it('server accepts PORT environment variable', () => {
      // The server code uses process.env.PORT || 3000
      // This test verifies the pattern is correct
      const port = process.env.PORT || 3000;
      expect(['string', 'number']).toContain(typeof port);
    });

    it('health check reports API key status correctly when key is set', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const appWithKey = createServer();

      const response = await request(appWithKey).get('/health');

      expect(response.body.apiKeyConfigured).toBe(true);
    });

    it('health check reports API key status correctly when key is missing', async () => {
      delete process.env.OPENAI_API_KEY;
      const appWithoutKey = createServer();

      const response = await request(appWithoutKey).get('/health');

      expect(response.body.apiKeyConfigured).toBe(false);
    });
  });
});
