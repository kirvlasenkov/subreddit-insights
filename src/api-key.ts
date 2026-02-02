/**
 * API key management module.
 * Handles prompting, masking, and validation of OpenAI API keys.
 */

import * as readline from 'node:readline';
import OpenAI from 'openai';

export interface ApiKeyResult {
  success: true;
  apiKey: string;
}

export interface ApiKeyError {
  success: false;
  error: string;
}

export type EnsureApiKeyResult = ApiKeyResult | ApiKeyError;

/**
 * Check if stdin is interactive (TTY).
 */
export function isInteractive(): boolean {
  return process.stdin.isTTY === true;
}

/**
 * Prompt user for API key with masked input (shows asterisks).
 * Returns the entered key or null if cancelled.
 */
export async function promptForApiKey(): Promise<string | null> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Print the prompt and safety message
    console.log('');
    console.log('OPENAI_API_KEY is not set.');
    console.log('');
    console.log('This is completely safe - your key will only be used for this session');
    console.log('and will not be stored anywhere.');
    console.log('');
    console.log('Get your API key at: https://platform.openai.com/api-keys');
    console.log('');

    // For masked input, we need to handle it character by character
    process.stdout.write('Enter your OpenAI API key: ');

    let input = '';
    const stdin = process.stdin;

    // Save original state
    const wasRaw = stdin.isRaw;

    // Check if we can use raw mode (only in TTY)
    if (!stdin.isTTY) {
      // Non-interactive mode - just read a line normally
      rl.question('', (answer) => {
        rl.close();
        resolve(answer.trim() || null);
      });
      return;
    }

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = (chunk: string) => {
      // Handle multi-character input (e.g., paste)
      for (const char of chunk) {
        // Handle Ctrl+C - exit process as user expects
        if (char === '\u0003') {
          stdin.setRawMode(wasRaw ?? false);
          stdin.removeListener('data', onData);
          rl.close();
          console.log('');
          process.exit(130); // 128 + SIGINT(2)
        }

        // Handle Enter
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(wasRaw ?? false);
          stdin.removeListener('data', onData);
          rl.close();
          console.log('');
          resolve(input.trim() || null);
          return;
        }

        // Handle Backspace
        if (char === '\u007F' || char === '\b') {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }

        // Handle Escape
        if (char === '\u001B') {
          stdin.setRawMode(wasRaw ?? false);
          stdin.removeListener('data', onData);
          rl.close();
          console.log('');
          resolve(null);
          return;
        }

        // Regular character - add to input and show asterisk
        input += char;
        process.stdout.write('*');
      }
    };

    stdin.on('data', onData);
  });
}

/**
 * Check error type by name (more reliable than instanceof with mocks).
 */
function isOpenAIError(error: unknown, errorName: string): boolean {
  if (error instanceof Error) {
    return error.constructor.name === errorName || error.name === errorName;
  }
  return false;
}

const VALIDATION_TIMEOUT_MS = 10000; // 10 seconds

export async function validateApiKey(apiKey: string): Promise<{ valid: true } | { valid: false; error: string }> {
  try {
    const client = new OpenAI({ apiKey, timeout: VALIDATION_TIMEOUT_MS });

    // Make a minimal API call to validate the key
    // Using models.list() as it's a lightweight endpoint
    await client.models.list();

    return { valid: true };
  } catch (error) {
    if (isOpenAIError(error, 'AuthenticationError')) {
      return { valid: false, error: 'Invalid API key. Please check your key and try again.' };
    }
    if (isOpenAIError(error, 'RateLimitError')) {
      // Rate limit means the key is valid, just rate limited
      return { valid: true };
    }
    if (isOpenAIError(error, 'APIConnectionError')) {
      return { valid: false, error: 'Could not connect to OpenAI. Please check your internet connection.' };
    }
    if (isOpenAIError(error, 'APIConnectionTimeoutError')) {
      return { valid: false, error: 'Connection to OpenAI timed out. Please try again.' };
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, error: `Failed to validate API key: ${message}` };
  }
}

/**
 * Ensure API key is available - either from env or by prompting user.
 * Validates the key before returning.
 *
 * @returns The API key if successful, or an error object if not
 */
export async function ensureApiKey(): Promise<EnsureApiKeyResult> {
  // First check environment variable
  const envKey = process.env.OPENAI_API_KEY;

  if (envKey) {
    // Validate the existing key
    process.stdout.write('Validating API key... ');
    const validation = await validateApiKey(envKey);

    if (validation.valid) {
      console.log('OK');
      return { success: true, apiKey: envKey };
    } else {
      console.log('FAILED');
      return { success: false, error: validation.error };
    }
  }

  // No key in environment - check if we can prompt
  if (!isInteractive()) {
    return {
      success: false,
      error:
        'OPENAI_API_KEY environment variable is not set.\n' +
        'Set it before running: export OPENAI_API_KEY=your-key-here',
    };
  }

  // Prompt for key
  const apiKey = await promptForApiKey();

  if (!apiKey) {
    return { success: false, error: 'API key entry cancelled.' };
  }

  // Validate the entered key
  process.stdout.write('Validating API key... ');
  const validation = await validateApiKey(apiKey);

  if (!validation.valid) {
    console.log('FAILED');
    return { success: false, error: validation.error };
  }

  console.log('OK');

  // Set it in the environment for this session
  process.env.OPENAI_API_KEY = apiKey;

  return { success: true, apiKey };
}
