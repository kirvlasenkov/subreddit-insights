import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OpenAI from 'openai';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      models: {
        list: vi.fn(),
      },
    })),
  };
});

// Import after mocking
import { isInteractive, validateApiKey, ensureApiKey } from './api-key.js';

// Helper to create mock OpenAI errors with correct names
function createMockError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  Object.defineProperty(error, 'constructor', {
    value: { name },
  });
  return error;
}

describe('isInteractive', () => {
  const originalIsTTY = process.stdin.isTTY;

  afterEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: originalIsTTY,
      writable: true,
    });
  });

  it('should return true when stdin is TTY', () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true,
    });
    expect(isInteractive()).toBe(true);
  });

  it('should return false when stdin is not TTY', () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: false,
      writable: true,
    });
    expect(isInteractive()).toBe(false);
  });

  it('should return false when stdin.isTTY is undefined', () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: undefined,
      writable: true,
    });
    expect(isInteractive()).toBe(false);
  });
});

describe('validateApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return valid for working API key', async () => {
    const mockList = vi.fn().mockResolvedValue({ data: [] });
    vi.mocked(OpenAI).mockImplementation(
      () =>
        ({
          models: { list: mockList },
        }) as unknown as OpenAI
    );

    const result = await validateApiKey('sk-valid-key');

    expect(result.valid).toBe(true);
    expect(mockList).toHaveBeenCalled();
  });

  it('should return invalid for authentication error', async () => {
    const authError = createMockError('AuthenticationError', 'Invalid API key');

    const mockList = vi.fn().mockRejectedValue(authError);
    vi.mocked(OpenAI).mockImplementation(
      () =>
        ({
          models: { list: mockList },
        }) as unknown as OpenAI
    );

    const result = await validateApiKey('sk-invalid-key');

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('Invalid API key');
    }
  });

  it('should return valid for rate limit error (key is valid, just rate limited)', async () => {
    const rateLimitError = createMockError('RateLimitError', 'Rate limit exceeded');

    const mockList = vi.fn().mockRejectedValue(rateLimitError);
    vi.mocked(OpenAI).mockImplementation(
      () =>
        ({
          models: { list: mockList },
        }) as unknown as OpenAI
    );

    const result = await validateApiKey('sk-rate-limited-key');

    expect(result.valid).toBe(true);
  });

  it('should return invalid for connection error', async () => {
    const connectionError = createMockError('APIConnectionError', 'Network error');

    const mockList = vi.fn().mockRejectedValue(connectionError);
    vi.mocked(OpenAI).mockImplementation(
      () =>
        ({
          models: { list: mockList },
        }) as unknown as OpenAI
    );

    const result = await validateApiKey('sk-any-key');

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('Could not connect');
    }
  });

  it('should return invalid for unknown errors', async () => {
    const mockList = vi.fn().mockRejectedValue(new Error('Something went wrong'));
    vi.mocked(OpenAI).mockImplementation(
      () =>
        ({
          models: { list: mockList },
        }) as unknown as OpenAI
    );

    const result = await validateApiKey('sk-any-key');

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('Something went wrong');
    }
  });
});

describe('ensureApiKey', () => {
  const originalEnv = process.env;
  const originalIsTTY = process.stdin.isTTY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process.stdin, 'isTTY', {
      value: originalIsTTY,
      writable: true,
    });
  });

  it('should return success when valid API key is in environment', async () => {
    process.env.OPENAI_API_KEY = 'sk-valid-env-key';

    const mockList = vi.fn().mockResolvedValue({ data: [] });
    vi.mocked(OpenAI).mockImplementation(
      () =>
        ({
          models: { list: mockList },
        }) as unknown as OpenAI
    );

    const result = await ensureApiKey();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.apiKey).toBe('sk-valid-env-key');
    }
  });

  it('should return error when env key is invalid', async () => {
    process.env.OPENAI_API_KEY = 'sk-invalid-env-key';

    const authError = createMockError('AuthenticationError', 'Invalid API key');
    const mockList = vi.fn().mockRejectedValue(authError);
    vi.mocked(OpenAI).mockImplementation(
      () =>
        ({
          models: { list: mockList },
        }) as unknown as OpenAI
    );

    const result = await ensureApiKey();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid API key');
    }
  });

  it('should return error in non-interactive mode when no env key', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: false,
      writable: true,
    });

    const result = await ensureApiKey();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('OPENAI_API_KEY environment variable is not set');
      expect(result.error).toContain('export OPENAI_API_KEY');
    }
  });
});
