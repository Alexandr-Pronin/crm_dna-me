// =============================================================================
// src/utils/crypto.ts
// AES-256-GCM Encryption Utilities for sensitive data (passwords, tokens)
// =============================================================================

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

// Lazy-loaded encryption key (validated on first use, not at import time)
let _encryptionKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (_encryptionKey) return _encryptionKey;

  const keyHex = process.env.ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      'ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  _encryptionKey = Buffer.from(keyHex, 'hex');

  if (_encryptionKey.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_KEY must decode to exactly ${KEY_LENGTH} bytes.`);
  }

  return _encryptionKey;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * Returns a combined string in the format: iv:authTag:ciphertext (all hex-encoded).
 * The IV is randomly generated per encryption call, ensuring unique ciphertexts
 * even for identical plaintexts.
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a string that was encrypted with `encrypt()`.
 *
 * Expects the format: iv:authTag:ciphertext (all hex-encoded).
 * Throws if the data has been tampered with (GCM authentication failure).
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format. Expected iv:authTag:ciphertext');
  }

  const [ivHex, authTagHex, ciphertext] = parts;

  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error('Invalid encrypted data format. All parts must be non-empty.');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}`);
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Checks whether a string looks like it was encrypted by `encrypt()`.
 * This is a format check only — it does NOT verify decryptability.
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  if (parts.length !== 3) return false;

  const [ivHex, authTagHex, ciphertext] = parts;

  return (
    /^[0-9a-fA-F]{32}$/.test(ivHex) &&       // 16 bytes IV = 32 hex chars
    /^[0-9a-fA-F]{32}$/.test(authTagHex) &&   // 16 bytes auth tag = 32 hex chars
    /^[0-9a-fA-F]+$/.test(ciphertext) &&       // non-empty hex ciphertext
    ciphertext.length > 0
  );
}

/**
 * Generates a new random encryption key (for initial setup / key rotation).
 * Returns a 64-character hex string (32 bytes).
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Resets the cached encryption key. Useful for testing or key rotation.
 * After calling this, the next encrypt/decrypt call will re-read ENCRYPTION_KEY from env.
 */
export function resetEncryptionKey(): void {
  _encryptionKey = null;
}
