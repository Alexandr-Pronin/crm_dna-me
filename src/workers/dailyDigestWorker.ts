// =============================================================================
// src/workers/dailyDigestWorker.ts
// Daily Digest Worker - Scheduled job to send daily marketing stats via Slack
// =============================================================================

import { Worker, Job } from 'bullmq';
import { db } from '../db/index.js';
import { redisOptions } from '../config/redis.js';
import { getScheduledQueue, QUEUE_NAMES } from '../config/queues.js';
import { config } from '../config/index.js';
import { getSlackService } from '../integrations/slack.js';

// =============================================================================
// Types
// =============================================================================

interface DailyDigestJobData {
  triggered_by?: 'cron' | 'manual';
  force?: boolean;
}

interface DailyDigestStats {
  new_leads: number;
  hot_leads: number;
  deals_created: number;
  deals_won: number;
  total_value: number;
  top_sources: Array<{ source: string; count: number }>;
}

interface DigestResult {
  stats: DailyDigestStats;
  sent: boolean;
  execution_time_ms: number;
}

// =============================================================================
// Setup Daily Digest Job (Scheduled)
// =============================================================================

/**
 * Schedule the daily digest job
 * Runs at 8:00 AM every day (workday start)
 */
export async function setupDailyDigestJob(): Promise<void> {
  if (!config.features.slackAlerts) {
    console.log('[DailyDigestWorker] Slack alerts disabled, skipping daily digest scheduling');
    return;
  }

  const slackService = getSlackService();
  if (!slackService.isConfigured()) {
    console.log('[DailyDigestWorker] Slack not configured, skipping daily digest scheduling');
    return;
  }

  const queue = getScheduledQueue();

  // Remove existing repeatable job if exists (to update schedule)
  const existingJobs = await queue.getRepeatableJobs();
  for (const job of existingJobs) {
    if (job.name === 'daily_digest') {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  // Add the scheduled job - 8:00 AM daily
  await queue.add(
    'daily_digest',
    { triggered_by: 'cron' } as DailyDigestJobData,
    {
      repeat: {
        pattern: '0 8 * * *' // 8:00 AM daily
      },
      jobId: 'daily_digest_scheduled'
    }
  );

  console.log('[DailyDigestWorker] Daily digest job scheduled for 8:00 AM daily');
}

/**
 * Trigger daily digest job manually
 */
export async function triggerManualDigest(): Promise<string> {
  const queue = getScheduledQueue();
  
  const job = await queue.add(
    'daily_digest',
    { triggered_by: 'manual', force: true } as DailyDigestJobData,
    {
      priority: 1 // High priority for manual triggers
    }
  );

  console.log(`[DailyDigestWorker] Manual digest job triggered: ${job.id}`);
  return job.id!;
}

// =============================================================================
// Create Daily Digest Worker
// =============================================================================

export function createDailyDigestWorker(): Worker {
  const worker = new Worker<DailyDigestJobData, DigestResult>(
    QUEUE_NAMES.SCHEDULED,
    async (job: Job<DailyDigestJobData>) => {
      // Only process daily_digest jobs
      if (job.name !== 'daily_digest') {
        return { stats: getEmptyStats(), sent: false, execution_time_ms: 0 };
      }

      const startTime = Date.now();
      console.log(`[DailyDigestWorker] Starting daily digest job (triggered by: ${job.data.triggered_by || 'unknown'})`);

      try {
        // Gather statistics for the last 24 hours
        const stats = await gatherDailyStats();
        
        // Send to Slack
        const slackService = getSlackService();
        let sent = false;
        
        if (slackService.isConfigured()) {
          sent = await slackService.sendDailyDigest(stats);
          if (sent) {
            console.log('[DailyDigestWorker] Daily digest sent to Slack successfully');
          } else {
            console.warn('[DailyDigestWorker] Failed to send daily digest to Slack');
          }
        } else {
          console.log('[DailyDigestWorker] Slack not configured, digest not sent');
        }

        const executionTime = Date.now() - startTime;

        console.log(
          `[DailyDigestWorker] Daily digest complete: ` +
          `${stats.new_leads} new leads, ${stats.hot_leads} hot leads, ` +
          `${stats.deals_created} deals created, ${stats.deals_won} deals won ` +
          `in ${executionTime}ms`
        );

        return {
          stats,
          sent,
          execution_time_ms: executionTime
        };
      } catch (error) {
        console.error('[DailyDigestWorker] Daily digest failed:', error);
        throw error;
      }
    },
    {
      connection: redisOptions,
      concurrency: 1 // Only one digest job at a time
    }
  );

  // Event handlers
  worker.on('completed', (job, result) => {
    if (job.name === 'daily_digest') {
      console.log(`[DailyDigestWorker] Job ${job.id} completed:`, {
        new_leads: result.stats.new_leads,
        hot_leads: result.stats.hot_leads,
        deals_won: result.stats.deals_won,
        sent: result.sent
      });
    }
  });

  worker.on('failed', (job, error) => {
    if (job?.name === 'daily_digest') {
      console.error(`[DailyDigestWorker] Job ${job.id} failed:`, error.message);
    }
  });

  return worker;
}

// =============================================================================
// Gather Daily Statistics
// =============================================================================

/**
 * Gather all statistics for the daily digest
 * Covers the last 24 hours
 */
async function gatherDailyStats(): Promise<DailyDigestStats> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString();

  // Get new leads count (last 24 hours)
  const newLeadsResult = await db.query<{ count: string }>(`
    SELECT COUNT(*) as count 
    FROM leads 
    WHERE created_at >= $1
  `, [yesterdayISO]);
  const newLeads = parseInt(newLeadsResult[0]?.count || '0', 10);

  // Get hot leads count (total score >= 80, from last 24 hours)
  const hotLeadsResult = await db.query<{ count: string }>(`
    SELECT COUNT(*) as count 
    FROM leads 
    WHERE created_at >= $1 
      AND total_score >= 80
  `, [yesterdayISO]);
  const hotLeads = parseInt(hotLeadsResult[0]?.count || '0', 10);

  // Get deals created (last 24 hours)
  const dealsCreatedResult = await db.query<{ count: string }>(`
    SELECT COUNT(*) as count 
    FROM deals 
    WHERE created_at >= $1
  `, [yesterdayISO]);
  const dealsCreated = parseInt(dealsCreatedResult[0]?.count || '0', 10);

  // Get deals won (last 24 hours)
  const dealsWonResult = await db.query<{ count: string }>(`
    SELECT COUNT(*) as count 
    FROM deals 
    WHERE status = 'won' 
      AND closed_at >= $1
  `, [yesterdayISO]);
  const dealsWon = parseInt(dealsWonResult[0]?.count || '0', 10);

  // Get total pipeline value (all open deals)
  const pipelineValueResult = await db.query<{ total: string | null }>(`
    SELECT COALESCE(SUM(value), 0) as total 
    FROM deals 
    WHERE status = 'open'
  `);
  const totalValue = parseFloat(pipelineValueResult[0]?.total || '0');

  // Get top lead sources (last 24 hours)
  const topSourcesResult = await db.query<{ source: string; count: string }>(`
    SELECT 
      COALESCE(first_touch_source, 'unknown') as source, 
      COUNT(*) as count 
    FROM leads 
    WHERE created_at >= $1
    GROUP BY first_touch_source 
    ORDER BY count DESC 
    LIMIT 5
  `, [yesterdayISO]);
  
  const topSources = topSourcesResult.map(row => ({
    source: row.source || 'Unknown',
    count: parseInt(row.count, 10)
  }));

  return {
    new_leads: newLeads,
    hot_leads: hotLeads,
    deals_created: dealsCreated,
    deals_won: dealsWon,
    total_value: totalValue,
    top_sources: topSources
  };
}

/**
 * Return empty stats object
 */
function getEmptyStats(): DailyDigestStats {
  return {
    new_leads: 0,
    hot_leads: 0,
    deals_created: 0,
    deals_won: 0,
    total_value: 0,
    top_sources: []
  };
}

// =============================================================================
// Get Daily Digest Status
// =============================================================================

/**
 * Get information about the daily digest job
 */
export async function getDailyDigestStatus(): Promise<{
  enabled: boolean;
  slack_configured: boolean;
  next_scheduled_run: string | null;
  last_stats: DailyDigestStats | null;
}> {
  const slackService = getSlackService();
  const enabled = config.features.slackAlerts && slackService.isConfigured();

  // Get next scheduled run
  const queue = getScheduledQueue();
  const repeatableJobs = await queue.getRepeatableJobs();
  const digestJob = repeatableJobs.find(j => j.name === 'daily_digest');

  // Get current stats (for preview)
  let lastStats: DailyDigestStats | null = null;
  if (enabled) {
    try {
      lastStats = await gatherDailyStats();
    } catch {
      // Ignore errors when getting preview stats
    }
  }

  return {
    enabled,
    slack_configured: slackService.isConfigured(),
    next_scheduled_run: digestJob?.next ? new Date(digestJob.next).toISOString() : null,
    last_stats: lastStats
  };
}

export default createDailyDigestWorker;
