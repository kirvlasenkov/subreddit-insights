/**
 * Express server for Reddit Insights web service.
 * Provides API endpoints and serves static frontend files.
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSubreddit } from './subreddit.js';
import { fetchRedditData, type FetchOptions } from './reddit.js';
import { analyzeWithLLM, type AnalysisResult } from './llm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AnalyzeRequest {
  subreddit: string;
  period?: FetchOptions['period'];
  limit?: number;
}

export interface AnalyzeResponse {
  success: boolean;
  data?: {
    subreddit: string;
    postsAnalyzed: number;
    totalComments: number;
    analysis: AnalysisResult;
  };
  error?: string;
}

// Count total comments including replies
function countComments(comments: Array<{ replies: unknown[] }>): number {
  let count = comments.length;
  for (const comment of comments) {
    if (Array.isArray(comment.replies)) {
      count += countComments(comment.replies as Array<{ replies: unknown[] }>);
    }
  }
  return count;
}

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Serve static files from public directory
  const publicPath = path.join(__dirname, '..', 'public');
  app.use(express.static(publicPath));

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      apiKeyConfigured: !!process.env.OPENAI_API_KEY,
    });
  });

  // Main analysis endpoint
  app.post('/api/analyze', async (req: Request, res: Response) => {
    try {
      const { subreddit: input, period = '30d', limit = 50 } = req.body as AnalyzeRequest;

      // Validate input
      if (!input || typeof input !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Subreddit name is required',
        } as AnalyzeResponse);
        return;
      }

      // Parse subreddit name
      const parseResult = parseSubreddit(input);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          error: parseResult.error,
        } as AnalyzeResponse);
        return;
      }

      const subreddit = parseResult.subreddit;

      // Validate options
      const validPeriods = ['7d', '30d', '90d', '180d'];
      if (!validPeriods.includes(period)) {
        res.status(400).json({
          success: false,
          error: `Invalid period. Must be one of: ${validPeriods.join(', ')}`,
        } as AnalyzeResponse);
        return;
      }

      const parsedLimit = Math.min(Math.max(1, Number(limit) || 50), 500);

      // Check API key
      if (!process.env.OPENAI_API_KEY) {
        res.status(500).json({
          success: false,
          error: 'OpenAI API key is not configured on the server',
        } as AnalyzeResponse);
        return;
      }

      // Fetch Reddit data
      const fetchResult = await fetchRedditData(subreddit, {
        period: period as FetchOptions['period'],
        limit: parsedLimit,
      });

      if (!fetchResult.success) {
        res.status(400).json({
          success: false,
          error: fetchResult.error,
        } as AnalyzeResponse);
        return;
      }

      // Calculate total comments
      let totalComments = 0;
      for (const comments of fetchResult.data.comments.values()) {
        totalComments += countComments(comments as Array<{ replies: unknown[] }>);
      }

      // Run LLM analysis
      const analysisResult = await analyzeWithLLM(fetchResult.data);

      if (!analysisResult.success) {
        res.status(500).json({
          success: false,
          error: analysisResult.error,
        } as AnalyzeResponse);
        return;
      }

      // Return successful response
      res.json({
        success: true,
        data: {
          subreddit,
          postsAnalyzed: fetchResult.data.posts.length,
          totalComments,
          analysis: analysisResult.analysis,
        },
      } as AnalyzeResponse);
    } catch (error) {
      console.error('Analysis error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      } as AnalyzeResponse);
    }
  });

  // Error handling middleware
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  });

  // Fallback to index.html for SPA routing (Express 5 syntax)
  app.get('/{*path}', (_req: Request, res: Response) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });

  return app;
}

// Start server if run directly
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const port = process.env.PORT || 3000;
  const app = createServer();

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`OpenAI API key: ${process.env.OPENAI_API_KEY ? 'configured' : 'NOT configured'}`);
  });
}
