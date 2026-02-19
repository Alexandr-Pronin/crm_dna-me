// =============================================================================
// src/workers/emailSyncWorker.ts
// E-Mail Sync Worker – BullMQ Worker mit verbessertem Threading-Support
// Synchronisiert E-Mail-Konten via IMAP und ordnet Nachrichten mittels
// Multi-Level-Matching-Strategie den passenden Konversationen zu.
// =============================================================================

import { Worker, Queue, Job } from 'bullmq';
import { redisOptions } from '../config/redis.js';
import { getEmailSyncService, type SyncResult, type SyncRunResult } from '../services/emailSyncService.js';

// =============================================================================
// Constants
// =============================================================================

const LOG_PREFIX = '[EmailSyncWorker]';
const QUEUE_NAME = 'email-sync';

/** Default sync interval in minutes. */
const DEFAULT_SYNC_INTERVAL_MINUTES = 5;

/** Maximum parallel IMAP connections (one per account, but limited). */
const WORKER_CONCURRENCY = 3;

/** Rate limit: max sync jobs per minute (protects IMAP servers). */
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_DURATION_MS = 60_000;

// =============================================================================
// Job Types
// =============================================================================

export interface EmailSyncJobData {
  /** Type of sync job to process. */
  type: 'sync_all_accounts' | 'sync_single_account' | 'test_connection';
  /** Account ID – required for sync_single_account and test_connection. */
  accountId?: string;
  /** Who triggered the job (cron scheduler or manual API trigger). */
  triggeredBy?: 'cron' | 'manual' | 'api';
}

export interface EmailSyncJobResult {
  success: boolean;
  type: string;
  /** Full sync-run result (for sync_all_accounts). */
  syncRun?: SyncRunResult;
  /** Single account result (for sync_single_account). */
  accountResult?: SyncResult;
  /** Connection test result (for test_connection). */
  connectionTest?: { accountId: string; connected: boolean; error?: string };
  /** Execution duration in milliseconds. */
  executionTimeMs: number;
}

// =============================================================================
// Queue Singleton
// =============================================================================

let emailSyncQueue: Queue<EmailSyncJobData> | null = null;

export function getEmailSyncQueue(): Queue<EmailSyncJobData> {
  if (!emailSyncQueue) {
    emailSyncQueue = new Queue<EmailSyncJobData>(QUEUE_NAME, {
      connection: redisOptions,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 30_000, // 30 s initial retry delay
        },
        removeOnComplete: {
          age: 24 * 60 * 60, // keep completed jobs for 24 h
          count: 500,
        },
        removeOnFail: {
          age: 7 * 24 * 60 * 60, // keep failed jobs for 7 days
          count: 2000,
        },
      },
    });
  }
  return emailSyncQueue;
}

// =============================================================================
// Worker Creation
// =============================================================================

export function createEmailSyncWorker(): Worker<EmailSyncJobData, EmailSyncJobResult> {
  const worker = new Worker<EmailSyncJobData, EmailSyncJobResult>(
    QUEUE_NAME,
    async (job: Job<EmailSyncJobData>): Promise<EmailSyncJobResult> => {
      const { type, accountId, triggeredBy } = job.data;
      const startTime = Date.now();

      console.log(
        `${LOG_PREFIX} Processing job ${job.id}: type=${type}` +
        (accountId ? ` accountId=${accountId}` : '') +
        ` (triggered by: ${triggeredBy ?? 'unknown'})`
      );

      try {
        switch (type) {
          case 'sync_all_accounts':
            return await handleSyncAllAccounts(startTime, job);

          case 'sync_single_account':
            if (!accountId) {
              throw new Error('accountId is required for sync_single_account');
            }
            return await handleSyncSingleAccount(accountId, startTime);

          case 'test_connection':
            if (!accountId) {
              throw new Error('accountId is required for test_connection');
            }
            return await handleTestConnection(accountId, startTime);

          default:
            throw new Error(`Unknown job type: ${type}`);
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`${LOG_PREFIX} Job ${job.id} failed:`, errMsg);
        throw error; // Re-throw so BullMQ can retry
      }
    },
    {
      connection: redisOptions,
      concurrency: WORKER_CONCURRENCY,
      limiter: {
        max: RATE_LIMIT_MAX,
        duration: RATE_LIMIT_DURATION_MS,
      },
    },
  );

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  worker.on('completed', (job, result) => {
    const summary =
      result.syncRun
        ? `${result.syncRun.totalNew} new, ${result.syncRun.totalErrors} errors`
        : result.accountResult
          ? `${result.accountResult.newMessages} new, ${result.accountResult.errors.length} errors`
          : result.connectionTest
            ? `connected=${result.connectionTest.connected}`
            : 'done';

    console.log(
      `${LOG_PREFIX} Job ${job.id} completed in ${result.executionTimeMs}ms — ${summary}`
    );
  });

  worker.on('failed', (job, error) => {
    console.error(
      `${LOG_PREFIX} Job ${job?.id} FAILED (attempt ${job?.attemptsMade}/${job?.opts?.attempts ?? '?'}):`,
      error.message,
    );
  });

  worker.on('error', (error) => {
    console.error(`${LOG_PREFIX} Worker error:`, error.message);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`${LOG_PREFIX} Job ${jobId} stalled — will be retried`);
  });

  return worker;
}

