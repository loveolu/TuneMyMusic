import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../src/utils/encryption.js';

describe('encryption', () => {
  const testKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  it('encrypts and decrypts a string', () => {
    const plaintext = 'my-secret-oauth-token';
    const encrypted = encrypt(plaintext, testKey);
    expect(encrypted).not.toBe(plaintext);
    const decrypted = decrypt(encrypted, testKey);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const plaintext = 'same-input';
    const a = encrypt(plaintext, testKey);
    const b = encrypt(plaintext, testKey);
    expect(a).not.toBe(b);
  });

  it('throws on tampered ciphertext', () => {
    const encrypted = encrypt('test', testKey);
    const tampered = encrypted.slice(0, -4) + 'XXXX';
    expect(() => decrypt(tampered, testKey)).toThrow();
  });
});
