// =============================================================================
// src/workers/decayWorker.ts
// Score Decay Worker - Daily scheduled job to expire old scores
// =============================================================================

import { Worker, Job } from 'bullmq';
import { db } from '../db/index.js';
import { redisOptions } from '../config/redis.js';
import { getScheduledQueue, QUEUE_NAMES } from '../config/queues.js';
import { config } from '../config/index.js';

// =============================================================================
// Types
// =============================================================================

interface DecayResult {
  expired_count: number;
  leads_updated: number;
  execution_time_ms: number;
}

interface DecayJobData {
  triggered_by?: 'cron' | 'manual';
  force?: boolean;
}

// =============================================================================
// Setup Decay Job (Scheduled)
// =============================================================================

/**
 * Schedule the daily score decay job
 * Runs at 2:00 AM every day
 */
export async function setupDecayJob(): Promise<void> {
  if (!config.features.scoreDecay) {
    console.log('[DecayWorker] Score decay is disabled in config');
    return;
  }

  const queue = getScheduledQueue();

  // Remove existing repeatable job if exists (to update schedule)
  const existingJobs = await queue.getRepeatableJobs();
  for (const job of existingJobs) {
    if (job.name === 'score_decay') {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  // Add the scheduled job
  await queue.add(
    'score_decay',
    { triggered_by: 'cron' } as DecayJobData,
    {
      repeat: {
        pattern: '0 2 * * *' // 2:00 AM daily
      },
      jobId: 'score_decay_scheduled'
    }
  );

  console.log('[DecayWorker] Score decay job scheduled for 2:00 AM daily');
}

/**
 * Trigger decay job manually
 */
export async function triggerManualDecay(): Promise<string> {
  const queue = getScheduledQueue();
  
  const job = await queue.add(
    'score_decay',
    { triggered_by: 'manual', force: true } as DecayJobData,
    {
      priority: 1 // High priority for manual triggers
    }
  );

  console.log(`[DecayWorker] Manual decay job triggered: ${job.id}`);
  return job.id!;
}

// =============================================================================
// Create Decay Worker
// =============================================================================

export function createDecayWorker(): Worker {
  const worker = new Worker<DecayJobData, DecayResult>(
    QUEUE_NAMES.SCHEDULED,
    async (job: Job<DecayJobData>) => {
      // Only process score_decay jobs
      if (job.name !== 'score_decay') {
        return { expired_count: 0, leads_updated: 0, execution_time_ms: 0 };
      }

      const startTime = Date.now();
      console.log(`[DecayWorker] Starting score decay job (triggered by: ${job.data.triggered_by || 'unknown'})`);

      try {
        const result = await executeScoreDecay();
        const executionTime = Date.now() - startTime;

        console.log(
          `[DecayWorker] Score decay complete: ${result.expired_count} scores expired, ` +
          `${result.leads_updated} leads updated in ${executionTime}ms`
        );

        return {
          ...result,
          execution_time_ms: executionTime
        };
      } catch (error) {
        console.error('[DecayWorker] Score decay failed:', error);
        throw error;
      }
    },
    {
      connection: redisOptions,
      concurrency: 1 // Only one decay job at a time
    }
  );

  // Event handlers
  worker.on('completed', (job, result) => {
    if (job.name === 'score_decay') {
      console.log(`[DecayWorker] Job ${job.id} completed:`, result);
    }
  });

  worker.on('failed', (job, error) => {
    if (job?.name === 'score_decay') {
      console.error(`[DecayWorker] Job ${job.id} failed:`, error.message);
    }
  });

  return worker;
}

// =============================================================================
// Execute Score Decay
// =============================================================================

/**
 * Execute the score decay logic
 * This calls the PostgreSQL function expire_old_scores() if it exists,
 * or performs the decay logic directly
 */
async function executeScoreDecay(): Promise<{ expired_count: number; leads_updated: number }> {
  // Check if the expire_old_scores function exists
  const functionExists = await db.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'expire_old_scores'
    ) as exists
  `);

  if (functionExists[0]?.exists) {
    // Use the database function
    const result = await db.query<{ expired_count: number; leads_updated: number }>(`
      SELECT * FROM expire_old_scores()
    `);
    return result[0] || { expired_count: 0, leads_updated: 0 };
  }

  // Fallback: Perform decay logic directly
  return performDecayLogic();
}

/**
 * Fallback decay logic if the database function doesn't exist
 */
async function performDecayLogic(): Promise<{ expired_count: number; leads_updated: number }> {
  console.log('[DecayWorker] Using fallback decay logic');

  // Get decay threshold (default: 90 days)
  const decayDays = parseInt(process.env.SCORE_DECAY_DAYS || '90', 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - decayDays);

  // Mark old scores as expired
  const expireResult = await db.query<{ count: string }>(`
    UPDATE score_history 
    SET is_expired = TRUE 
    WHERE created_at < $1 
      AND is_expired = FALSE
    RETURNING id
  `, [cutoffDate.toISOString()]);

  const expiredCount = expireResult.length;

  if (expiredCount === 0) {
    return { expired_count: 0, leads_updated: 0 };
  }

  // Get affected lead IDs
  const affectedLeads = await db.query<{ lead_id: string }>(`
    SELECT DISTINCT lead_id 
    FROM score_history 
    WHERE created_at < $1 
      AND is_expired = TRUE
  `, [cutoffDate.toISOString()]);

  const leadIds = affectedLeads.map(l => l.lead_id);

  if (leadIds.length === 0) {
    return { expired_count: expiredCount, leads_updated: 0 };
  }

  // Recalculate scores for affected leads
  let leadsUpdated = 0;
  
  for (const leadId of leadIds) {
    // Calculate new scores from non-expired score history
    const scores = await db.query<{
      category: string;
      total_points: string;
    }>(`
      SELECT 
        category,
        COALESCE(SUM(points), 0) as total_points
      FROM score_history
      WHERE lead_id = $1 
        AND is_expired = FALSE
      GROUP BY category
    `, [leadId]);

    const scoreMap: Record<string, number> = {
      demographic: 0,
      engagement: 0,
      behavior: 0
    };

    for (const score of scores) {
      scoreMap[score.category] = parseInt(score.total_points, 10);
    }

    const totalScore = scoreMap.demographic + scoreMap.engagement + scoreMap.behavior;

    // Update the lead's denormalized scores
    await db.query(`
      UPDATE leads 
      SET 
        demographic_score = $1,
        engagement_score = $2,
        behavior_score = $3,
        total_score = $4,
        updated_at = NOW()
      WHERE id = $5
    `, [
      scoreMap.demographic,
      scoreMap.engagement,
      scoreMap.behavior,
      totalScore,
      leadId
    ]);

    leadsUpdated++;
  }

  return {
    expired_count: expiredCount,
    leads_updated: leadsUpdated
  };
}

// =============================================================================
// Get Decay Stats
// =============================================================================

/**
 * Get statistics about score decay
 */
export async function getDecayStats(): Promise<{
  total_scores: number;
  expired_scores: number;
  active_scores: number;
  decay_threshold_days: number;
  next_scheduled_run: string | null;
}> {
  const decayDays = parseInt(process.env.SCORE_DECAY_DAYS || '90', 10);

  const statsResult = await db.query<{
    total_scores: string;
    expired_scores: string;
    active_scores: string;
  }>(`
    SELECT 
      COUNT(*) as total_scores,
      COUNT(*) FILTER (WHERE is_expired = TRUE) as expired_scores,
      COUNT(*) FILTER (WHERE is_expired = FALSE) as active_scores
    FROM score_history
  `);
  
  const stats = statsResult[0];

  // Get next scheduled run
  const queue = getScheduledQueue();
  const repeatableJobs = await queue.getRepeatableJobs();
  const decayJob = repeatableJobs.find(j => j.name === 'score_decay');

  return {
    total_scores: parseInt(stats?.total_scores || '0', 10),
    expired_scores: parseInt(stats?.expired_scores || '0', 10),
    active_scores: parseInt(stats?.active_scores || '0', 10),
    decay_threshold_days: decayDays,
    next_scheduled_run: decayJob?.next ? new Date(decayJob.next).toISOString() : null
  };
}

export default createDecayWorker;
