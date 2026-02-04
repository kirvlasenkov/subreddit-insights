import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createServer } from './server.js';
import type { Express } from 'express';

// Mock the dependencies
vi.mock('./reddit.js', () => ({
  fetchRedditData: vi.fn(),
}));

vi.mock('./llm.js', () => ({
  analyzeWithLLM: vi.fn(),
}));

import { fetchRedditData } from './reddit.js';
import { analyzeWithLLM } from './llm.js';

const mockFetchRedditData = vi.mocked(fetchRedditData);
const mockAnalyzeWithLLM = vi.mocked(analyzeWithLLM);

describe('Server', () => {
  let app: Express;
  let originalEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
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

  describe('GET /health', () => {
    it('returns ok status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        apiKeyConfigured: true,
      });
    });

    it('indicates when API key is not configured', async () => {
      delete process.env.OPENAI_API_KEY;
      const appWithoutKey = createServer();

      const response = await request(appWithoutKey).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.apiKeyConfigured).toBe(false);
    });
  });

  describe('POST /api/analyze', () => {
    it('returns 400 when subreddit is missing', async () => {
      const response = await request(app)
        .post('/api/analyze')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('returns 400 when subreddit is empty string', async () => {
      const response = await request(app)
        .post('/api/analyze')
        .send({ subreddit: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('returns 400 when subreddit name is invalid', async () => {
      const response = await request(app)
        .post('/api/analyze')
        .send({ subreddit: 'a' }); // Too short

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('2-21 characters');
    });

    it('returns 400 for invalid period', async () => {
      const response = await request(app)
        .post('/api/analyze')
        .send({ subreddit: 'startups', period: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid period');
    });

    it('returns 500 when API key is not configured', async () => {
      delete process.env.OPENAI_API_KEY;
      const appWithoutKey = createServer();

      const response = await request(appWithoutKey)
        .post('/api/analyze')
        .send({ subreddit: 'startups' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('API key');
    });

    it('returns 400 when Reddit fetch fails', async () => {
      mockFetchRedditData.mockResolvedValue({
        success: false,
        error: 'Subreddit not found.',
      });

      const response = await request(app)
        .post('/api/analyze')
        .send({ subreddit: 'nonexistent123' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('returns 500 when LLM analysis fails', async () => {
      mockFetchRedditData.mockResolvedValue({
        success: true,
        data: {
          subreddit: 'startups',
          posts: [{ id: '1', title: 'Test', selftext: '', author: 'user', score: 10, numComments: 5, createdUtc: Date.now() / 1000, url: '', permalink: '' }],
          comments: new Map([['1', []]]),
        },
      });

      mockAnalyzeWithLLM.mockResolvedValue({
        success: false,
        error: 'API rate limit exceeded',
      });

      const response = await request(app)
        .post('/api/analyze')
        .send({ subreddit: 'startups' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('rate limit');
    });

    it('returns successful analysis result', async () => {
      const mockAnalysis = {
        tldr: 'Test summary',
        pains: [{ description: 'Test pain', frequency: 'high' as const, mentionCount: 5, evidence: ['quote 1'] }],
        desires: [],
        patterns: [],
        quotes: [],
        userLanguage: { commonTerms: [], tone: 'neutral', emotionalPatterns: [] },
        hypotheses: [],
      };

      mockFetchRedditData.mockResolvedValue({
        success: true,
        data: {
          subreddit: 'startups',
          posts: [
            { id: '1', title: 'Test Post', selftext: 'Content', author: 'user1', score: 100, numComments: 10, createdUtc: Date.now() / 1000, url: '', permalink: '' },
            { id: '2', title: 'Another Post', selftext: '', author: 'user2', score: 50, numComments: 5, createdUtc: Date.now() / 1000, url: '', permalink: '' },
          ],
          comments: new Map([
            ['1', [{ id: 'c1', body: 'Comment', author: 'commenter', score: 5, createdUtc: Date.now() / 1000, postId: '1', parentId: 't3_1', replies: [] }]],
            ['2', []],
          ]),
        },
      });

      mockAnalyzeWithLLM.mockResolvedValue({
        success: true,
        analysis: mockAnalysis,
      });

      const response = await request(app)
        .post('/api/analyze')
        .send({ subreddit: 'startups', period: '30d', limit: 50 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.subreddit).toBe('startups');
      expect(response.body.data.postsAnalyzed).toBe(2);
      expect(response.body.data.totalComments).toBe(1);
      expect(response.body.data.analysis).toEqual(mockAnalysis);
    });

    it('accepts r/subreddit format', async () => {
      mockFetchRedditData.mockResolvedValue({
        success: true,
        data: {
          subreddit: 'startups',
          posts: [],
          comments: new Map(),
        },
      });

      mockAnalyzeWithLLM.mockResolvedValue({
        success: true,
        analysis: {
          tldr: '',
          pains: [],
          desires: [],
          patterns: [],
          quotes: [],
          userLanguage: { commonTerms: [], tone: '', emotionalPatterns: [] },
          hypotheses: [],
        },
      });

      const response = await request(app)
        .post('/api/analyze')
        .send({ subreddit: 'r/startups' });

      expect(response.status).toBe(200);
      expect(mockFetchRedditData).toHaveBeenCalledWith('startups', expect.any(Object));
    });

    it('uses default values for period and limit', async () => {
      mockFetchRedditData.mockResolvedValue({
        success: true,
        data: { subreddit: 'startups', posts: [], comments: new Map() },
      });

      mockAnalyzeWithLLM.mockResolvedValue({
        success: true,
        analysis: { tldr: '', pains: [], desires: [], patterns: [], quotes: [], userLanguage: { commonTerms: [], tone: '', emotionalPatterns: [] }, hypotheses: [] },
      });

      await request(app)
        .post('/api/analyze')
        .send({ subreddit: 'startups' });

      expect(mockFetchRedditData).toHaveBeenCalledWith('startups', {
        period: '30d',
        limit: 50,
      });
    });

    it('caps limit at 500', async () => {
      mockFetchRedditData.mockResolvedValue({
        success: true,
        data: { subreddit: 'startups', posts: [], comments: new Map() },
      });

      mockAnalyzeWithLLM.mockResolvedValue({
        success: true,
        analysis: { tldr: '', pains: [], desires: [], patterns: [], quotes: [], userLanguage: { commonTerms: [], tone: '', emotionalPatterns: [] }, hypotheses: [] },
      });

      await request(app)
        .post('/api/analyze')
        .send({ subreddit: 'startups', limit: 1000 });

      expect(mockFetchRedditData).toHaveBeenCalledWith('startups', expect.objectContaining({
        limit: 500,
      }));
    });

    it('sets minimum limit to 1', async () => {
      mockFetchRedditData.mockResolvedValue({
        success: true,
        data: { subreddit: 'startups', posts: [], comments: new Map() },
      });

      mockAnalyzeWithLLM.mockResolvedValue({
        success: true,
        analysis: { tldr: '', pains: [], desires: [], patterns: [], quotes: [], userLanguage: { commonTerms: [], tone: '', emotionalPatterns: [] }, hypotheses: [] },
      });

      await request(app)
        .post('/api/analyze')
        .send({ subreddit: 'startups', limit: -5 });

      expect(mockFetchRedditData).toHaveBeenCalledWith('startups', expect.objectContaining({
        limit: 1,
      }));
    });

    it('counts nested comments correctly', async () => {
      mockFetchRedditData.mockResolvedValue({
        success: true,
        data: {
          subreddit: 'startups',
          posts: [{ id: '1', title: 'Test', selftext: '', author: 'user', score: 10, numComments: 5, createdUtc: Date.now() / 1000, url: '', permalink: '' }],
          comments: new Map([
            ['1', [
              {
                id: 'c1', body: 'Parent comment', author: 'a', score: 5, createdUtc: 1, postId: '1', parentId: 't3_1',
                replies: [
                  {
                    id: 'c2', body: 'Reply', author: 'b', score: 2, createdUtc: 2, postId: '1', parentId: 't1_c1',
                    replies: [
                      { id: 'c3', body: 'Nested reply', author: 'c', score: 1, createdUtc: 3, postId: '1', parentId: 't1_c2', replies: [] }
                    ]
                  }
                ]
              }
            ]]
          ]),
        },
      });

      mockAnalyzeWithLLM.mockResolvedValue({
        success: true,
        analysis: { tldr: '', pains: [], desires: [], patterns: [], quotes: [], userLanguage: { commonTerms: [], tone: '', emotionalPatterns: [] }, hypotheses: [] },
      });

      const response = await request(app)
        .post('/api/analyze')
        .send({ subreddit: 'startups' });

      expect(response.status).toBe(200);
      expect(response.body.data.totalComments).toBe(3); // 1 parent + 1 reply + 1 nested reply
    });
  });
});
