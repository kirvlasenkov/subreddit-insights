/**
 * LLM analysis module using Claude API.
 * Handles chunking of large datasets and structured analysis extraction.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { RedditData, RedditPost, RedditComment } from './reddit.js';

const MAX_TOKENS_PER_CHUNK = 80000; // ~80k tokens per chunk (conservative estimate)
const CHARS_PER_TOKEN = 4; // Rough estimate for tokenization
const MAX_CHARS_PER_CHUNK = MAX_TOKENS_PER_CHUNK * CHARS_PER_TOKEN;

export interface AnalysisResult {
  pains: Pain[];
  patterns: Pattern[];
  quotes: Quote[];
  userLanguage: UserLanguage;
  hypotheses: Hypothesis[];
}

export interface Pain {
  description: string;
  frequency: 'high' | 'medium' | 'low';
  evidence: string[];
}

export interface Pattern {
  name: string;
  description: string;
  occurrences: number;
}

export interface Quote {
  text: string;
  context: string;
  author: string;
  score: number;
}

export interface UserLanguage {
  commonTerms: string[];
  tone: string;
  emotionalPatterns: string[];
}

export interface Hypothesis {
  statement: string;
  confidence: 'high' | 'medium' | 'low';
  supportingEvidence: string[];
}

// Flatten comments recursively for text extraction
function flattenComments(comments: RedditComment[]): RedditComment[] {
  const flat: RedditComment[] = [];
  for (const comment of comments) {
    flat.push(comment);
    if (comment.replies.length > 0) {
      flat.push(...flattenComments(comment.replies));
    }
  }
  return flat;
}

// Convert Reddit data to text for analysis
function dataToText(data: RedditData): string {
  const lines: string[] = [];

  lines.push(`# Subreddit: r/${data.subreddit}`);
  lines.push(`# Total posts: ${data.posts.length}`);
  lines.push('');

  for (const post of data.posts) {
    lines.push(`## Post: ${post.title}`);
    lines.push(`Score: ${post.score} | Comments: ${post.numComments} | Author: ${post.author}`);
    if (post.selftext) {
      lines.push(`Content: ${post.selftext}`);
    }
    lines.push('');

    const comments = data.comments.get(post.id) || [];
    const flatComments = flattenComments(comments);

    for (const comment of flatComments) {
      if (comment.body && comment.body !== '[deleted]' && comment.body !== '[removed]') {
        lines.push(`> [${comment.author}, score: ${comment.score}]: ${comment.body}`);
      }
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

// Chunk data into smaller pieces if needed
function chunkData(data: RedditData): RedditData[] {
  const fullText = dataToText(data);

  // If data fits in one chunk, return as-is
  if (fullText.length <= MAX_CHARS_PER_CHUNK) {
    return [data];
  }

  // Split posts into chunks
  const chunks: RedditData[] = [];
  let currentPosts: RedditPost[] = [];
  let currentComments = new Map<string, RedditComment[]>();
  let currentSize = 0;

  for (const post of data.posts) {
    const postComments = data.comments.get(post.id) || [];
    const postData: RedditData = {
      subreddit: data.subreddit,
      posts: [post],
      comments: new Map([[post.id, postComments]]),
    };
    const postText = dataToText(postData);

    if (currentSize + postText.length > MAX_CHARS_PER_CHUNK && currentPosts.length > 0) {
      // Save current chunk and start new one
      chunks.push({
        subreddit: data.subreddit,
        posts: currentPosts,
        comments: currentComments,
      });
      currentPosts = [];
      currentComments = new Map();
      currentSize = 0;
    }

    currentPosts.push(post);
    currentComments.set(post.id, postComments);
    currentSize += postText.length;
  }

  // Don't forget the last chunk
  if (currentPosts.length > 0) {
    chunks.push({
      subreddit: data.subreddit,
      posts: currentPosts,
      comments: currentComments,
    });
  }

  return chunks;
}

// Build the analysis prompt
function buildAnalysisPrompt(text: string, isPartialChunk: boolean, chunkInfo?: string): string {
  const chunkNote = isPartialChunk
    ? `\n\nNote: This is ${chunkInfo}. Focus on extracting insights from this portion.`
    : '';

  return `You are a product research analyst. Analyze the following Reddit discussions to extract actionable product insights.${chunkNote}

REDDIT DATA:
${text}

Analyze the above discussions and provide a structured JSON response with the following fields:

1. "pains": Array of user pain points. Each pain should have:
   - "description": Clear description of the pain point
   - "frequency": "high", "medium", or "low" based on how often it appears
   - "evidence": Array of 1-3 brief quotes or references supporting this pain

2. "patterns": Array of behavioral patterns observed. Each pattern should have:
   - "name": Short name for the pattern
   - "description": What users are doing/experiencing
   - "occurrences": Approximate count of posts/comments showing this pattern

3. "quotes": Array of 5-10 notable, insightful quotes. Each quote should have:
   - "text": The exact quote (can be truncated with ... if very long)
   - "context": Brief context (e.g., "discussing X", "asking about Y")
   - "author": Reddit username
   - "score": The score if available, or 0

4. "userLanguage": Object describing how users communicate:
   - "commonTerms": Array of 5-10 frequently used terms, jargon, or phrases
   - "tone": Overall emotional tone (e.g., "frustrated but seeking help", "enthusiastic", "technical")
   - "emotionalPatterns": Array of 2-5 emotional patterns observed

5. "hypotheses": Array of product hypotheses based on the data. Each hypothesis should have:
   - "statement": A testable product hypothesis in the format "Users who X would benefit from Y because Z"
   - "confidence": "high", "medium", or "low"
   - "supportingEvidence": Array of 1-3 brief evidence points

Respond with ONLY valid JSON, no markdown formatting, no explanation. The JSON should be directly parseable.`;
}

// Merge multiple analysis results into one
function mergeAnalysisResults(results: AnalysisResult[]): AnalysisResult {
  if (results.length === 1) {
    return results[0];
  }

  // Merge pains, deduplicating by description
  const painMap = new Map<string, Pain>();
  for (const result of results) {
    for (const pain of result.pains) {
      const key = pain.description.toLowerCase();
      if (painMap.has(key)) {
        const existing = painMap.get(key)!;
        existing.evidence.push(...pain.evidence);
        // Upgrade frequency if we see it again
        if (pain.frequency === 'high' || existing.frequency === 'high') {
          existing.frequency = 'high';
        } else if (pain.frequency === 'medium' || existing.frequency === 'medium') {
          existing.frequency = 'medium';
        }
      } else {
        painMap.set(key, { ...pain, evidence: [...pain.evidence] });
      }
    }
  }

  // Merge patterns
  const patternMap = new Map<string, Pattern>();
  for (const result of results) {
    for (const pattern of result.patterns) {
      const key = pattern.name.toLowerCase();
      if (patternMap.has(key)) {
        patternMap.get(key)!.occurrences += pattern.occurrences;
      } else {
        patternMap.set(key, { ...pattern });
      }
    }
  }

  // Collect quotes, sort by score, take top 10
  const allQuotes: Quote[] = [];
  for (const result of results) {
    allQuotes.push(...result.quotes);
  }
  allQuotes.sort((a, b) => b.score - a.score);
  const topQuotes = allQuotes.slice(0, 10);

  // Merge user language
  const allTerms = new Set<string>();
  const allEmotionalPatterns = new Set<string>();
  const tones: string[] = [];
  for (const result of results) {
    result.userLanguage.commonTerms.forEach(t => allTerms.add(t));
    result.userLanguage.emotionalPatterns.forEach(p => allEmotionalPatterns.add(p));
    tones.push(result.userLanguage.tone);
  }

  // Merge hypotheses, keeping unique ones
  const hypothesisSet = new Set<string>();
  const allHypotheses: Hypothesis[] = [];
  for (const result of results) {
    for (const hypothesis of result.hypotheses) {
      const key = hypothesis.statement.toLowerCase().slice(0, 100);
      if (!hypothesisSet.has(key)) {
        hypothesisSet.add(key);
        allHypotheses.push(hypothesis);
      }
    }
  }

  return {
    pains: Array.from(painMap.values()).slice(0, 10),
    patterns: Array.from(patternMap.values()).slice(0, 10),
    quotes: topQuotes,
    userLanguage: {
      commonTerms: Array.from(allTerms).slice(0, 10),
      tone: tones[0] || 'mixed',
      emotionalPatterns: Array.from(allEmotionalPatterns).slice(0, 5),
    },
    hypotheses: allHypotheses.slice(0, 5),
  };
}

// Parse LLM response to AnalysisResult
function parseAnalysisResponse(response: string): AnalysisResult {
  // Try to extract JSON from the response (in case of markdown wrapping)
  let jsonStr = response.trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  const parsed = JSON.parse(jsonStr);

  // Validate and provide defaults
  return {
    pains: Array.isArray(parsed.pains) ? parsed.pains : [],
    patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
    quotes: Array.isArray(parsed.quotes) ? parsed.quotes : [],
    userLanguage: parsed.userLanguage || { commonTerms: [], tone: 'unknown', emotionalPatterns: [] },
    hypotheses: Array.isArray(parsed.hypotheses) ? parsed.hypotheses : [],
  };
}

/**
 * Analyze Reddit data using Claude API.
 * Handles large datasets by chunking and merging results.
 */
