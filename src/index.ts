// =============================================================================
// src/index.ts
// DNA Marketing Engine - Main Entry Point
// =============================================================================

import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { config, isDev } from './config/index.js';
import { loadIntegrationSettingsCache } from './config/integrationSettings.js';
import { db, closePool } from './db/index.js';
import { getRedisConnection, closeRedisConnection } from './config/redis.js';
import { initializeQueues, closeQueues } from './config/queues.js';
import { errorHandler, notFoundHandler } from './api/middleware/errorHandler.js';
import { authRoutes } from './api/routes/auth.js';
import { eventsRoutes } from './api/routes/events.js';
import { leadsRoutes } from './api/routes/leads.js';
import { scoringRoutes } from './api/routes/scoring.js';
import { routingRoutes } from './api/routes/routing.js';
import { pipelinesRoutes } from './api/routes/pipelines.js';
import { dealsRoutes } from './api/routes/deals.js';
import { integrationsRoutes } from './api/routes/integrations.js';
import { tasksRoutes } from './api/routes/tasks.js';
import { automationRoutes } from './api/routes/automation.js';
import { gdprRoutes } from './api/routes/gdpr.js';
import { reportsRoutes } from './api/routes/reports.js';
import { teamRoutes } from './api/routes/team.js';
import { campaignsRoutes } from './api/routes/campaigns.js';
import { communicationsRoutes } from './api/routes/communications.js';
import { organizationsRoutes } from './api/routes/organizations.js';
import { triggersRoutes } from './api/routes/triggers.js';
import { emailRoutes } from './api/routes/email.js';
import { sequencesRoutes } from './api/routes/sequences.js';
import { conversationsRoutes } from './api/routes/conversations.js';
import { linkedinRoutes } from './api/routes/linkedin.js';
import { emailAccountsRoutes } from './api/routes/emailAccounts.js';
import { emailImportRoutes } from './api/routes/emailImport.js';
import { webhooksRoutes } from './api/routes/webhooks.js';
import { adminRoutes } from './api/routes/admin.js';
import type { HealthCheckResponse } from './types/index.js';

// =============================================================================
// Create Fastify Instance
// =============================================================================

const fastify = Fastify({
  logger: {
    level: config.logLevel,
    transport: isDev ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname'
      }
    } : undefined
  },
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'requestId'
});

// =============================================================================
// Plugins
// =============================================================================

await fastify.register(cors, {
  origin: isDev ? true : (config.corsOrigin ? config.corsOrigin.split(',').map((o) => o.trim()) : ['https://crm.dna-me.com']),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Webhook-Signature', 'X-CITURO-SIGNATURE', 'X-Request-ID', 'X-Correlation-ID'],
  credentials: true
});

await fastify.register(jwt, {
  secret: config.jwtSecret
});

fastify.decorate('authenticate', async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

// =============================================================================
// Error Handling
// =============================================================================

fastify.setErrorHandler(errorHandler);
fastify.setNotFoundHandler(notFoundHandler);

// =============================================================================
// Health Check Endpoints
// =============================================================================

fastify.get('/health', async (): Promise<HealthCheckResponse> => {
  const dbHealthy = await db.healthCheck();
  
  let redisHealthy = false;
  try {
    const redis = getRedisConnection();
    const pong = await redis.ping();
    redisHealthy = pong === 'PONG';
  } catch {
    redisHealthy = false;
  }

  const isHealthy = dbHealthy && redisHealthy;

  return {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      database: dbHealthy,
      redis: redisHealthy
    }
  };
});

fastify.get('/ready', async (_request, reply) => {
  const dbHealthy = await db.healthCheck();
  
  if (!dbHealthy) {
    reply.code(503);
    return { ready: false, reason: 'Database not available' };
  }

  return { ready: true };
});

// =============================================================================
// Database Stats Endpoint (Development only)
// =============================================================================

if (isDev) {
  fastify.get('/debug/db-stats', async () => {
    return {
      pool: db.getStats(),
      timestamp: new Date().toISOString()
    };
  });
}

// =============================================================================
// Root Endpoint
// =============================================================================

fastify.get('/', async () => {
  return {
    name: 'DNA Marketing Engine',
    version: '1.0.0',
    status: 'running',
    docs: '/docs',
    health: '/health'
  };
});