// =============================================================================
// Job Handlers
// =============================================================================

/**
 * Synchronizes ALL enabled email accounts.
 * Reports per-account progress via job.updateProgress().
 */
async function handleSyncAllAccounts(
  startTime: number,
  job: Job<EmailSyncJobData>,
): Promise<EmailSyncJobResult> {
  const emailSyncService = getEmailSyncService();
  const syncRun = await emailSyncService.syncAllAccounts();

  // Report progress (useful for monitoring dashboards)
  await job.updateProgress({
    accountsSynced: syncRun.accounts.length,
    totalNew: syncRun.totalNew,
    totalErrors: syncRun.totalErrors,
  });

  return {
    success: syncRun.totalErrors === 0,
    type: 'sync_all_accounts',
    syncRun,
    executionTimeMs: Date.now() - startTime,
  };
}

/**
 * Synchronizes a single email account by ID.
 */
async function handleSyncSingleAccount(
  accountId: string,
  startTime: number,
): Promise<EmailSyncJobResult> {
  const emailSyncService = getEmailSyncService();
  const accountResult = await emailSyncService.syncEmailAccount(accountId);

  return {
    success: accountResult.success,
    type: 'sync_single_account',
    accountResult,
    executionTimeMs: Date.now() - startTime,
  };
}

/**
 * Tests the IMAP connection for a specific email account (no sync).
 */
async function handleTestConnection(
  accountId: string,
  startTime: number,
): Promise<EmailSyncJobResult> {
  const emailSyncService = getEmailSyncService();
  const testResult = await emailSyncService.testImapConnection(accountId);

  return {
    success: testResult.success,
    type: 'test_connection',
    connectionTest: {
      accountId,
      connected: testResult.success,
      error: testResult.error,
    },
    executionTimeMs: Date.now() - startTime,
  };
}

// =============================================================================
// Scheduled Job Setup
// =============================================================================

/**
 * Registers the repeatable cron job that triggers a full sync every N minutes.
 * Call this once when the worker process starts.
 */
export async function setupEmailSyncJob(
  intervalMinutes: number = DEFAULT_SYNC_INTERVAL_MINUTES,
): Promise<void> {
  const queue = getEmailSyncQueue();

  // Remove any existing repeatable job (so we can update the schedule)
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === 'email-sync-all') {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  // Cron pattern: every N minutes
  const cronPattern = `*/${intervalMinutes} * * * *`;

  await queue.add(
    'email-sync-all',
    { type: 'sync_all_accounts', triggeredBy: 'cron' },
    {
      repeat: { pattern: cronPattern },
      jobId: 'email-sync-all-scheduled',
    },
  );

  console.log(
    `${LOG_PREFIX} Scheduled job: email-sync-all (every ${intervalMinutes} minutes — cron: ${cronPattern})`
  );
}

// =============================================================================
// Manual / API Trigger Helpers
// =============================================================================

/**
 * Triggers an immediate full sync of all accounts.
 * Returns the BullMQ job ID so callers can poll for status.
 */
export async function triggerFullSync(): Promise<string> {
  const queue = getEmailSyncQueue();

  const job = await queue.add(
    'email-sync-manual',
    { type: 'sync_all_accounts', triggeredBy: 'manual' },
    { priority: 1 },
  );

  console.log(`${LOG_PREFIX} Manual full-sync triggered: job ${job.id}`);
  return job.id!;
}

/**
 * Triggers an immediate sync for a single email account.
 * Returns the BullMQ job ID.
 */
export async function triggerAccountSync(accountId: string): Promise<string> {
  const queue = getEmailSyncQueue();

  const job = await queue.add(
    'email-sync-account',
    { type: 'sync_single_account', accountId, triggeredBy: 'api' },
    { priority: 1 },
  );

  console.log(`${LOG_PREFIX} Single-account sync triggered for ${accountId}: job ${job.id}`);
  return job.id!;
}

/**
 * Queues an IMAP connection test for a specific account.
 * Returns the BullMQ job ID.
 */
export async function triggerConnectionTest(accountId: string): Promise<string> {
  const queue = getEmailSyncQueue();

  const job = await queue.add(
    'email-sync-test',
    { type: 'test_connection', accountId, triggeredBy: 'api' },
    { priority: 2 },
  );

  console.log(`${LOG_PREFIX} Connection test triggered for ${accountId}: job ${job.id}`);
  return job.id!;
}

// =============================================================================
// Stats / Monitoring
// =============================================================================

/**
 * Returns summary statistics about the email-sync queue.
 * Useful for health-check endpoints and admin dashboards.
 */
export async function getEmailSyncStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  nextScheduledRun: string | null;
}> {
  const queue = getEmailSyncQueue();

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  // Find next scheduled run
  const repeatableJobs = await queue.getRepeatableJobs();
  const scheduledJob = repeatableJobs.find((j) => j.name === 'email-sync-all');

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    nextScheduledRun: scheduledJob?.next
      ? new Date(scheduledJob.next).toISOString()
      : null,
  };
}

export default createEmailSyncWorker;
