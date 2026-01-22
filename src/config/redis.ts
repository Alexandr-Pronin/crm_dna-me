// =============================================================================
// src/config/redis.ts
// Redis connection configuration for BullMQ
// =============================================================================

import { Redis, type RedisOptions } from 'ioredis';
import { config } from './index.js';

// =============================================================================
// Connection Options
// =============================================================================

function parseRedisUrl(url: string): { host: string; port: number; password?: string } {
  // Parse redis://[password@]host[:port]
  const match = url.match(/^redis:\/\/(?:([^@]+)@)?([^:]+)(?::(\d+))?$/);
  if (!match) {
    throw new Error(`Invalid Redis URL: ${url}`);
  }
  return {
    host: match[2],
    port: match[3] ? parseInt(match[3]) : 6379,
    password: match[1] || undefined
  };
}

const redisConfig = parseRedisUrl(config.redisUrl);

export const redisOptions: RedisOptions = {
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy: (times: number) => {
    if (times > 10) {
      console.error('Redis: Max reconnection attempts reached');
      return null;
    }
    const delay = Math.min(times * 100, 3000);
    console.log(`Redis: Reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  }
};

// =============================================================================
// Create Redis Connection
// =============================================================================

let redisConnection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis(redisOptions);

    redisConnection.on('connect', () => {
      console.log('✅ Redis connected');
    });

    redisConnection.on('error', (err: Error) => {
      console.error('❌ Redis error:', err.message);
    });

    redisConnection.on('close', () => {
      console.log('Redis connection closed');
    });
  }

  return redisConnection;
}

// =============================================================================
// Test Connection
// =============================================================================

export async function testRedisConnection(): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

// =============================================================================
// Close Connection
// =============================================================================

export async function closeRedisConnection(): Promise<void> {
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
    console.log('Redis connection closed gracefully');
  }
}

export { redisConnection };
