#!/usr/bin/env node

import { Command } from 'commander';
import { parseSubreddit } from './subreddit.js';
import { runInsights } from './insights.js';

const program = new Command();

program
  .name('reddit-insights')
  .description('Analyze Reddit subreddits to extract product insights')
  .version('0.1.0')
  .argument('<subreddit>', 'Subreddit name (e.g., BeginnersRunning, r/BeginnersRunning, or full URL)')
  .action(async (subredditInput: string) => {
    const result = parseSubreddit(subredditInput);

    if (!result.success) {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }

    try {
      const outputPath = await runInsights(result.subreddit);
      console.log(`Report saved to: ${outputPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

program.parse();
