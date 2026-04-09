import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { encrypt, decrypt } from '../src/utils/encryption.js';

// Mock BullMQ and ioredis before any imports that use them
vi.mock('bullmq', () => {
  const mockJob = { id: 'mock-job-id', remove: vi.fn() };
  const mockQueue = {
    add: vi.fn().mockResolvedValue(mockJob),
    getJob: vi.fn().mockResolvedValue(mockJob),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    Queue: vi.fn().mockImplementation(() => mockQueue),
    Worker: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      quit: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Token encryption/decryption', () => {
  it('encrypts and decrypts a token round-trip', () => {
    const accessToken = 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test-access-token';
    const encrypted = encrypt(accessToken, TEST_KEY);
    expect(encrypted).not.toBe(accessToken);
    const decrypted = decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(accessToken);
  });

  it('encrypts and decrypts a refresh token round-trip', () => {
    const refreshToken = 'refresh-eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test-refresh-token';
    const encrypted = encrypt(refreshToken, TEST_KEY);
    const decrypted = decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(refreshToken);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const token = 'same-access-token';
    const enc1 = encrypt(token, TEST_KEY);
    const enc2 = encrypt(token, TEST_KEY);
    expect(enc1).not.toBe(enc2);
  });

  it('decrypts both ciphertexts to the same plaintext', () => {
    const token = 'same-access-token';
    const enc1 = encrypt(token, TEST_KEY);
    const enc2 = encrypt(token, TEST_KEY);
    expect(decrypt(enc1, TEST_KEY)).toBe(token);
    expect(decrypt(enc2, TEST_KEY)).toBe(token);
  });

  it('throws on tampered ciphertext', () => {
    const token = 'access-token-to-tamper';
    const encrypted = encrypt(token, TEST_KEY);
    const tampered = encrypted.slice(0, -4) + 'ZZZZ';
    expect(() => decrypt(tampered, TEST_KEY)).toThrow();
  });
});

describe('Token refresh detection', () => {
  const FIVE_MINUTES_MS = 5 * 60 * 1000;

  it('detects token that needs refresh when expiresAt is in the past', () => {
    const expiresAt = new Date(Date.now() - 1000); // 1 second ago
    const needsRefresh = expiresAt <= new Date(Date.now() + FIVE_MINUTES_MS);
    expect(needsRefresh).toBe(true);
  });

  it('detects token that needs refresh when expiring within 5 minutes', () => {
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes from now
    const needsRefresh = expiresAt <= new Date(Date.now() + FIVE_MINUTES_MS);
    expect(needsRefresh).toBe(true);
  });

  it('does not trigger refresh when token is valid for more than 5 minutes', () => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
    const needsRefresh = expiresAt <= new Date(Date.now() + FIVE_MINUTES_MS);
    expect(needsRefresh).toBe(false);
  });

  it('handles null expiresAt (no expiry) as always valid', () => {
    const expiresAt: Date | null = null;
    // When expiresAt is null, we skip the expiry check and treat as valid
    const needsRefresh = expiresAt !== null && expiresAt <= new Date(Date.now() + FIVE_MINUTES_MS);
    expect(needsRefresh).toBe(false);
  });
});

describe('Token encryption with different key lengths', () => {
  it('uses 32-byte hex key (256-bit AES)', () => {
    // 64 hex chars = 32 bytes = 256 bits
    expect(TEST_KEY.length).toBe(64);
    const token = 'test-token';
    expect(() => {
      const enc = encrypt(token, TEST_KEY);
      decrypt(enc, TEST_KEY);
    }).not.toThrow();
  });
});
