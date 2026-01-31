import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RedditData, RedditComment } from './reddit.js';

// Count total comments including replies
function countComments(comments: RedditComment[]): number {
  let count = comments.length;
  for (const comment of comments) {
    count += countComments(comment.replies);
  }
  return count;
}

export async function runInsights(subreddit: string, data?: RedditData): Promise<string> {
  const date = new Date().toISOString().split('T')[0];
  const filename = `reddit-insights-${subreddit}-${date}.md`;
  const outputPath = path.resolve(process.cwd(), filename);

  let content: string;

  if (!data) {
    // Fallback for when no data is provided (shouldn't happen in normal flow)
    content = `# Reddit Insights: r/${subreddit}

**Generated:** ${new Date().toISOString()}
**Subreddit:** r/${subreddit}

---

*No data available.*
`;
  } else {
    // Calculate stats
    const totalComments = Array.from(data.comments.values()).reduce(
      (sum, comments) => sum + countComments(comments),
      0
    );
    const totalScore = data.posts.reduce((sum, post) => sum + post.score, 0);
    const avgScore = data.posts.length > 0 ? Math.round(totalScore / data.posts.length) : 0;

    // Sort posts by score for top posts section
    const topPosts = [...data.posts].sort((a, b) => b.score - a.score).slice(0, 10);

    content = `# Reddit Insights: r/${subreddit}

**Generated:** ${new Date().toISOString()}
**Subreddit:** r/${subreddit}

---

## Data Summary

- **Posts fetched:** ${data.posts.length}
- **Total comments:** ${totalComments}
- **Average post score:** ${avgScore}

## Top Posts by Score

${topPosts.map((post, i) => `${i + 1}. **${post.title}** (score: ${post.score}, comments: ${post.numComments})
   ${post.permalink}`).join('\n\n')}

---

*LLM analysis will be implemented in a future update.*
`;
  }

  fs.writeFileSync(outputPath, content, 'utf-8');

  return outputPath;
}
