// =============================================================================
// src/workers/routingWorker.ts
// BullMQ Worker for Lead Routing
// =============================================================================

import { Worker, Job } from 'bullmq';
import { redisOptions } from '../config/redis.js';
import { QUEUE_NAMES } from '../config/queues.js';
import { getPipelineRouter, type PipelineRouter } from '../services/pipelineRouter.js';
import type { RoutingJob, RoutingResult } from '../types/index.js';

// =============================================================================
// Worker Factory
// =============================================================================

export function createRoutingWorker(
  router?: PipelineRouter
): Worker<RoutingJob, RoutingResult> {
  // Use provided router or get the singleton
  const pipelineRouter = router || getPipelineRouter();
  
  const worker = new Worker<RoutingJob, RoutingResult>(
    QUEUE_NAMES.ROUTING,
    async (job: Job<RoutingJob>) => {
      const { lead_id, trigger } = job.data;
      
      console.log(`[Routing Worker] Processing lead ${lead_id} (trigger: ${trigger})`);
      
      try {
        // Evaluate and potentially route the lead
        const result = await pipelineRouter.evaluateAndRoute(lead_id);
        
        console.log(`[Routing Worker] Result for ${lead_id}: ${result.action} - ${result.reason}`);
        
        return result;
        
      } catch (error) {
        console.error(`[Routing Worker] Error processing ${lead_id}:`, error);
        throw error;
      }
    },
    {
      connection: redisOptions,
      concurrency: 5,
      limiter: {
        max: 50,
        duration: 1000
      }
    }
  );
  
  // Event handlers
  worker.on('completed', (job, result) => {
    const action = result?.action || 'unknown';
    console.log(`[Routing Worker] ✅ Job ${job.id} completed: ${action}`);
  });
  
  worker.on('failed', (job, error) => {
    console.error(`[Routing Worker] ❌ Job ${job?.id} failed:`, error.message);
  });
  
  worker.on('error', (error) => {
    console.error('[Routing Worker] Worker error:', error);
  });
  
  return worker;
}

export default createRoutingWorker;
