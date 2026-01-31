/**
 * Reddit API client for fetching posts and comments.
 * Uses Reddit's public JSON API (no authentication required for public subreddits).
 */

const USER_AGENT = 'reddit-insights-cli/0.1.0';
const BASE_URL = 'https://www.reddit.com';
const REQUEST_DELAY_MS = 1000; // Respect rate limits

export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  score: number;
  numComments: number;
  createdUtc: number;
  url: string;
  permalink: string;
}

export interface RedditComment {
  id: string;
  body: string;
  author: string;
  score: number;
  createdUtc: number;
  postId: string;
  parentId: string;
  replies: RedditComment[];
}

export interface FetchOptions {
  period: '7d' | '30d' | '90d' | '180d';
  limit: number;
}

export interface RedditData {
  subreddit: string;
  posts: RedditPost[];
  comments: Map<string, RedditComment[]>;
}

export type FetchResult =
  | { success: true; data: RedditData }
  | { success: false; error: string };

// Map period to Reddit's time filter
function periodToTimeFilter(period: string): string {
  switch (period) {
    case '7d':
      return 'week';
    case '30d':
      return 'month';
    case '90d':
    case '180d':
      return 'year';
    default:
      return 'month';
  }
}

// Get cutoff timestamp for filtering posts
function getPeriodCutoff(period: string): number {
  const now = Date.now() / 1000;
  const days = parseInt(period.replace('d', ''), 10);
  return now - days * 24 * 60 * 60;
}

// Delay helper for rate limiting
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Parse raw Reddit post data
function parsePost(data: Record<string, unknown>): RedditPost {
  return {
    id: data.id as string,
    title: data.title as string,
    selftext: (data.selftext as string) || '',
    author: data.author as string,
    score: data.score as number,
    numComments: data.num_comments as number,
    createdUtc: data.created_utc as number,
    url: data.url as string,
    permalink: `https://www.reddit.com${data.permalink as string}`,
  };
}

// Parse raw Reddit comment data recursively
function parseComment(
  data: Record<string, unknown>,
  postId: string
): RedditComment {
  const replies: RedditComment[] = [];

  // Parse nested replies if present
  const repliesData = data.replies as Record<string, unknown> | undefined;
  if (repliesData && typeof repliesData === 'object' && repliesData.data) {
    const replyListing = repliesData.data as Record<string, unknown>;
    const children = replyListing.children as Array<Record<string, unknown>>;
    if (Array.isArray(children)) {
      for (const child of children) {
        if (child.kind === 't1' && child.data) {
          replies.push(
            parseComment(child.data as Record<string, unknown>, postId)
          );
        }
      }
    }
  }

  return {
    id: data.id as string,
    body: (data.body as string) || '',
    author: data.author as string,
    score: data.score as number,
    createdUtc: data.created_utc as number,
    postId,
    parentId: data.parent_id as string,
    replies,
  };
}

// Fetch with retry and error handling
async function fetchWithRetry(
  url: string,
  retries = 3
): Promise<{ success: true; data: unknown } | { success: false; error: string }> {
  let lastError = '';

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
        },
      });

      if (response.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = parseInt(
          response.headers.get('Retry-After') || '60',
          10
        );
        console.error(
          `Rate limited. Waiting ${retryAfter} seconds before retry...`
        );
        await delay(retryAfter * 1000);
        continue;
      }

      if (response.status === 403) {
        return {
          success: false,
          error: 'Access forbidden. The subreddit may be private or banned.',
        };
      }

      if (response.status === 404) {
        return {
          success: false,
          error: 'Subreddit not found.',
        };
      }

      if (!response.ok) {
        lastError = `HTTP ${response.status}: ${response.statusText}`;
        continue;
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : 'Unknown network error';
      if (attempt < retries - 1) {
        await delay(REQUEST_DELAY_MS * (attempt + 1));
      }
    }
  }

  return { success: false, error: `Failed after ${retries} attempts: ${lastError}` };
}

