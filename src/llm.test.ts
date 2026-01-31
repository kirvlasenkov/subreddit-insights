import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RedditData, RedditPost, RedditComment } from './reddit.js';

// Mock the OpenAI module before importing the module under test
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    })),
  };
});

// Import after mocking
import { analyzeWithLLM, getEmptyAnalysis } from './llm.js';
import OpenAI from 'openai';

// Helper to create mock data
function createMockRedditData(postCount: number): RedditData {
  const posts: RedditPost[] = [];
  const comments = new Map<string, RedditComment[]>();

  for (let i = 0; i < postCount; i++) {
    const post: RedditPost = {
      id: `post${i}`,
      title: `Test Post ${i}`,
      selftext: `This is the content of test post ${i}. It contains some text for analysis.`,
      author: `user${i}`,
      score: 100 + i * 10,
      numComments: 5,
      createdUtc: Date.now() / 1000 - i * 3600,
      url: `https://reddit.com/r/test/post${i}`,
      permalink: `https://www.reddit.com/r/test/post${i}`,
    };
    posts.push(post);

    const postComments: RedditComment[] = [
      {
        id: `comment${i}_1`,
        body: `This is a helpful comment on post ${i}. I really like this feature!`,
        author: `commenter${i}`,
        score: 50,
        createdUtc: Date.now() / 1000,
        postId: `post${i}`,
        parentId: `t3_post${i}`,
        replies: [],
      },
    ];
    comments.set(`post${i}`, postComments);
  }

  return {
    subreddit: 'test',
    posts,
    comments,
  };
}

// Sample valid analysis response
const validAnalysisResponse = JSON.stringify({
  tldr: 'Test summary of insights',
  pains: [
    {
      description: 'Users struggle with feature X',
      frequency: 'high',
      mentionCount: 10,
      evidence: ['Quote 1', 'Quote 2'],
    },
  ],
  desires: [],
  patterns: [
    {
      name: 'Pattern A',
      description: 'Users frequently do X before Y',
      occurrences: 15,
    },
  ],
  quotes: [
    {
      text: 'This is an insightful quote',
      context: 'discussing feature requests',
      author: 'user123',
      score: 42,
    },
  ],
  userLanguage: {
    commonTerms: ['term1', 'term2'],
    tone: 'enthusiastic but frustrated',
    emotionalPatterns: ['seeking validation', 'venting frustration'],
  },
  hypotheses: [
    {
      statement: 'Users who struggle with X would benefit from Y because Z',
      confidence: 'medium',
      supportingEvidence: ['Evidence 1'],
    },
  ],
});

describe('analyzeWithLLM', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return error when API key is not set', async () => {
    delete process.env.OPENAI_API_KEY;

    const data = createMockRedditData(1);
    const result = await analyzeWithLLM(data);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('OPENAI_API_KEY');
    }
  });

  it('should successfully analyze small dataset', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: validAnalysisResponse } }],
    });

    vi.mocked(OpenAI).mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    }) as unknown as OpenAI);

    const data = createMockRedditData(5);
    const result = await analyzeWithLLM(data);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.analysis.pains).toHaveLength(1);
      expect(result.analysis.pains[0].description).toBe('Users struggle with feature X');
      expect(result.analysis.patterns).toHaveLength(1);
      expect(result.analysis.quotes).toHaveLength(1);
      expect(result.analysis.hypotheses).toHaveLength(1);
    }
  });

  it('should handle JSON wrapped in markdown code blocks', async () => {
    const wrappedResponse = '```json\n' + validAnalysisResponse + '\n```';
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: wrappedResponse } }],
    });

    vi.mocked(OpenAI).mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    }) as unknown as OpenAI);

    const data = createMockRedditData(3);
    const result = await analyzeWithLLM(data);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.analysis.pains).toHaveLength(1);
    }
  });

  it('should handle API errors gracefully', async () => {
    const mockCreate = vi.fn().mockRejectedValue(new Error('API rate limit exceeded'));

    vi.mocked(OpenAI).mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    }) as unknown as OpenAI);

    const data = createMockRedditData(2);
    const result = await analyzeWithLLM(data);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('API rate limit exceeded');
    }
  });

  it('should handle unexpected response format', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    vi.mocked(OpenAI).mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    }) as unknown as OpenAI);

    const data = createMockRedditData(2);
    const result = await analyzeWithLLM(data);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Unexpected response format');
    }
  });

  it('should handle malformed JSON in response', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '{ invalid json }' } }],
    });

    vi.mocked(OpenAI).mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    }) as unknown as OpenAI);

    const data = createMockRedditData(2);
    const result = await analyzeWithLLM(data);

    expect(result.success).toBe(false);
  });
});

describe('getEmptyAnalysis', () => {
  it('should return empty analysis structure', () => {
    const empty = getEmptyAnalysis();

    expect(empty.pains).toEqual([]);
    expect(empty.patterns).toEqual([]);
    expect(empty.quotes).toEqual([]);
    expect(empty.userLanguage.commonTerms).toEqual([]);
    expect(empty.userLanguage.tone).toBe('unknown');
    expect(empty.userLanguage.emotionalPatterns).toEqual([]);
    expect(empty.hypotheses).toEqual([]);
  });
});
