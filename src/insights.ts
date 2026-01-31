import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RedditData, RedditComment } from './reddit.js';
import { analyzeWithLLM, type AnalysisResult } from './llm.js';

// Count total comments including replies
function countComments(comments: RedditComment[]): number {
  let count = comments.length;
  for (const comment of comments) {
    count += countComments(comment.replies);
  }
  return count;
}

// Format analysis section for markdown
function formatAnalysisSection(analysis: AnalysisResult): string {
  const sections: string[] = [];

  // Pain Points
  if (analysis.pains.length > 0) {
    sections.push('## Pain Points\n');
    for (const pain of analysis.pains) {
      const frequencyBadge = pain.frequency === 'high' ? '🔴' : pain.frequency === 'medium' ? '🟡' : '🟢';
      sections.push(`### ${frequencyBadge} ${pain.description}\n`);
      sections.push(`**Frequency:** ${pain.frequency}\n`);
      if (pain.evidence.length > 0) {
        sections.push('**Evidence:**');
        for (const ev of pain.evidence) {
          sections.push(`- "${ev}"`);
        }
      }
      sections.push('');
    }
  }

  // Behavioral Patterns
  if (analysis.patterns.length > 0) {
    sections.push('## Behavioral Patterns\n');
    for (const pattern of analysis.patterns) {
      sections.push(`### ${pattern.name}`);
      sections.push(`${pattern.description}`);
      sections.push(`*Observed in ~${pattern.occurrences} discussions*\n`);
    }
  }

  // Notable Quotes
  if (analysis.quotes.length > 0) {
    sections.push('## Notable Quotes\n');
    for (const quote of analysis.quotes) {
      sections.push(`> "${quote.text}"`);
      sections.push(`> — u/${quote.author} (score: ${quote.score}) | *${quote.context}*\n`);
    }
  }

  // User Language
  if (analysis.userLanguage.commonTerms.length > 0 || analysis.userLanguage.emotionalPatterns.length > 0) {
    sections.push('## User Language & Tone\n');
    sections.push(`**Overall Tone:** ${analysis.userLanguage.tone}\n`);

    if (analysis.userLanguage.commonTerms.length > 0) {
      sections.push(`**Common Terms:** ${analysis.userLanguage.commonTerms.join(', ')}\n`);
    }

    if (analysis.userLanguage.emotionalPatterns.length > 0) {
      sections.push('**Emotional Patterns:**');
      for (const pattern of analysis.userLanguage.emotionalPatterns) {
        sections.push(`- ${pattern}`);
      }
      sections.push('');
    }
  }

  // Product Hypotheses
  if (analysis.hypotheses.length > 0) {
    sections.push('## Product Hypotheses\n');
    for (const hypothesis of analysis.hypotheses) {
      const confidenceBadge = hypothesis.confidence === 'high' ? '✅' : hypothesis.confidence === 'medium' ? '🔶' : '❓';
      sections.push(`### ${confidenceBadge} ${hypothesis.statement}\n`);
      sections.push(`**Confidence:** ${hypothesis.confidence}\n`);
      if (hypothesis.supportingEvidence.length > 0) {
        sections.push('**Supporting Evidence:**');
        for (const ev of hypothesis.supportingEvidence) {
          sections.push(`- ${ev}`);
        }
      }
      sections.push('');
    }
  }

  return sections.join('\n');
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

    // Run LLM analysis
    let analysisSection = '';
    const analysisResult = await analyzeWithLLM(data);

    if (analysisResult.success) {
      analysisSection = formatAnalysisSection(analysisResult.analysis);
    } else {
      console.error(`Warning: LLM analysis failed: ${analysisResult.error}`);
      analysisSection = `## Analysis

*LLM analysis was not available: ${analysisResult.error}*
`;
    }

    content = `# Reddit Insights: r/${subreddit}

**Generated:** ${new Date().toISOString()}
**Subreddit:** r/${subreddit}

---

## Data Summary

- **Posts analyzed:** ${data.posts.length}
- **Total comments:** ${totalComments}
- **Average post score:** ${avgScore}

---

${analysisSection}

---

## Top Posts by Score

${topPosts.map((post, i) => `${i + 1}. **${post.title}** (score: ${post.score}, comments: ${post.numComments})
   ${post.permalink}`).join('\n\n')}
`;
  }

  fs.writeFileSync(outputPath, content, 'utf-8');

  return outputPath;
}
