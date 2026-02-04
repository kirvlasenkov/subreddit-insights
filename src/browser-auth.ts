/**
 * Browser-based Reddit authentication module.
 * Uses Puppeteer to open a real browser window for user login.
 * No Reddit App required - just username and password.
 */

import puppeteer, { Browser, Page, Cookie } from 'puppeteer-core';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface BrowserAuthResult {
  success: true;
  cookies: Cookie[];
  username: string;
}

export interface BrowserAuthError {
  success: false;
  error: string;
}

export type BrowserAuthResponse = BrowserAuthResult | BrowserAuthError;

/**
 * Common browser executable paths by platform.
 */
const BROWSER_PATHS: Record<string, string[]> = {
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/brave-browser',
    '/usr/bin/microsoft-edge',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
};

/**
 * Find a browser executable on the system.
 */
export function findBrowserExecutable(): string | null {
  // Check environment variable first
  const envPath = process.env.BROWSER_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  const platform = process.platform;
  const paths = BROWSER_PATHS[platform] || BROWSER_PATHS.linux;

  for (const browserPath of paths) {
    if (browserPath && fs.existsSync(browserPath)) {
      return browserPath;
    }
  }

  return null;
}

/**
 * Check if user is logged into Reddit by looking for session cookies.
 */
export function isLoggedIn(cookies: Cookie[]): boolean {
  // Reddit uses 'reddit_session' cookie when logged in
  return cookies.some(
    (c) => c.name === 'reddit_session' || c.name === 'token_v2'
  );
}

/**
 * Extract username from Reddit page or cookies.
 */
async function extractUsername(page: Page): Promise<string | null> {
  try {
    // Try to get username from the page
    const username = await page.evaluate(() => {
      // Check for username in various places
      const userLink = document.querySelector('a[href^="/user/"]');
      if (userLink) {
        const href = userLink.getAttribute('href');
        const match = href?.match(/\/user\/([^/]+)/);
        if (match) return match[1];
      }

      // Check Reddit's data attributes
      const body = document.body;
      const loggedInUser = body.getAttribute('data-logged-in-user');
      if (loggedInUser) return loggedInUser;

      return null;
    });

    return username;
  } catch {
    return null;
  }
}

/**
 * Wait for user to complete login.
 * Detects successful login by checking for session cookies.
 */
async function waitForLogin(
  page: Page,
  timeoutMs: number = 300000 // 5 minutes
): Promise<{ loggedIn: boolean; username: string | null }> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const cookies = await page.cookies('https://www.reddit.com');

    if (isLoggedIn(cookies)) {
      // Give page a moment to fully load user data
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const username = await extractUsername(page);
      return { loggedIn: true, username };
    }

    // Wait a bit before checking again
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return { loggedIn: false, username: null };
}

/**
 * Perform browser-based Reddit authentication.
 * Opens a visible browser window for the user to log in.
 */
export async function browserLogin(
  options: {
    timeoutMs?: number;
    browserPath?: string;
  } = {}
): Promise<BrowserAuthResponse> {
  const { timeoutMs = 300000, browserPath } = options;

  // Find browser executable
  const executablePath = browserPath || findBrowserExecutable();

  if (!executablePath) {
    return {
      success: false,
      error:
        'No browser found. Please install Chrome, Chromium, or Edge, ' +
        'or set BROWSER_PATH environment variable to your browser executable.',
    };
  }

  console.log('');
  console.log('Opening browser for Reddit login...');
  console.log('Please log in to your Reddit account in the browser window.');
  console.log('');

  let browser: Browser | null = null;

  try {
    // Launch browser with visible window
    browser = await puppeteer.launch({
      executablePath,
      headless: false,
      defaultViewport: null, // Use default window size
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Navigate to Reddit login page
    await page.goto('https://www.reddit.com/login', {
      waitUntil: 'networkidle2',
    });

    console.log('Waiting for you to log in...');
    console.log('(This will timeout in 5 minutes)');
    console.log('');

    // Wait for user to log in
    const loginResult = await waitForLogin(page, timeoutMs);

    if (!loginResult.loggedIn) {
      return {
        success: false,
        error: 'Login timeout - no login detected within the time limit.',
      };
    }

    // Get all Reddit cookies
    const cookies = await page.cookies('https://www.reddit.com');

    console.log('');
    console.log(`Successfully logged in${loginResult.username ? ` as ${loginResult.username}` : ''}!`);

    return {
      success: true,
      cookies,
      username: loginResult.username || 'unknown',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Browser authentication failed: ${message}`,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Convert puppeteer cookies to a format suitable for fetch requests.
 */
export function cookiesToHeader(cookies: Cookie[]): string {
  return cookies
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

/**
 * Filter cookies to only include essential Reddit session cookies.
 */
export function filterEssentialCookies(cookies: Cookie[]): Cookie[] {
  const essentialNames = [
    'reddit_session',
    'token_v2',
    'edgebucket',
    'loid',
    'session_tracker',
    'csv',
  ];

  return cookies.filter((c) => essentialNames.includes(c.name));
}
