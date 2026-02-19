// =============================================================================
// src/workers/index.ts
// BullMQ Workers Entry Point
// =============================================================================

import { Worker } from 'bullmq';
import { config } from '../config/index.js';
import { getRedisConnection, closeRedisConnection } from '../config/redis.js';
import { closePool } from '../db/index.js';
import { createEventWorker } from './eventWorker.js';
import { createRoutingWorker } from './routingWorker.js';
import { createSyncWorker } from './syncWorker.js';
import { createDecayWorker, setupDecayJob } from './decayWorker.js';
import { createDailyDigestWorker, setupDailyDigestJob } from './dailyDigestWorker.js';
import { createEmailSequenceWorker, setupEmailSequenceJob } from './emailSequenceWorker.js';
import { createEmailSyncWorker, setupEmailSyncJob } from './emailSyncWorker.js';
import { createNotificationWorker } from './notificationWorker.js';
import { getEmailService } from '../services/emailService.js';
import { getScoringEngine } from '../services/scoringEngine.js';
import { getIntentDetector } from '../services/intentDetector.js';
import { getPipelineRouter } from '../services/pipelineRouter.js';
import { getMocoService } from '../integrations/moco.js';
import { getSlackService } from '../integrations/slack.js';
import { getAutomationEngine } from '../services/automationEngine.js';

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🧬 DNA Marketing Engine - Workers                       ║
║                                                           ║
║   Environment: ${config.nodeEnv.padEnd(11)}                           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// =============================================================================
// Worker Registry
// =============================================================================

const workers: Worker[] = [];

// =============================================================================
// Initialize Workers
// =============================================================================

async function initializeWorkers() {
  console.log('Initializing workers...');

  // Initialize Redis connection
  getRedisConnection();
  console.log('✅ Redis connected');

  // Initialize Scoring Engine and load rules
  const scoringEngine = getScoringEngine();
  await scoringEngine.loadRules();
  console.log('✅ Scoring Engine initialized');

  // Initialize Intent Detector
  const intentDetector = getIntentDetector();
  await intentDetector.initialize();
  console.log('✅ Intent Detector initialized');

  // Initialize Automation Engine
  const automationEngine = getAutomationEngine();
  await automationEngine.loadRules();
  console.log(`✅ Automation Engine initialized (${automationEngine.getRulesCount()} rules loaded)`);

  // Event Worker - processes incoming marketing events
  const eventWorker = createEventWorker(scoringEngine, intentDetector, automationEngine);
  workers.push(eventWorker);
  console.log('✅ Event Worker started (concurrency: 10, with Scoring + Intent + Automation)');

  // Initialize Pipeline Router
  const pipelineRouter = getPipelineRouter();
  console.log('✅ Pipeline Router initialized');

  // Routing Worker - evaluates and routes leads to pipelines
  const routingWorker = createRoutingWorker(pipelineRouter);
  workers.push(routingWorker);
  console.log('✅ Routing Worker started (concurrency: 5)');

  // Initialize Moco Service
  const mocoService = getMocoService();
  if (mocoService.isConfigured()) {
    console.log('✅ Moco Service initialized');
  } else {
    console.log('⚠️ Moco Service not configured (missing API key or subdomain)');
  }

  // Initialize Slack Service
  const slackService = getSlackService();
  if (slackService.isConfigured()) {
    console.log('✅ Slack Service initialized');
  } else {
    console.log('⚠️ Slack Service not configured (missing webhook URL)');
  }

  // Sync Worker - handles Moco and Slack synchronization
  const syncWorker = createSyncWorker(mocoService, slackService);
  workers.push(syncWorker);
  console.log('✅ Sync Worker started (concurrency: 3, rate limit: 10/sec)');

  // Decay Worker - handles daily score decay
  if (config.features.scoreDecay) {
    const decayWorker = createDecayWorker();
    workers.push(decayWorker);
    await setupDecayJob();
    console.log('✅ Decay Worker started (scheduled: 2:00 AM daily)');
  } else {
    console.log('⚠️ Decay Worker disabled (ENABLE_SCORE_DECAY=false)');
  }

  // Daily Digest Worker - sends daily marketing stats to Slack
  if (config.features.slackAlerts && slackService.isConfigured()) {
    const dailyDigestWorker = createDailyDigestWorker();
    workers.push(dailyDigestWorker);
    await setupDailyDigestJob();
    console.log('✅ Daily Digest Worker started (scheduled: 8:00 AM daily)');
  } else {
    console.log('⚠️ Daily Digest Worker disabled (Slack not configured or ENABLE_SLACK_ALERTS=false)');
  }

  // Email Sequence Worker - processes email sequences
  const emailService = getEmailService();
  if (emailService.checkConfiguration()) {
    const emailSequenceWorker = createEmailSequenceWorker();
    workers.push(emailSequenceWorker);
    await setupEmailSequenceJob();
    console.log('✅ Email Sequence Worker started (scheduled: every 15 minutes)');
  } else {
    console.log('⚠️ Email Sequence Worker disabled (SMTP not configured)');
  }

  // Email Sync Worker - synchronizes IMAP email accounts into conversations
  const emailSyncWorker = createEmailSyncWorker();
  workers.push(emailSyncWorker);
  await setupEmailSyncJob();
  console.log('✅ Email Sync Worker started (scheduled: every 5 minutes, concurrency: 3)');

  // Notification Worker - processes email and Slack notifications
  const notificationWorker = createNotificationWorker();
  workers.push(notificationWorker);
  console.log('✅ Notification Worker started (concurrency: 5)');

  console.log(`✅ ${workers.length} worker(s) initialized`);
  console.log('Workers are ready and waiting for jobs...');
}

// =============================================================================
// Graceful Shutdown
// =============================================================================

const shutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}, shutting down workers...`);

  try {
    // Close all workers
    console.log(`Closing ${workers.length} worker(s)...`);
    await Promise.all(workers.map(worker => worker.close()));
    console.log('✅ All workers closed');

    // Close Redis connection
    await closeRedisConnection();
    console.log('✅ Redis connection closed');

    // Close database pool
    await closePool();
    console.log('✅ Database pool closed');

    console.log('Workers shut down gracefully');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// =============================================================================
// Start Workers
// =============================================================================

initializeWorkers().catch((error) => {
  console.error('Failed to initialize workers:', error);
  process.exit(1);
});