// Fetch posts from subreddit
async function fetchPosts(
  subreddit: string,
  options: FetchOptions
): Promise<{ success: true; posts: RedditPost[] } | { success: false; error: string }> {
  const timeFilter = periodToTimeFilter(options.period);
  const cutoff = getPeriodCutoff(options.period);
  const posts: RedditPost[] = [];
  let after: string | null = null;

  // Fetch in batches (Reddit limits to 100 per request)
  while (posts.length < options.limit) {
    const batchSize = Math.min(100, options.limit - posts.length);
    let url = `${BASE_URL}/r/${subreddit}/top.json?t=${timeFilter}&limit=${batchSize}`;
    if (after) {
      url += `&after=${after}`;
    }

    const result = await fetchWithRetry(url);
    if (!result.success) {
      return result;
    }

    const listing = result.data as Record<string, unknown>;
    const data = listing.data as Record<string, unknown>;
    const children = data.children as Array<Record<string, unknown>>;

    if (!children || children.length === 0) {
      break; // No more posts
    }

    for (const child of children) {
      if (child.kind === 't3' && child.data) {
        const postData = child.data as Record<string, unknown>;
        const createdUtc = postData.created_utc as number;

        // Filter by period cutoff
        if (createdUtc >= cutoff) {
          posts.push(parsePost(postData));
        }
      }
    }

    after = data.after as string | null;
    if (!after) {
      break; // No more pages
    }

    // Rate limit between requests
    await delay(REQUEST_DELAY_MS);
  }

  return { success: true, posts: posts.slice(0, options.limit) };
}

// Fetch comments for a single post
async function fetchPostComments(
  subreddit: string,
  postId: string
): Promise<{ success: true; comments: RedditComment[] } | { success: false; error: string }> {
  const url = `${BASE_URL}/r/${subreddit}/comments/${postId}.json?limit=100&depth=3`;

  const result = await fetchWithRetry(url);
  if (!result.success) {
    return result;
  }

  const comments: RedditComment[] = [];
  const listings = result.data as Array<Record<string, unknown>>;

  // Second listing contains comments
  if (listings.length >= 2) {
    const commentListing = listings[1] as Record<string, unknown>;
    const data = commentListing.data as Record<string, unknown>;
    const children = data.children as Array<Record<string, unknown>>;

    if (Array.isArray(children)) {
      for (const child of children) {
        if (child.kind === 't1' && child.data) {
          comments.push(
            parseComment(child.data as Record<string, unknown>, postId)
          );
        }
      }
    }
  }

  return { success: true, comments };
}

/**
 * Fetch all posts and comments from a subreddit.
 */
export async function fetchRedditData(
  subreddit: string,
  options: FetchOptions
): Promise<FetchResult> {
  console.log(
    `Fetching top posts from r/${subreddit} (period: ${options.period}, limit: ${options.limit})...`
  );

  // Fetch posts
  const postsResult = await fetchPosts(subreddit, options);
  if (!postsResult.success) {
    return postsResult;
  }

  console.log(`Found ${postsResult.posts.length} posts. Fetching comments...`);

  // Fetch comments for each post
  const comments = new Map<string, RedditComment[]>();
  let fetchedCount = 0;

  for (const post of postsResult.posts) {
    const commentsResult = await fetchPostComments(subreddit, post.id);
    if (commentsResult.success) {
      comments.set(post.id, commentsResult.comments);
    } else {
      // Log but don't fail - some posts may have comments disabled
      console.error(
        `Warning: Could not fetch comments for post ${post.id}: ${commentsResult.error}`
      );
      comments.set(post.id, []);
    }

    fetchedCount++;
    if (fetchedCount % 10 === 0) {
      console.log(
        `Fetched comments for ${fetchedCount}/${postsResult.posts.length} posts...`
      );
    }

    // Rate limit between comment fetches
    await delay(REQUEST_DELAY_MS);
  }

  console.log('Done fetching Reddit data.');

  return {
    success: true,
    data: {
      subreddit,
      posts: postsResult.posts,
      comments,
    },
  };
}

export const DEFAULT_OPTIONS: FetchOptions = {
  period: '30d',
  limit: 50,
};
