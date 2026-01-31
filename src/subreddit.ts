export interface ParseResult {
  success: true;
  subreddit: string;
}

export interface ParseError {
  success: false;
  error: string;
}

export type SubredditParseResult = ParseResult | ParseError;

const SUBREDDIT_REGEX = /^[a-zA-Z0-9_]{2,21}$/;

export function parseSubreddit(input: string): SubredditParseResult {
  if (!input || input.trim() === '') {
    return {
      success: false,
      error: 'Subreddit name is required. Usage: reddit-insights <subreddit>',
    };
  }

  const trimmed = input.trim();

  // Try to extract subreddit from full URL
  // Supports: https://reddit.com/r/subreddit, https://www.reddit.com/r/subreddit, etc.
  const urlMatch = trimmed.match(
    /^(?:https?:\/\/)?(?:www\.)?(?:old\.)?reddit\.com\/r\/([a-zA-Z0-9_]+)/i
  );
  if (urlMatch) {
    const subreddit = urlMatch[1];
    if (isValidSubredditName(subreddit)) {
      return { success: true, subreddit };
    }
    return {
      success: false,
      error: `Invalid subreddit name in URL: "${subreddit}". Subreddit names must be 2-21 characters and contain only letters, numbers, and underscores.`,
    };
  }

  // Try r/subreddit format
  const rPrefixMatch = trimmed.match(/^r\/([a-zA-Z0-9_]+)$/i);
  if (rPrefixMatch) {
    const subreddit = rPrefixMatch[1];
    if (isValidSubredditName(subreddit)) {
      return { success: true, subreddit };
    }
    return {
      success: false,
      error: `Invalid subreddit name: "${subreddit}". Subreddit names must be 2-21 characters and contain only letters, numbers, and underscores.`,
    };
  }

  // Try bare subreddit name
  if (isValidSubredditName(trimmed)) {
    return { success: true, subreddit: trimmed };
  }

  // Check if it looks like an invalid URL
  if (trimmed.includes('reddit.com') || trimmed.startsWith('http')) {
    return {
      success: false,
      error: `Could not extract subreddit from URL: "${trimmed}". Expected format: https://reddit.com/r/subreddit`,
    };
  }

  // Invalid subreddit name
  return {
    success: false,
    error: `Invalid subreddit name: "${trimmed}". Subreddit names must be 2-21 characters and contain only letters, numbers, and underscores.`,
  };
}

function isValidSubredditName(name: string): boolean {
  return SUBREDDIT_REGEX.test(name);
}
