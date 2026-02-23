// =============================================================================
// src/api/routes/leads.ts
// Lead Management API Routes
// =============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateOrApiKey } from '../middleware/auth.js';
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
import { db } from '../../db/index.js';
import { getLeadService } from '../../services/leadService.js';
import { recordActivity, type ActivitySource } from '../../services/activityService.js';
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
    organization_name: (lead as Lead & { organization_name?: string | null }).organization_name ?? null,
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
      preHandler: authenticateOrApiKey,
      schema: {
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
              data: { type: 'array', items: { type: 'object', additionalProperties: true } },
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
      preHandler: authenticateOrApiKey,
      schema: {
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
              data: { type: 'array', items: { type: 'object', additionalProperties: true } }
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
      preHandler: authenticateOrApiKey,
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              by_status: { type: 'object', additionalProperties: true },
              by_routing_status: { type: 'object', additionalProperties: true }
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
      preHandler: authenticateOrApiKey,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: { type: 'object', additionalProperties: true },
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
      preHandler: authenticateOrApiKey,
      schema: {
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
          201: { type: 'object', additionalProperties: true },
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
      const userId = (request as { user?: { id: string } }).user?.id;
      const validSources: ActivitySource[] = ['waalaxy', 'portal', 'lemlist', 'ads', 'conference', 'website', 'linkedin', 'manual', 'api', 'import'];
      const source: ActivitySource = validSources.includes(lead.first_touch_source as ActivitySource) ? (lead.first_touch_source as ActivitySource) : 'manual';

      recordActivity({
        lead_id: lead.id,
        event_type: 'lead_created',
        event_category: 'activity',
        source,
        metadata: {
          email: lead.email,
          first_name: lead.first_name,
          last_name: lead.last_name,
          created_by: userId,
        },
        update_lead_activity: true,
      }).catch((err) => {
        request.log.warn({ err }, 'Failed to record lead_created activity');
      });

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
      preHandler: authenticateOrApiKey,
      schema: {
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
          200: { type: 'object', additionalProperties: true },
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
      preHandler: authenticateOrApiKey,
      schema: {
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
      preHandler: authenticateOrApiKey,
      schema: {
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
              data: { type: 'array', items: { type: 'object', additionalProperties: true } }
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
      preHandler: authenticateOrApiKey,
      schema: {
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
              data: { type: 'array', items: { type: 'object', additionalProperties: true } }
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
      preHandler: authenticateOrApiKey,
      schema: {
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
              data: { type: 'array', items: { type: 'object', additionalProperties: true } }
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
      preHandler: authenticateOrApiKey,
      schema: {
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
          200: { type: 'object', additionalProperties: true },
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
  // ===========================================================================
  // POST /api/v1/leads/import
  // ===========================================================================
  fastify.post(
    '/leads/import',
    {
      preHandler: authenticateOrApiKey,
      schema: {
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
            first_name: { type: 'string', maxLength: 100 },
            last_name: { type: 'string', maxLength: 100 },
            phone: { type: 'string', maxLength: 50 },
            job_title: { type: 'string', maxLength: 150 },
            linkedin_url: { type: 'string', maxLength: 255 },
            first_touch_source: { type: 'string', maxLength: 100 },
            messages: {
              type: 'array',
              items: {
                type: 'object',
                required: ['direction', 'body_text'],
                properties: {
                  direction: { type: 'string', enum: ['inbound', 'outbound'] },
                  subject: { type: 'string', maxLength: 500 },
                  body_text: { type: 'string' },
                  body_html: { type: 'string' },
                  sent_at: { type: 'string', format: 'date-time' },
                }
              }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        email: string;
        first_name?: string;
        last_name?: string;
        phone?: string;
        job_title?: string;
        linkedin_url?: string;
        first_touch_source?: string;
        messages?: Array<{
          direction: 'inbound' | 'outbound';
          subject?: string;
          body_text: string;
          body_html?: string;
          sent_at?: string;
        }>;
      };

      const user = (request as any).user;
      const userId = user?.id;

      let lead = await db.queryOne<Lead>(
        'SELECT * FROM leads WHERE email = $1',
        [body.email.toLowerCase().trim()],
      );

      if (!lead) {
        lead = await db.queryOne<Lead>(
          `INSERT INTO leads (
            email, first_name, last_name, phone, job_title, linkedin_url,
            status, lifecycle_stage, first_touch_source, first_touch_date,
            created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,'new','subscriber',$7,NOW(),NOW(),NOW())
          RETURNING *`,
          [
            body.email.toLowerCase().trim(),
            body.first_name || null,
            body.last_name || null,
            body.phone || null,
            body.job_title || null,
            body.linkedin_url || null,
            body.first_touch_source || 'manual_import',
          ],
        );
      }

      if (!lead) throw new ValidationError('Failed to create or find lead');

      let conversationId: string | null = null;
      let messagesImported = 0;

      if (body.messages && body.messages.length > 0) {
        const { getConversationService } = await import('../../services/conversationService.js');
        const convService = getConversationService();

        const deal = await db.queryOne<{ id: string }>(
          `SELECT id FROM deals WHERE lead_id = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 1`,
          [lead.id],
        );

        const firstSubject = body.messages.find(m => m.subject)?.subject || 'Importierter E-Mail-Verlauf';
        const conversation = await convService.findOrCreateConversation(
          lead.id,
          deal?.id ?? null,
          userId,
          firstSubject,
        );
        conversationId = conversation.id;

        const { getMessageService } = await import('../../services/messageService.js');
        const messageService = getMessageService();

        const sortedMessages = [...body.messages].sort((a, b) => {
          const da = a.sent_at ? new Date(a.sent_at).getTime() : 0;
          const db2 = b.sent_at ? new Date(b.sent_at).getTime() : 0;
          return da - db2;
        });

        for (const msg of sortedMessages) {
          const senderEmail = msg.direction === 'outbound'
            ? user?.email || 'system@dna-me.org'
            : body.email;
          const senderName = msg.direction === 'outbound'
            ? user?.name || 'Team'
            : [body.first_name, body.last_name].filter(Boolean).join(' ') || body.email;

          await messageService.createMessage(conversationId, {
            message_type: 'email',
            direction: msg.direction,
            sender_email: senderEmail,
            sender_name: senderName,
            subject: msg.subject,
            body_text: msg.body_text,
            body_html: msg.body_html || `<p>${msg.body_text.replace(/\n/g, '<br/>')}</p>`,
            sent_at: msg.sent_at || new Date().toISOString(),
            skip_send: true,
          }, userId);

          messagesImported++;
        }
      }

      request.log.info({
        leadId: lead.id,
        email: lead.email,
        messagesImported,
      }, 'Lead imported with message history');

      return reply.code(201).send({
        lead: transformLeadResponse(lead),
        conversation_id: conversationId,
        messages_imported: messagesImported,
      });
    }
  );
}

export default leadsRoutes;
