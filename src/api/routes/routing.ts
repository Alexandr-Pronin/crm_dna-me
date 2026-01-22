// =============================================================================
// src/api/routes/routing.ts
// Routing API Routes
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getPipelineRouter } from '../../services/pipelineRouter.js';
import { getRoutingQueue } from '../../config/queues.js';
import { ROUTING_CONFIG } from '../../config/routingConfig.js';
import { db } from '../../db/index.js';
import { ValidationError, NotFoundError } from '../../errors/index.js';
import type { Lead } from '../../types/index.js';

// =============================================================================
// Request Schemas
// =============================================================================

const evaluateParamsSchema = z.object({
  id: z.string().uuid()
});

const manualRouteSchema = z.object({
  pipeline_id: z.string().uuid(),
  assigned_to: z.string().email().optional()
});

const batchEvaluateSchema = z.object({
  lead_ids: z.array(z.string().uuid()).min(1).max(100)
});

// =============================================================================
// Routes
// =============================================================================

export async function routingRoutes(fastify: FastifyInstance): Promise<void> {
  const router = getPipelineRouter();
  
  // ===========================================================================
  // GET /routing/config - Get routing configuration
  // ===========================================================================
  
  fastify.get('/routing/config', async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      success: true,
      data: {
        min_score_threshold: ROUTING_CONFIG.min_score_threshold,
        min_intent_confidence: ROUTING_CONFIG.min_intent_confidence,
        intent_confidence_margin: ROUTING_CONFIG.intent_confidence_margin,
        max_unrouted_days: ROUTING_CONFIG.max_unrouted_days,
        fallback_pipeline: ROUTING_CONFIG.fallback_pipeline,
        intent_to_pipeline: ROUTING_CONFIG.intent_to_pipeline,
        owner_assignment: ROUTING_CONFIG.owner_assignment
      }
    };
  });
  
  // ===========================================================================
  // GET /routing/stats - Get routing statistics
  // ===========================================================================
  
  fastify.get('/routing/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const stats = await router.getRoutingStats();
    
    return {
      success: true,
      data: stats
    };
  });
  
  // ===========================================================================
  // POST /routing/evaluate/:id - Trigger routing evaluation for a lead
  // ===========================================================================
  
  fastify.post(
    '/routing/evaluate/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const params = evaluateParamsSchema.safeParse(request.params);
      
      if (!params.success) {
        throw new ValidationError('Invalid lead ID', params.error.format());
      }
      
      const leadId = params.data.id;
      
      // Verify lead exists
      const lead = await db.queryOne<Lead>(`SELECT id, email FROM leads WHERE id = $1`, [leadId]);
      
      if (!lead) {
        throw new NotFoundError('Lead', leadId);
      }
      
      // Evaluate and route
      const result = await router.evaluateAndRoute(leadId);
      
      return {
        success: true,
        data: {
          lead_id: leadId,
          email: lead.email,
          routing_result: result
        }
      };
    }
  );
  
  // ===========================================================================
  // POST /routing/manual/:id - Manually route a lead
  // ===========================================================================
  
  fastify.post(
    '/routing/manual/:id',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
      reply: FastifyReply
    ) => {
      const params = evaluateParamsSchema.safeParse(request.params);
      const body = manualRouteSchema.safeParse(request.body);
      
      if (!params.success) {
        throw new ValidationError('Invalid lead ID', params.error.format());
      }
      
      if (!body.success) {
        throw new ValidationError('Invalid request body', body.error.format());
      }
      
      const leadId = params.data.id;
      const { pipeline_id, assigned_to } = body.data;
      
      // Route the lead
      const result = await router.manualRoute(leadId, pipeline_id, assigned_to);
      
      if (result.action === 'skip') {
        reply.code(400);
        return {
          success: false,
          error: result.reason,
          details: result.details
        };
      }
      
      return {
        success: true,
        data: {
          lead_id: leadId,
          routing_result: result
        }
      };
    }
  );
  
  // ===========================================================================
  // POST /routing/batch-evaluate - Queue routing evaluation for multiple leads
  // ===========================================================================
  
  fastify.post(
    '/routing/batch-evaluate',
    async (
      request: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply
    ) => {
      const body = batchEvaluateSchema.safeParse(request.body);
      
      if (!body.success) {
        throw new ValidationError('Invalid request body', body.error.format());
      }
      
      const { lead_ids } = body.data;
      
      // Queue all leads for evaluation
      const routingQueue = getRoutingQueue();
      
      const jobs = await Promise.all(
        lead_ids.map(leadId =>
          routingQueue.add('evaluate', {
            lead_id: leadId,
            trigger: 'manual'
          }, {
            jobId: `routing-${leadId}-${Date.now()}`
          })
        )
      );
      
      reply.code(202);
      return {
        success: true,
        data: {
          queued: lead_ids.length,
          job_ids: jobs.map(j => j.id)
        }
      };
    }
  );
  
  // ===========================================================================
  // GET /routing/queue-status - Get routing queue status
  // ===========================================================================
  
  fastify.get('/routing/queue-status', async (request: FastifyRequest, reply: FastifyReply) => {
    const routingQueue = getRoutingQueue();
    
    const [waiting, active, completed, failed] = await Promise.all([
      routingQueue.getWaitingCount(),
      routingQueue.getActiveCount(),
      routingQueue.getCompletedCount(),
      routingQueue.getFailedCount()
    ]);
    
    return {
      success: true,
      data: {
        queue: 'routing',
        waiting,
        active,
        completed,
        failed
      }
    };
  });
  
  // ===========================================================================
  // GET /routing/unrouted - Get leads ready for routing
  // ===========================================================================
  
  fastify.get(
    '/routing/unrouted',
    async (
      request: FastifyRequest<{ Querystring: { limit?: string; min_score?: string } }>,
      reply: FastifyReply
    ) => {
      const limit = Math.min(parseInt(request.query.limit || '50', 10), 200);
      const minScore = parseInt(request.query.min_score || '0', 10);
      
      const leads = await db.query<Lead>(`
        SELECT * FROM leads 
        WHERE routing_status = 'unrouted'
          AND total_score >= $1
        ORDER BY total_score DESC, created_at ASC
        LIMIT $2
      `, [minScore, limit]);
      
      return {
        success: true,
        data: leads,
        meta: {
          count: leads.length,
          limit,
          min_score: minScore
        }
      };
    }
  );
  
  // ===========================================================================
  // GET /routing/manual-review - Get leads needing manual review
  // ===========================================================================
  
  fastify.get(
    '/routing/manual-review',
    async (
      request: FastifyRequest<{ Querystring: { limit?: string } }>,
      reply: FastifyReply
    ) => {
      const limit = Math.min(parseInt(request.query.limit || '50', 10), 200);
      
      const leads = await db.query<Lead>(`
        SELECT * FROM leads 
        WHERE routing_status = 'manual_review'
        ORDER BY total_score DESC, created_at ASC
        LIMIT $1
      `, [limit]);
      
      return {
        success: true,
        data: leads,
        meta: {
          count: leads.length,
          limit
        }
      };
    }
  );
}

export default routingRoutes;