export async function analyzeWithLLM(
  data: RedditData
): Promise<{ success: true; analysis: AnalysisResult } | { success: false; error: string }> {
  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      success: false,
      error: 'ANTHROPIC_API_KEY environment variable is not set. Please set it to use LLM analysis.',
    };
  }

  const client = new Anthropic();
  const chunks = chunkData(data);
  const totalChunks = chunks.length;

  console.log(`Analyzing data with Claude (${totalChunks} chunk${totalChunks > 1 ? 's' : ''})...`);

  const results: AnalysisResult[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const isPartialChunk = totalChunks > 1;
    const chunkInfo = `chunk ${i + 1} of ${totalChunks}`;

    if (isPartialChunk) {
      console.log(`Processing ${chunkInfo}...`);
    }

    const text = dataToText(chunk);
    const prompt = buildAnalysisPrompt(text, isPartialChunk, chunkInfo);

    try {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Extract text from response
      const textContent = message.content.find(block => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        return {
          success: false,
          error: 'Unexpected response format from Claude API',
        };
      }

      const analysis = parseAnalysisResponse(textContent.text);
      results.push(analysis);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown API error';
      return {
        success: false,
        error: `Claude API error: ${message}`,
      };
    }
  }

  // Merge all chunk results
  const mergedAnalysis = mergeAnalysisResults(results);

  console.log('Analysis complete.');

  return {
    success: true,
    analysis: mergedAnalysis,
  };
}

/**
 * Get empty analysis result (used when LLM analysis is skipped).
 */
export function getEmptyAnalysis(): AnalysisResult {
  return {
    pains: [],
    patterns: [],
    quotes: [],
    userLanguage: { commonTerms: [], tone: 'unknown', emotionalPatterns: [] },
    hypotheses: [],
  };
}
