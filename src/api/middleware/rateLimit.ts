// =============================================================================
// src/api/middleware/rateLimit.ts
// Per-Source Rate Limiting Middleware with Redis Backend
// =============================================================================

import type { FastifyRequest, FastifyReply } from 'fastify';
import { getRedisConnection } from '../../config/redis.js';
import { config } from '../../config/index.js';
import { RateLimitError } from '../../errors/index.js';

// =============================================================================
// Types
// =============================================================================

interface RateLimitConfig {
  /** Maximum requests allowed in the time window */
  max: number;
  /** Time window in milliseconds */
  timeWindow: number;
  /** Custom key prefix for Redis */
  keyPrefix?: string;
  /** Skip rate limiting for certain conditions */
  skip?: (request: FastifyRequest) => boolean;
  /** Custom identifier extraction (defaults to apiKeySource or IP) */
  keyGenerator?: (request: FastifyRequest) => string;
}

interface RateLimitInfo {
  /** Total requests allowed */
  limit: number;
  /** Remaining requests in current window */
  remaining: number;
  /** Timestamp when the rate limit resets (in seconds) */
  reset: number;
  /** Number of seconds until reset */
  retryAfter?: number;
}

// =============================================================================
// Constants
// =============================================================================

const RATE_LIMIT_PREFIX = 'ratelimit';
const LUA_SLIDING_WINDOW = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local windowStart = now - window

-- Remove old entries outside the window
redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

-- Count current requests in window
local count = redis.call('ZCARD', key)

if count < max then
  -- Add current request timestamp
  redis.call('ZADD', key, now, now .. '-' .. math.random())
  -- Set expiry on the key
  redis.call('PEXPIRE', key, window)
  return {count + 1, 0}
else
  -- Rate limited - return oldest entry time for retry calculation
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retryAfter = 0
  if #oldest > 0 then
    retryAfter = math.ceil((tonumber(oldest[2]) + window - now) / 1000)
  end
  return {count, retryAfter}
