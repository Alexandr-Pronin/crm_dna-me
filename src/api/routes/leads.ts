// =============================================================================
// src/api/routes/leads.ts
// Lead Management API Routes
// =============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { validateApiKey } from '../middleware/apiKey.js';
import {
  createLeadSchema,
  updateLeadSchema,
  leadFiltersSchema,
  manualRouteSchema,
  leadIdParamSchema,
  type CreateLeadInput,
  type UpdateLeadInput,
  type LeadFiltersInput,
  type ManualRouteInput,
  type LeadIdParam,
  type LeadResponse,
  type LeadListResponse
} from '../schemas/leads.js';
import { getLeadService } from '../../services/leadService.js';
import { ValidationError } from '../../errors/index.js';
import type { Lead, MarketingEvent, ScoreHistory, IntentSignal } from '../../types/index.js';

// =============================================================================
// Type Extensions
// =============================================================================

interface IdParams {
  id: string;
}

interface EventsQuery {
  limit?: string;
  offset?: string;
}

interface ScoresQuery {
  limit?: string;
  offset?: string;
  category?: string;
}

interface IntentsQuery {
  limit?: string;
  offset?: string;
  intent?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Transform Lead entity to API response format
 */
function transformLeadResponse(lead: Lead): LeadResponse {
  return {
    id: lead.id,
    email: lead.email,
    first_name: lead.first_name ?? null,
    last_name: lead.last_name ?? null,
    phone: lead.phone ?? null,
    job_title: lead.job_title ?? null,
    organization_id: lead.organization_id ?? null,
    status: lead.status,
    lifecycle_stage: lead.lifecycle_stage,
    demographic_score: lead.demographic_score,
    engagement_score: lead.engagement_score,
    behavior_score: lead.behavior_score,
    total_score: lead.total_score,
    pipeline_id: lead.pipeline_id ?? null,
    routing_status: lead.routing_status,
    routed_at: lead.routed_at?.toISOString?.() ?? (lead.routed_at as unknown as string) ?? null,
    primary_intent: lead.primary_intent ?? null,
    intent_confidence: lead.intent_confidence,
    intent_summary: lead.intent_summary ?? { research: 0, b2b: 0, co_creation: 0 },
    first_touch_source: lead.first_touch_source ?? null,
    first_touch_campaign: lead.first_touch_campaign ?? null,
    first_touch_date: lead.first_touch_date?.toISOString?.() ?? (lead.first_touch_date as unknown as string) ?? null,
    last_touch_source: lead.last_touch_source ?? null,
    last_touch_campaign: lead.last_touch_campaign ?? null,
    last_touch_date: lead.last_touch_date?.toISOString?.() ?? (lead.last_touch_date as unknown as string) ?? null,
    portal_id: lead.portal_id ?? null,
    waalaxy_id: lead.waalaxy_id ?? null,
    linkedin_url: lead.linkedin_url ?? null,
    lemlist_id: lead.lemlist_id ?? null,
    consent_date: lead.consent_date?.toISOString?.() ?? (lead.consent_date as unknown as string) ?? null,
    consent_source: lead.consent_source ?? null,
    gdpr_delete_requested: lead.gdpr_delete_requested?.toISOString?.() ?? (lead.gdpr_delete_requested as unknown as string) ?? null,
    created_at: lead.created_at?.toISOString?.() ?? (lead.created_at as unknown as string),
    updated_at: lead.updated_at?.toISOString?.() ?? (lead.updated_at as unknown as string),
    last_activity: lead.last_activity?.toISOString?.() ?? (lead.last_activity as unknown as string) ?? null
  };
}

// =============================================================================
// Route Registration
// =============================================================================

export async function leadsRoutes(fastify: FastifyInstance): Promise<void> {
  const leadService = getLeadService();

  // ===========================================================================
  // GET /api/v1/leads
  // ===========================================================================
  /**
   * List leads with filtering, searching, and pagination.
   */
  fastify.get<{
    Querystring: LeadFiltersInput;
    Reply: LeadListResponse;
  }>(
    '/leads',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'List leads with filtering and pagination',
        tags: ['Leads'],
        querystring: {
          type: 'object',
          properties: {
            search: { type: 'string', description: 'Search in email, name, job title' },
            status: { type: 'string', enum: ['new', 'contacted', 'qualified', 'nurturing', 'customer', 'churned'] },
            lifecycle_stage: { type: 'string', enum: ['lead', 'mql', 'sql', 'opportunity', 'customer'] },
            routing_status: { type: 'string', enum: ['unrouted', 'pending', 'routed', 'manual_review'] },
            primary_intent: { type: 'string', enum: ['research', 'b2b', 'co_creation'] },
            pipeline_id: { type: 'string', format: 'uuid' },
            organization_id: { type: 'string', format: 'uuid' },
            min_score: { type: 'integer', minimum: 0 },
            max_score: { type: 'integer' },
            min_intent_confidence: { type: 'integer', minimum: 0, maximum: 100 },
            created_after: { type: 'string', format: 'date-time' },
            created_before: { type: 'string', format: 'date-time' },
            last_activity_after: { type: 'string', format: 'date-time' },
            last_activity_before: { type: 'string', format: 'date-time' },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sort_by: { type: 'string', enum: ['created_at', 'updated_at', 'total_score', 'intent_confidence', 'last_activity', 'email', 'first_name', 'last_name'], default: 'created_at' },
            sort_order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { type: 'object' } },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  total: { type: 'integer' },
                  total_pages: { type: 'integer' },
                  has_next: { type: 'boolean' },
                  has_prev: { type: 'boolean' }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const parseResult = leadFiltersSchema.safeParse(request.query);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid query parameters', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const result = await leadService.searchLeads(parseResult.data);
      
      return {
        data: result.data.map(transformLeadResponse),
        pagination: result.pagination
      };
    }
  );

  // ===========================================================================
  // GET /api/v1/leads/unrouted
  // ===========================================================================
  /**
   * Get unrouted leads (candidates for routing).
   */
  fastify.get<{
    Querystring: { limit?: string };
    Reply: { data: LeadResponse[] };
  }>(
    '/leads/unrouted',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Get leads that are pending routing',
        tags: ['Leads'],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { type: 'object' } }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;
      const leads = await leadService.getUnroutedLeads(limit);
      
      return {
        data: leads.map(transformLeadResponse)
      };
    }
  );

  // ===========================================================================
  // GET /api/v1/leads/stats
  // ===========================================================================
  /**
   * Get lead statistics.
   */
  fastify.get(
    '/leads/stats',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Get lead statistics',
        tags: ['Leads'],
        response: {
          200: {
            type: 'object',
            properties: {
              by_status: { type: 'object' },
              by_routing_status: { type: 'object' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const [byStatus, byRoutingStatus] = await Promise.all([
        leadService.getLeadCountsByStatus(),
        leadService.getLeadCountsByRoutingStatus()
      ]);
      
      return {
        by_status: byStatus,
        by_routing_status: byRoutingStatus
      };
    }
  );

  // ===========================================================================
  // GET /api/v1/leads/:id
  // ===========================================================================
  /**
   * Get a single lead by ID.
   */
  fastify.get<{
    Params: IdParams;
    Reply: LeadResponse;
  }>(
    '/leads/:id',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Get a lead by ID',
        tags: ['Leads'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: { type: 'object' },
          404: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const parseResult = leadIdParamSchema.safeParse(request.params);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid lead ID', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const lead = await leadService.getLeadById(parseResult.data.id);
      return transformLeadResponse(lead);
    }
  );

  // ===========================================================================
  // POST /api/v1/leads
  // ===========================================================================
  /**
   * Create a new lead.
   */
  fastify.post<{
    Body: CreateLeadInput;
    Reply: LeadResponse;
  }>(
    '/leads',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Create a new lead',
        tags: ['Leads'],
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
            first_name: { type: 'string', maxLength: 100 },
            last_name: { type: 'string', maxLength: 100 },
            phone: { type: 'string', maxLength: 50 },
            job_title: { type: 'string', maxLength: 150 },
            organization_id: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['new', 'contacted', 'qualified', 'nurturing', 'customer', 'churned'] },
            lifecycle_stage: { type: 'string', enum: ['lead', 'mql', 'sql', 'opportunity', 'customer'] },
            portal_id: { type: 'string', maxLength: 100 },
            waalaxy_id: { type: 'string', maxLength: 100 },
            linkedin_url: { type: 'string', format: 'uri', maxLength: 255 },
            lemlist_id: { type: 'string', maxLength: 100 },
            consent_date: { type: 'string', format: 'date-time' },
            consent_source: { type: 'string', maxLength: 100 },
            first_touch_source: { type: 'string', maxLength: 100 },
            first_touch_campaign: { type: 'string', maxLength: 100 }
          }
        },
        response: {
          201: { type: 'object' },
          409: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const parseResult = createLeadSchema.safeParse(request.body);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid lead data', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const lead = await leadService.createLead(parseResult.data);
      
      request.log.info({
        leadId: lead.id,
        email: lead.email
      }, 'Lead created');
      
      return reply.code(201).send(transformLeadResponse(lead));
    }
  );

  // ===========================================================================
  // PATCH /api/v1/leads/:id
  // ===========================================================================
  /**
   * Update an existing lead.
   */
  fastify.patch<{
    Params: IdParams;
    Body: UpdateLeadInput;
    Reply: LeadResponse;
  }>(
    '/leads/:id',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Update a lead',
        tags: ['Leads'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            first_name: { type: ['string', 'null'], maxLength: 100 },
            last_name: { type: ['string', 'null'], maxLength: 100 },
            phone: { type: ['string', 'null'], maxLength: 50 },
            job_title: { type: ['string', 'null'], maxLength: 150 },
            organization_id: { type: ['string', 'null'], format: 'uuid' },
            status: { type: 'string', enum: ['new', 'contacted', 'qualified', 'nurturing', 'customer', 'churned'] },
            lifecycle_stage: { type: 'string', enum: ['lead', 'mql', 'sql', 'opportunity', 'customer'] },
            portal_id: { type: ['string', 'null'], maxLength: 100 },
            waalaxy_id: { type: ['string', 'null'], maxLength: 100 },
            linkedin_url: { type: ['string', 'null'], format: 'uri', maxLength: 255 },
            lemlist_id: { type: ['string', 'null'], maxLength: 100 },
            consent_date: { type: ['string', 'null'], format: 'date-time' },
            consent_source: { type: ['string', 'null'], maxLength: 100 },
            gdpr_delete_requested: { type: ['string', 'null'], format: 'date-time' }
          }
        },
        response: {
          200: { type: 'object' },
          404: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const paramResult = leadIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid lead ID', {
          validationErrors: paramResult.error.errors
        });
      }
      
      const bodyResult = updateLeadSchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw new ValidationError('Invalid lead data', {
          validationErrors: bodyResult.error.errors
        });
      }
      
      const lead = await leadService.updateLead(paramResult.data.id, bodyResult.data);
      
      request.log.info({
        leadId: lead.id
      }, 'Lead updated');
      
      return transformLeadResponse(lead);
    }
  );

  // ===========================================================================
  // DELETE /api/v1/leads/:id
  // ===========================================================================
  /**
   * Delete a lead.
   */
  fastify.delete<{
    Params: IdParams;
    Reply: { success: boolean; message: string };
  }>(
    '/leads/:id',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Delete a lead',
        tags: ['Leads'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          },
          404: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const parseResult = leadIdParamSchema.safeParse(request.params);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid lead ID', {
          validationErrors: parseResult.error.errors
        });
      }
      
      await leadService.deleteLead(parseResult.data.id);
      
      request.log.info({
        leadId: parseResult.data.id
      }, 'Lead deleted');
      
      return {
        success: true,
        message: 'Lead deleted successfully'
      };
    }
  );

  // ===========================================================================
  // GET /api/v1/leads/:id/events
  // ===========================================================================
  /**
   * Get events for a lead.
   */
  fastify.get<{
    Params: IdParams;
    Querystring: EventsQuery;
    Reply: { data: MarketingEvent[] };
  }>(
    '/leads/:id/events',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Get events for a lead',
        tags: ['Leads', 'Events'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
            offset: { type: 'integer', minimum: 0, default: 0 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { type: 'object' } }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const parseResult = leadIdParamSchema.safeParse(request.params);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid lead ID', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;
      const offset = request.query.offset ? parseInt(request.query.offset, 10) : 0;
      
      const events = await leadService.getLeadEvents(parseResult.data.id, { limit, offset });
      
      return { data: events };
    }
  );

  // ===========================================================================
  // GET /api/v1/leads/:id/scores
  // ===========================================================================
  /**
   * Get score history for a lead.
   */
  fastify.get<{
    Params: IdParams;
    Querystring: ScoresQuery;
    Reply: { data: ScoreHistory[] };
  }>(
    '/leads/:id/scores',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Get score history for a lead',
        tags: ['Leads', 'Scoring'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
            offset: { type: 'integer', minimum: 0, default: 0 },
            category: { type: 'string', enum: ['demographic', 'engagement', 'behavior'] }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { type: 'object' } }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const parseResult = leadIdParamSchema.safeParse(request.params);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid lead ID', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;
      const offset = request.query.offset ? parseInt(request.query.offset, 10) : 0;
      
      const scores = await leadService.getLeadScoreHistory(parseResult.data.id, {
        limit,
        offset,
        category: request.query.category
      });
      
      return { data: scores };
    }
  );

  // ===========================================================================
  // GET /api/v1/leads/:id/intents
  // ===========================================================================
  /**
   * Get intent signals for a lead.
   */
  fastify.get<{
    Params: IdParams;
    Querystring: IntentsQuery;
    Reply: { data: IntentSignal[] };
  }>(
    '/leads/:id/intents',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Get intent signals for a lead',
        tags: ['Leads', 'Intent'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
            offset: { type: 'integer', minimum: 0, default: 0 },
            intent: { type: 'string', enum: ['research', 'b2b', 'co_creation'] }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { type: 'object' } }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const parseResult = leadIdParamSchema.safeParse(request.params);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid lead ID', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;
      const offset = request.query.offset ? parseInt(request.query.offset, 10) : 0;
      
      const intents = await leadService.getLeadIntentSignals(parseResult.data.id, {
        limit,
        offset,
        intent: request.query.intent
      });
      
      return { data: intents };
    }
  );

  // ===========================================================================
  // POST /api/v1/leads/:id/route
  // ===========================================================================
  /**
   * Manually route a lead to a pipeline.
   */
  fastify.post<{
    Params: IdParams;
    Body: ManualRouteInput;
    Reply: LeadResponse;
  }>(
    '/leads/:id/route',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Manually route a lead to a pipeline',
        tags: ['Leads', 'Routing'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          required: ['pipeline_id'],
          properties: {
            pipeline_id: { type: 'string', format: 'uuid' },
            stage_id: { type: 'string', format: 'uuid' },
            assigned_to: { type: 'string', format: 'uuid' },
            reason: { type: 'string', maxLength: 500 }
          }
        },
        response: {
          200: { type: 'object' },
          404: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const paramResult = leadIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid lead ID', {
          validationErrors: paramResult.error.errors
        });
      }
      
      const bodyResult = manualRouteSchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw new ValidationError('Invalid routing data', {
          validationErrors: bodyResult.error.errors
        });
      }
      
      const lead = await leadService.manualRouteLead(paramResult.data.id, bodyResult.data);
      
      request.log.info({
        leadId: lead.id,
        pipelineId: bodyResult.data.pipeline_id,
        assignedTo: bodyResult.data.assigned_to
      }, 'Lead manually routed');
      
      return transformLeadResponse(lead);
    }
  );
}

export default leadsRoutes;
