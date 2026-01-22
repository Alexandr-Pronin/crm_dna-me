// =============================================================================
// src/api/middleware/hmac.ts
// HMAC Signature Validation Middleware for Webhooks
// =============================================================================

import { createHmac, timingSafeEqual } from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config/index.js';
import { HmacSignatureError } from '../../errors/index.js';

// =============================================================================
// Constants
// =============================================================================

const SIGNATURE_HEADER = 'x-webhook-signature';
const TIMESTAMP_HEADER = 'x-webhook-timestamp';
const SIGNATURE_ALGORITHM = 'sha256';
const MAX_TIMESTAMP_AGE_SECONDS = 300; // 5 minutes

// =============================================================================
// HMAC Validation
// =============================================================================

/**
 * Validates the X-Webhook-Signature header using HMAC-SHA256.
 * Uses timing-safe comparison to prevent timing attacks.
 * 
 * Expected signature format: sha256=<hex_digest>
 * Payload signed: timestamp.body
 */
export async function validateHmacSignature(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const signature = request.headers[SIGNATURE_HEADER];
  const timestamp = request.headers[TIMESTAMP_HEADER];

  // Check for signature header
  if (!signature) {
    throw new HmacSignatureError('Missing X-Webhook-Signature header');
  }

  if (Array.isArray(signature)) {
    throw new HmacSignatureError('Multiple signature headers not allowed');
  }

  // Parse signature format
  const signatureParts = signature.split('=');
  if (signatureParts.length !== 2 || signatureParts[0] !== 'sha256') {
    throw new HmacSignatureError('Invalid signature format. Expected: sha256=<signature>');
  }

  const providedSignature = signatureParts[1];

  // Validate timestamp if provided (replay attack prevention)
  if (timestamp && !Array.isArray(timestamp)) {
    const timestampSeconds = parseInt(timestamp, 10);
    const currentSeconds = Math.floor(Date.now() / 1000);
    const age = currentSeconds - timestampSeconds;

    if (isNaN(timestampSeconds) || age > MAX_TIMESTAMP_AGE_SECONDS) {
      request.log.warn({ age, maxAge: MAX_TIMESTAMP_AGE_SECONDS }, 'Webhook timestamp too old');
      throw new HmacSignatureError('Webhook timestamp expired');
    }
  }

  // Get raw body for signature verification
  const body = request.body;
  const bodyString = typeof body === 'string' ? body : JSON.stringify(body);

  // Build payload to sign
  const payload = timestamp ? `${timestamp}.${bodyString}` : bodyString;

  // Calculate expected signature
  const expectedSignature = createHmac(SIGNATURE_ALGORITHM, config.webhookSecret)
    .update(payload)
    .digest('hex');

  // Timing-safe comparison
  const providedBuffer = Buffer.from(providedSignature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  // Ensure buffers have same length before comparison
  if (providedBuffer.length !== expectedBuffer.length) {
    request.log.warn('Webhook signature length mismatch');
    throw new HmacSignatureError('Invalid webhook signature');
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    request.log.warn('Webhook signature verification failed');
    throw new HmacSignatureError('Invalid webhook signature');
  }

  request.log.debug('Webhook signature validated');
}

// =============================================================================
// Helper: Generate Signature (for testing)
// =============================================================================

/**
 * Generates an HMAC signature for a payload.
 * Useful for testing webhook integrations.
 */
export function generateSignature(payload: string, secret?: string): string {
  const hmac = createHmac(SIGNATURE_ALGORITHM, secret || config.webhookSecret);
  return `sha256=${hmac.update(payload).digest('hex')}`;
}

/**
 * Generates signature with timestamp.
 */
export function generateSignatureWithTimestamp(
  payload: string,
  timestamp?: number,
  secret?: string
): { signature: string; timestamp: string } {
  const ts = timestamp || Math.floor(Date.now() / 1000);
  const payloadWithTimestamp = `${ts}.${payload}`;
  const hmac = createHmac(SIGNATURE_ALGORITHM, secret || config.webhookSecret);
  
  return {
    signature: `sha256=${hmac.update(payloadWithTimestamp).digest('hex')}`,
    timestamp: String(ts)
  };
}

export default validateHmacSignature;