end
`;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the rate limit identifier for a request.
 * Priority: apiKeySource > X-Forwarded-For > IP address
 */
function getIdentifier(request: FastifyRequest): string {
  // Use API key source if authenticated
  if (request.apiKeySource) {
    return `source:${request.apiKeySource}`;
  }

  // Fall back to IP address
  const forwardedFor = request.headers['x-forwarded-for'];
  const ip = forwardedFor
    ? (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0].trim())
    : request.ip;

  return `ip:${ip}`;
}

/**
 * Build the Redis key for rate limiting.
 */
function buildKey(prefix: string, identifier: string): string {
  return `${prefix}:${identifier}`;
}

// =============================================================================
// Rate Limit Middleware Factory
// =============================================================================

/**
 * Creates a rate limiting middleware with configurable options.
 * Uses Redis with sliding window algorithm for distributed rate limiting.
 *
 * @example
 * // Basic usage with defaults from config
 * fastify.addHook('preHandler', createRateLimiter());
 *
 * @example
 * // Custom limits for specific routes
 * fastify.addHook('preHandler', createRateLimiter({
 *   max: 10,
 *   timeWindow: 60000, // 1 minute
 *   keyPrefix: 'api:heavy'
 * }));
 */
export function createRateLimiter(options: Partial<RateLimitConfig> = {}) {
  const {
    max = config.rateLimit.max,
    timeWindow = config.rateLimit.timeWindow,
    keyPrefix = RATE_LIMIT_PREFIX,
    skip,
    keyGenerator = getIdentifier
  } = options;

  return async function rateLimitMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Skip rate limiting if configured
    if (skip && skip(request)) {
      return;
    }

    const redis = getRedisConnection();
    const identifier = keyGenerator(request);
    const key = buildKey(keyPrefix, identifier);
    const now = Date.now();

    try {
      // Execute Lua script for atomic rate limiting
      const result = await redis.eval(
        LUA_SLIDING_WINDOW,
        1,
        key,
        now.toString(),
        timeWindow.toString(),
        max.toString()
      ) as [number, number];

      const [count, retryAfter] = result;
      const remaining = Math.max(0, max - count);
      const resetTime = Math.ceil((now + timeWindow) / 1000);

      // Set rate limit headers
      reply.header('X-RateLimit-Limit', max.toString());
      reply.header('X-RateLimit-Remaining', remaining.toString());
      reply.header('X-RateLimit-Reset', resetTime.toString());

      // Check if rate limited
      if (count > max) {
        reply.header('Retry-After', retryAfter.toString());

        request.log.warn({
          identifier,
          count,
          max,
          retryAfter
        }, 'Rate limit exceeded');

        throw new RateLimitError(retryAfter);
      }

      request.log.debug({
        identifier,
        remaining,
        max
      }, 'Rate limit check passed');
    } catch (error) {
      // Re-throw rate limit errors
      if (error instanceof RateLimitError) {
        throw error;
      }

      // Log Redis errors but don't block the request
      request.log.error({
        err: error,
        identifier
      }, 'Rate limit check failed, allowing request');

      // In case of Redis failure, allow the request through
      // This prevents rate limiting from blocking all traffic if Redis is down
    }
  };
}

// =============================================================================
// Pre-configured Rate Limiters
// =============================================================================

/**
 * Default rate limiter using global configuration.
 */
export const defaultRateLimiter = createRateLimiter();

/**
 * Strict rate limiter for sensitive endpoints (e.g., auth, bulk operations).
 * 10 requests per minute.
 */
export const strictRateLimiter = createRateLimiter({
  max: 10,
  timeWindow: 60000,
  keyPrefix: `${RATE_LIMIT_PREFIX}:strict`
});

/**
 * Relaxed rate limiter for read-heavy endpoints.
 * 500 requests per minute.
 */
export const relaxedRateLimiter = createRateLimiter({
  max: 500,
  timeWindow: 60000,
  keyPrefix: `${RATE_LIMIT_PREFIX}:relaxed`
});

/**
 * Webhook rate limiter per source.
 * 1000 requests per minute per source.
 */
export const webhookRateLimiter = createRateLimiter({
  max: 1000,
  timeWindow: 60000,
  keyPrefix: `${RATE_LIMIT_PREFIX}:webhook`
});

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get current rate limit info for an identifier without incrementing.
 * Useful for displaying rate limit status.
 */
export async function getRateLimitInfo(
  identifier: string,
  options: Partial<RateLimitConfig> = {}
): Promise<RateLimitInfo> {
  const {
    max = config.rateLimit.max,
    timeWindow = config.rateLimit.timeWindow,
    keyPrefix = RATE_LIMIT_PREFIX
  } = options;

  const redis = getRedisConnection();
  const key = buildKey(keyPrefix, identifier);
  const now = Date.now();
  const windowStart = now - timeWindow;

  // Remove old entries and count
  await redis.zremrangebyscore(key, '-inf', windowStart);
  const count = await redis.zcard(key);

  const remaining = Math.max(0, max - count);
  const reset = Math.ceil((now + timeWindow) / 1000);

  return {
    limit: max,
    remaining,
    reset
  };
}

/**
 * Reset rate limit for a specific identifier.
 * Useful for administrative purposes.
 */
export async function resetRateLimit(
  identifier: string,
  keyPrefix: string = RATE_LIMIT_PREFIX
): Promise<void> {
  const redis = getRedisConnection();
  const key = buildKey(keyPrefix, identifier);
  await redis.del(key);
}

/**
 * Reset all rate limits (use with caution).
 */
export async function resetAllRateLimits(
  keyPrefix: string = RATE_LIMIT_PREFIX
): Promise<number> {
  const redis = getRedisConnection();
  const pattern = `${keyPrefix}:*`;
  
  let cursor = '0';
  let deletedCount = 0;

  do {
    const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = newCursor;

    if (keys.length > 0) {
      await redis.del(...keys);
      deletedCount += keys.length;
    }
  } while (cursor !== '0');

  return deletedCount;
}

// =============================================================================
// Default Export
// =============================================================================

export default createRateLimiter;
