import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchRedditData, DEFAULT_OPTIONS } from './reddit.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Helper to create mock Reddit API responses
function createMockPostsResponse(posts: Array<{ id: string; title: string; score: number }>) {
  return {
    data: {
      children: posts.map((p) => ({
        kind: 't3',
        data: {
          id: p.id,
          title: p.title,
          selftext: 'Test content',
          author: 'testuser',
          score: p.score,
          num_comments: 5,
          created_utc: Date.now() / 1000 - 86400, // 1 day ago
          url: `https://reddit.com/r/test/${p.id}`,
          permalink: `/r/test/comments/${p.id}/test`,
        },
      })),
      after: null,
    },
  };
}

function createMockCommentsResponse(comments: Array<{ id: string; body: string }>) {
  return [
    { data: {} }, // First element is the post
    {
      data: {
        children: comments.map((c) => ({
          kind: 't1',
          data: {
            id: c.id,
            body: c.body,
            author: 'commenter',
            score: 10,
            created_utc: Date.now() / 1000,
            parent_id: 't3_abc123',
            replies: '',
          },
        })),
      },
    },
  ];
}

describe('Reddit API', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Speed up tests by reducing console output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchRedditData', () => {
    it('fetches posts and comments successfully', async () => {
      const postsResponse = createMockPostsResponse([
        { id: 'post1', title: 'Test Post 1', score: 100 },
        { id: 'post2', title: 'Test Post 2', score: 50 },
      ]);

      const commentsResponse = createMockCommentsResponse([
        { id: 'comment1', body: 'Great post!' },
      ]);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(postsResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(commentsResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(commentsResponse),
        });

      const result = await fetchRedditData('test', { period: '7d', limit: 2 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.subreddit).toBe('test');
        expect(result.data.posts).toHaveLength(2);
        expect(result.data.posts[0].title).toBe('Test Post 1');
        expect(result.data.comments.size).toBe(2);
      }
    });

    it('handles 404 error for non-existent subreddit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await fetchRedditData('nonexistent_subreddit_12345', DEFAULT_OPTIONS);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('not found');
      }
    });

    it('handles 403 error for private subreddit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      const result = await fetchRedditData('privatesubreddit', DEFAULT_OPTIONS);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('private or banned');
      }
    });

    it('retries on network error', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(createMockPostsResponse([])),
        });

      const result = await fetchRedditData('test', { period: '7d', limit: 1 });

      // Should succeed after retries
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('fails after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent network error'));

      const result = await fetchRedditData('test', { period: '7d', limit: 1 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Failed after');
        expect(result.error).toContain('Persistent network error');
      }
    });

    it('handles empty subreddit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createMockPostsResponse([])),
      });

      const result = await fetchRedditData('emptysub', { period: '30d', limit: 50 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.posts).toHaveLength(0);
      }
    });
  });

  describe('DEFAULT_OPTIONS', () => {
    it('has correct default values', () => {
      expect(DEFAULT_OPTIONS.period).toBe('30d');
      expect(DEFAULT_OPTIONS.limit).toBe(50);
    });
  });
});
