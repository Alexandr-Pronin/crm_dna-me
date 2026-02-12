// =============================================================================
// src/api/middleware/apiKey.ts
// API Key Authentication Middleware
// =============================================================================

import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config/index.js';
import { ApiKeyError } from '../../errors/index.js';

// =============================================================================
// Types
// =============================================================================

declare module 'fastify' {
  interface FastifyRequest {
    apiKeySource?: string;
  }
}

// =============================================================================
// API Key Validation
// =============================================================================

/**
 * Validates the X-API-Key header against configured API keys.
 * Attaches the source to the request for audit logging.
 */
export async function validateApiKey(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const apiKey = request.headers['x-api-key'];

  if (!apiKey) {
    throw new ApiKeyError('Missing X-API-Key header');
  }

  if (Array.isArray(apiKey)) {
    throw new ApiKeyError('Multiple X-API-Key headers not allowed');
  }

  // Find matching API key in configuration
  const keyConfig = config.apiKeys.find(k => k.key === apiKey);

  if (!keyConfig) {
    request.log.warn({ apiKey: apiKey.slice(0, 8) + '...' }, 'Invalid API key attempt');
    throw new ApiKeyError('Invalid API key');
  }

  // Attach source to request for downstream use
  request.apiKeySource = keyConfig.source;

  request.log.debug({ source: keyConfig.source }, 'API key validated');
}

// =============================================================================
// Optional API Key (for endpoints that work with or without auth)
// =============================================================================

export async function optionalApiKey(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const apiKey = request.headers['x-api-key'];

  if (!apiKey) {
    return; // No key provided, continue without source
  }

  if (Array.isArray(apiKey)) {
    return; // Invalid format, continue without source
  }

  const keyConfig = config.apiKeys.find(k => k.key === apiKey);

  if (keyConfig) {
    request.apiKeySource = keyConfig.source;
  }
}

export default validateApiKey;
