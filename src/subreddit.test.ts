import { describe, it, expect } from 'vitest';
import { parseSubreddit } from './subreddit.js';

describe('parseSubreddit', () => {
  describe('valid inputs', () => {
    it('parses bare subreddit name', () => {
      const result = parseSubreddit('BeginnersRunning');
      expect(result).toEqual({ success: true, subreddit: 'BeginnersRunning' });
    });

    it('parses r/subreddit format', () => {
      const result = parseSubreddit('r/BeginnersRunning');
      expect(result).toEqual({ success: true, subreddit: 'BeginnersRunning' });
    });

    it('parses R/subreddit format (case insensitive)', () => {
      const result = parseSubreddit('R/BeginnersRunning');
      expect(result).toEqual({ success: true, subreddit: 'BeginnersRunning' });
    });

    it('parses full Reddit URL', () => {
      const result = parseSubreddit('https://reddit.com/r/BeginnersRunning');
      expect(result).toEqual({ success: true, subreddit: 'BeginnersRunning' });
    });

    it('parses Reddit URL with www', () => {
      const result = parseSubreddit('https://www.reddit.com/r/BeginnersRunning');
      expect(result).toEqual({ success: true, subreddit: 'BeginnersRunning' });
    });

    it('parses old.reddit.com URL', () => {
      const result = parseSubreddit('https://old.reddit.com/r/BeginnersRunning');
      expect(result).toEqual({ success: true, subreddit: 'BeginnersRunning' });
    });

    it('parses URL without protocol', () => {
      const result = parseSubreddit('reddit.com/r/BeginnersRunning');
      expect(result).toEqual({ success: true, subreddit: 'BeginnersRunning' });
    });

    it('parses URL with trailing path', () => {
      const result = parseSubreddit('https://reddit.com/r/BeginnersRunning/hot');
      expect(result).toEqual({ success: true, subreddit: 'BeginnersRunning' });
    });

    it('handles subreddit with underscores', () => {
      const result = parseSubreddit('learn_programming');
      expect(result).toEqual({ success: true, subreddit: 'learn_programming' });
    });

    it('handles subreddit with numbers', () => {
      const result = parseSubreddit('web3');
      expect(result).toEqual({ success: true, subreddit: 'web3' });
    });

    it('trims whitespace', () => {
      const result = parseSubreddit('  BeginnersRunning  ');
      expect(result).toEqual({ success: true, subreddit: 'BeginnersRunning' });
    });
  });

  describe('invalid inputs', () => {
    it('rejects empty string', () => {
      const result = parseSubreddit('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('required');
      }
    });

    it('rejects whitespace only', () => {
      const result = parseSubreddit('   ');
      expect(result.success).toBe(false);
    });

    it('rejects subreddit name that is too short', () => {
      const result = parseSubreddit('a');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('2-21 characters');
      }
    });

    it('rejects subreddit name that is too long', () => {
      const result = parseSubreddit('a'.repeat(22));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('2-21 characters');
      }
    });

    it('rejects subreddit with special characters', () => {
      const result = parseSubreddit('test-subreddit');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('letters, numbers, and underscores');
      }
    });

    it('rejects subreddit with spaces', () => {
      const result = parseSubreddit('test subreddit');
      expect(result.success).toBe(false);
    });

    it('rejects malformed URL', () => {
      const result = parseSubreddit('https://reddit.com/invalid');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Could not extract subreddit');
      }
    });

    it('rejects invalid subreddit in URL', () => {
      const result = parseSubreddit('https://reddit.com/r/a');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid subreddit name in URL');
      }
    });
  });
});
