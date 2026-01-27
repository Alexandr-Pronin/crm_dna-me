// =============================================================================
// src/config/index.ts
// Zod-validated configuration with defaults
// =============================================================================

import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// =============================================================================
// Schema Definition
// =============================================================================

const configSchema = z.object({
  // Server
  port: z.coerce.number().default(3000),
  host: z.string().default('0.0.0.0'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Database (postgres:// URLs don't pass standard URL validation)
  databaseUrl: z.string().startsWith('postgres'),

  // Redis (redis:// URLs don't pass standard URL validation)
  redisUrl: z.string().startsWith('redis'),

  // Security
  jwtSecret: z.string().min(32),
  webhookSecret: z.string().min(16),

  // API Keys (parsed from comma-separated string)
  apiKeys: z.array(z.object({
    key: z.string(),
    source: z.string()
  })).default([]),

  // Moco Integration
  moco: z.object({
    apiKey: z.string().nullish(),
    subdomain: z.string().nullish(),
    enabled: z.boolean().default(false)
  }),

  // Slack Integration
  slack: z.object({
    webhookUrl: z.string().url().nullish(),
    botToken: z.string().nullish(),
    enabled: z.boolean().default(false)
  }),

  // Cituro Integration
  cituro: z.object({
    apiKey: z.string().nullish(),
    subdomain: z.string().nullish(),
    enabled: z.boolean().default(false)
  }),

  // SMTP Configuration
  smtp: z.object({
    host: z.string().nullish(),
    port: z.coerce.number().default(587),
    user: z.string().nullish(),
    pass: z.string().nullish(),
    secure: z.boolean().default(false),
    from: z.string().nullish(),
    fromName: z.string().default('DNA ME'),
    enabled: z.boolean().default(false)
  }),

  // Feature Flags
  features: z.object({
    mocoSync: z.boolean().default(false),
    slackAlerts: z.boolean().default(false),
    scoreDecay: z.boolean().default(true)
  }),

  // Rate Limiting
  rateLimit: z.object({
    max: z.coerce.number().default(100),
    timeWindow: z.coerce.number().default(60000)
  })
});

export type Config = z.infer<typeof configSchema>;

// =============================================================================
// Parse API Keys
// =============================================================================

function parseApiKeys(envValue: string | undefined): Array<{ key: string; source: string }> {
  if (!envValue) return [];
  
  return envValue.split(',').map(pair => {
    const [key, source] = pair.split(':');
    return { key: key.trim(), source: source?.trim() || 'unknown' };
  }).filter(item => item.key);
}

// =============================================================================
// Parse Boolean
// =============================================================================

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

// =============================================================================
// Load and Validate Configuration
// =============================================================================

function loadConfig(): Config {
  const rawConfig = {
    port: process.env.PORT,
    host: process.env.HOST,
    nodeEnv: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    jwtSecret: process.env.JWT_SECRET,
    webhookSecret: process.env.WEBHOOK_SECRET,
    apiKeys: parseApiKeys(process.env.API_KEYS),
    moco: {
      apiKey: process.env.MOCO_API_KEY || undefined,
      subdomain: process.env.MOCO_SUBDOMAIN || process.env.MOCO_ACCOUNT_ID || undefined,
      enabled: parseBoolean(process.env.ENABLE_MOCO_SYNC, false)
    },
    slack: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL || undefined,
      botToken: process.env.SLACK_BOT_TOKEN || undefined,
      enabled: parseBoolean(process.env.ENABLE_SLACK_ALERTS, false)
    },
    cituro: {
      apiKey: process.env.CITURO_API_KEY || undefined,
      subdomain: process.env.CITURO_SUBDOMAIN || undefined,
      enabled: parseBoolean(process.env.ENABLE_CITURO, false)
    },
    smtp: {
      host: process.env.SMTP_HOST || undefined,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER || undefined,
      pass: process.env.SMTP_PASS || undefined,
      secure: parseBoolean(process.env.SMTP_SECURE, false),
      from: process.env.SMTP_FROM || undefined,
      fromName: process.env.SMTP_FROM_NAME || 'DNA ME',
      enabled: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
    },
    features: {
      mocoSync: parseBoolean(process.env.ENABLE_MOCO_SYNC, false),
      slackAlerts: parseBoolean(process.env.ENABLE_SLACK_ALERTS, false),
      scoreDecay: parseBoolean(process.env.ENABLE_SCORE_DECAY, true)
    },
    rateLimit: {
      max: process.env.RATE_LIMIT_MAX,
      timeWindow: process.env.RATE_LIMIT_TIME_WINDOW
    }
  };

  const result = configSchema.safeParse(rawConfig);

  if (!result.success) {
    console.error('❌ Configuration validation failed:');
    console.error(result.error.format());
    throw new Error(`Invalid configuration: ${result.error.message}`);
  }

  return result.data;
}

// =============================================================================
// Export Configuration
// =============================================================================

export const config = loadConfig();

// Helper to check if running in development
export const isDev = config.nodeEnv === 'development';
export const isProd = config.nodeEnv === 'production';
export const isTest = config.nodeEnv === 'test';

export default config;