// =============================================================================
// API Routes
// =============================================================================

await fastify.register(authRoutes, { prefix: '/api/v1' });
await fastify.register(eventsRoutes, { prefix: '/api/v1' });
await fastify.register(leadsRoutes, { prefix: '/api/v1' });
await fastify.register(scoringRoutes, { prefix: '/api/v1' });
await fastify.register(routingRoutes, { prefix: '/api/v1' });
await fastify.register(pipelinesRoutes, { prefix: '/api/v1' });
await fastify.register(dealsRoutes, { prefix: '/api/v1' });
await fastify.register(integrationsRoutes, { prefix: '/api/v1' });
await fastify.register(tasksRoutes, { prefix: '/api/v1' });
await fastify.register(automationRoutes, { prefix: '/api/v1' });
await fastify.register(gdprRoutes, { prefix: '/api/v1' });
await fastify.register(reportsRoutes, { prefix: '/api/v1' });
await fastify.register(teamRoutes, { prefix: '/api/v1' });
await fastify.register(campaignsRoutes, { prefix: '/api/v1' });
await fastify.register(communicationsRoutes, { prefix: '/api/v1' });
await fastify.register(organizationsRoutes, { prefix: '/api/v1' });
await fastify.register(triggersRoutes, { prefix: '/api/v1' });
await fastify.register(emailRoutes, { prefix: '/api/v1' });
await fastify.register(sequencesRoutes, { prefix: '/api/v1' });
await fastify.register(conversationsRoutes, { prefix: '/api/v1' });
await fastify.register(linkedinRoutes, { prefix: '/api/v1' });
await fastify.register(emailAccountsRoutes, { prefix: '/api/v1' });
await fastify.register(emailImportRoutes, { prefix: '/api/v1' });
await fastify.register(adminRoutes, { prefix: '/api/v1' });
await fastify.register(webhooksRoutes, { prefix: '/api' });

// =============================================================================
// Graceful Shutdown
// =============================================================================

const shutdown = async (signal: string) => {
  fastify.log.info(`Received ${signal}, shutting down gracefully...`);
  
  try {
    // Close HTTP server
    await fastify.close();
    fastify.log.info('HTTP server closed');

    // Close queues
    await closeQueues();
    fastify.log.info('BullMQ queues closed');

    // Close Redis
    await closeRedisConnection();
    fastify.log.info('Redis connection closed');

    // Close database pool
    await closePool();
    fastify.log.info('Database pool closed');

    process.exit(0);
  } catch (error: unknown) {
    fastify.log.error({ err: error }, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// =============================================================================
// Start Server
// =============================================================================

const start = async () => {
  try {
    // Initialize database connection
    fastify.log.info('Connecting to database...');
    try {
      const dbHealthy = await db.healthCheck();
      if (!dbHealthy) {
        throw new Error('Database health check returned false');
      }
    } catch (dbError) {
      const err = dbError as Error;
      fastify.log.error({ err, message: err.message }, 'Database connection error');
      throw new Error(`Failed to connect to database: ${err.message}`);
    }
    fastify.log.info('✅ Database connected');

    // Load DB-backed integration config (Moco, etc.) into memory
    await loadIntegrationSettingsCache();
    fastify.log.info('✅ Integration settings cache loaded');

    // Initialize Redis connection
    fastify.log.info('Connecting to Redis...');
    getRedisConnection();
    fastify.log.info('✅ Redis connected');

    // Initialize BullMQ queues
    fastify.log.info('Initializing queues...');
    initializeQueues();
    fastify.log.info('✅ Queues initialized');

    // Start listening
    await fastify.listen({ 
      port: config.port, 
      host: config.host 
    });

    fastify.log.info(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🧬 DNA Marketing Engine v1.0.0                          ║
║                                                           ║
║   Server running at http://${config.host}:${config.port}              ║
║   Environment: ${config.nodeEnv.padEnd(11)}                           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);

  } catch (error) {
    const err = error as Error;
    fastify.log.error({ err, message: err.message, stack: err.stack }, 'Failed to start server');
    console.error('❌ Startup Error:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
};

start();

export default fastify;
