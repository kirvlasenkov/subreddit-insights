#!/usr/bin/env node

import { Command } from 'commander';
import { parseSubreddit } from './subreddit.js';
import { runInsights } from './insights.js';
import { fetchRedditData, DEFAULT_OPTIONS, type FetchOptions } from './reddit.js';

const VALID_PERIODS = ['7d', '30d', '90d', '180d'] as const;

const program = new Command();

program
  .name('reddit-insights')
  .description('Analyze Reddit subreddits to extract product insights')
  .version('0.1.0')
  .argument('<subreddit>', 'Subreddit name (e.g., BeginnersRunning, r/BeginnersRunning, or full URL)')
  .option(
    '-p, --period <period>',
    `Time period to filter posts (${VALID_PERIODS.join(', ')})`,
    DEFAULT_OPTIONS.period
  )
  .option(
    '-l, --limit <number>',
    'Maximum number of posts to fetch',
    String(DEFAULT_OPTIONS.limit)
  )
  .action(async (subredditInput: string, options: { period: string; limit: string }) => {
    const result = parseSubreddit(subredditInput);

    if (!result.success) {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }

    // Validate period
    if (!VALID_PERIODS.includes(options.period as FetchOptions['period'])) {
      console.error(`Error: Invalid period "${options.period}". Must be one of: ${VALID_PERIODS.join(', ')}`);
      process.exit(1);
    }

    // Validate limit
    const limit = parseInt(options.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 500) {
      console.error('Error: Limit must be a number between 1 and 500');
      process.exit(1);
    }

    const fetchOptions: FetchOptions = {
      period: options.period as FetchOptions['period'],
      limit,
    };

    try {
      // Fetch Reddit data
      const fetchResult = await fetchRedditData(result.subreddit, fetchOptions);

      if (!fetchResult.success) {
        console.error(`Error: ${fetchResult.error}`);
        process.exit(1);
      }

      // Generate report
      const outputPath = await runInsights(result.subreddit, fetchResult.data);
      console.log(`Report saved to: ${outputPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

program.parse();
