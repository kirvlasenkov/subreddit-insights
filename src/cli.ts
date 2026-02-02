#!/usr/bin/env node

import 'dotenv/config';
import { Command } from 'commander';
import { parseSubreddit } from './subreddit.js';
import { runInsights, type ReportOptions } from './insights.js';
import { fetchRedditData, DEFAULT_OPTIONS, type FetchOptions } from './reddit.js';
import { ensureApiKey } from './api-key.js';
import { authLogin, authLogout, authStatus } from './auth.js';

const VALID_PERIODS = ['7d', '30d', '90d', '180d'] as const;

const program = new Command();

program
  .name('subreddit-insights')
  .description(
    `Analyze Reddit subreddits to extract product insights using AI.

Fetches posts and comments from any public subreddit, analyzes them with
GPT-5.2, and generates a comprehensive markdown report with:
  - Pain points and user desires
  - Behavioral patterns
  - Notable quotes
  - Audience language analysis
  - Product hypotheses`
  )
  .version('0.1.0')
  .argument('<subreddit>', 'Subreddit to analyze (name, r/name, or full URL)')
  .option(
    '-p, --period <period>',
    `Time period for posts: ${VALID_PERIODS.join(', ')} (default: ${DEFAULT_OPTIONS.period})`,
    DEFAULT_OPTIONS.period
  )
  .option(
    '-l, --limit <number>',
    `Max posts to fetch: 1-500 (default: ${DEFAULT_OPTIONS.limit})`,
    String(DEFAULT_OPTIONS.limit)
  )
  .option(
    '-o, --output <path>',
    'Output file path (default: subreddit-insights-<subreddit>-<date>.md)'
  )
  .addHelpText(
    'after',
    `
Examples:
  $ subreddit-insights BeginnersRunning
      Analyze r/BeginnersRunning with default settings (30 days, 50 posts)

  $ subreddit-insights r/productivity --period 7d --limit 100
      Analyze last 7 days with up to 100 posts

  $ subreddit-insights https://reddit.com/r/remotework -o report.md
      Analyze from URL and save to custom output file

  $ subreddit-insights SideProject --period 90d
      Analyze 90 days of posts from r/SideProject

Requirements:
  OPENAI_API_KEY       Required environment variable for GPT-5.2 analysis.
                       Get your API key at: https://platform.openai.com/api-keys

  Set the key before running:
    $ export OPENAI_API_KEY=your-api-key-here
    $ subreddit-insights <subreddit>

  Or inline:
    $ OPENAI_API_KEY=your-key subreddit-insights <subreddit>
`
  )
  .action(async (subredditInput: string, options: { period: string; limit: string; output?: string }) => {
    // Check API key first (before any network requests)
    const apiKeyResult = await ensureApiKey();
    if (!apiKeyResult.success) {
      console.error(`Error: ${apiKeyResult.error}`);
      process.exit(1);
    }

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
      const reportOptions: ReportOptions = {
        outputPath: options.output,
        period: fetchOptions.period,
      };
      const outputPath = await runInsights(result.subreddit, fetchResult.data, reportOptions);
      console.log(`Report saved to: ${outputPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

// Auth command with subcommands
const authCommand = new Command('auth')
  .description('Manage Reddit OAuth authentication');

authCommand
  .command('login')
  .description('Login to Reddit using OAuth')
  .requiredOption('--client-id <id>', 'Reddit app client ID')
  .requiredOption('--client-secret <secret>', 'Reddit app client secret')
  .action(async (options: { clientId: string; clientSecret: string }) => {
    const result = await authLogin(options.clientId, options.clientSecret);
    if (result.success) {
      console.log(result.message);
    } else {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }
  });

authCommand
  .command('logout')
  .description('Logout and clear saved credentials')
  .action(async () => {
    const result = await authLogout();
    if (result.success) {
      console.log(result.message);
    } else {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }
  });

authCommand
  .command('status')
  .description('Show current authentication status')
  .action(async () => {
    const result = await authStatus();
    if (!result.success) {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }

    if (!result.loggedIn) {
      console.log('Not logged in to Reddit.');
      console.log('');
      console.log('To login, run:');
      console.log('  subreddit-insights auth login --client-id <id> --client-secret <secret>');
      return;
    }

    console.log('Logged in to Reddit.');
    if (result.tokenValid) {
      const expiresAt = new Date(result.expiresAt!);
      console.log(`Token valid until: ${expiresAt.toLocaleString()}`);
    } else {
      console.log('Token has expired. It will be refreshed automatically on next use.');
    }
  });

program.addCommand(authCommand);

program.parse();
