// =============================================================================
// src/api/routes/campaigns.ts
// Campaign Management API Routes
// =============================================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { validateApiKey } from '../middleware/apiKey.js';
import { db } from '../../db/index.js';
import { ValidationError, NotFoundError } from '../../errors/index.js';
import type { Campaign, CampaignStatus, PaginatedResponse } from '../../types/index.js';

// =============================================================================
// Zod Schemas
// =============================================================================

const createCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  campaign_type: z.string().max(50).optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed']).default('draft'),
  budget: z.number().min(0).optional(),
  currency: z.string().length(3).default('EUR'),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  metadata: z.record(z.unknown()).optional()
});

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  campaign_type: z.string().max(50).nullable().optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed']).optional(),
  budget: z.number().min(0).nullable().optional(),
  spent: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  utm_source: z.string().max(100).nullable().optional(),
  utm_medium: z.string().max(100).nullable().optional(),
  utm_campaign: z.string().max(100).nullable().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  metadata: z.record(z.unknown()).optional()
});

const campaignFiltersSchema = z.object({
  status: z.enum(['draft', 'active', 'paused', 'completed']).optional(),
  campaign_type: z.string().optional(),
  search: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  start_after: z.string().datetime().optional(),
  start_before: z.string().datetime().optional(),
  end_after: z.string().datetime().optional(),
  end_before: z.string().datetime().optional(),
  min_budget: z.coerce.number().min(0).optional(),
  max_budget: z.coerce.number().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort_by: z.enum(['created_at', 'updated_at', 'name', 'start_date', 'end_date', 'budget', 'leads_generated', 'revenue_attributed']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

const campaignIdParamSchema = z.object({
  id: z.string().uuid()
});

// =============================================================================
// Type Definitions
// =============================================================================

type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
type CampaignFiltersInput = z.infer<typeof campaignFiltersSchema>;

interface IdParams {
  id: string;
}

interface CampaignResponse {
  id: string;
  name: string;
  campaign_type: string | null;
  status: CampaignStatus;
  budget: number | null;
  spent: number;
  currency: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  start_date: string | null;
  end_date: string | null;
  leads_generated: number;
  deals_created: number;
  revenue_attributed: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface CampaignStats {
  total_leads: number;
  total_deals: number;
  total_revenue: number;
  conversion_rate: number;
  cost_per_lead: number | null;
  roi: number | null;
}

// =============================================================================
// Helper Functions
// =============================================================================

function transformCampaignResponse(campaign: Campaign): CampaignResponse {
  return {
    id: campaign.id,
    name: campaign.name,
    campaign_type: campaign.campaign_type ?? null,
    status: campaign.status,
    budget: campaign.budget ?? null,
    spent: campaign.spent,
    currency: campaign.currency,
    utm_source: campaign.utm_source ?? null,
    utm_medium: campaign.utm_medium ?? null,
    utm_campaign: campaign.utm_campaign ?? null,
    start_date: campaign.start_date?.toISOString?.().split('T')[0] ?? (campaign.start_date as unknown as string) ?? null,
    end_date: campaign.end_date?.toISOString?.().split('T')[0] ?? (campaign.end_date as unknown as string) ?? null,
    leads_generated: campaign.leads_generated,
    deals_created: campaign.deals_created,
    revenue_attributed: campaign.revenue_attributed,
    metadata: campaign.metadata ?? {},
    created_at: campaign.created_at?.toISOString?.() ?? (campaign.created_at as unknown as string),
    updated_at: campaign.updated_at?.toISOString?.() ?? (campaign.updated_at as unknown as string)
  };
}

// =============================================================================
// Database Operations
// =============================================================================

async function getCampaignById(id: string): Promise<Campaign> {
  const result = await db.query<Campaign>(
    'SELECT * FROM campaigns WHERE id = $1',
    [id]
  );
  
  if (result.length === 0) {
    throw new NotFoundError('Campaign', id);
  }
  
  return result[0];
}

async function searchCampaigns(filters: CampaignFiltersInput): Promise<PaginatedResponse<Campaign>> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;
  
  if (filters.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(filters.status);
  }
  
  if (filters.campaign_type) {
    conditions.push(`campaign_type = $${paramIndex++}`);
    params.push(filters.campaign_type);
  }
  
  if (filters.search) {
    conditions.push(`(name ILIKE $${paramIndex} OR utm_campaign ILIKE $${paramIndex})`);
    params.push(`%${filters.search}%`);
    paramIndex++;
  }
  
  if (filters.utm_source) {
    conditions.push(`utm_source = $${paramIndex++}`);
    params.push(filters.utm_source);
  }
  
  if (filters.utm_medium) {
    conditions.push(`utm_medium = $${paramIndex++}`);
    params.push(filters.utm_medium);
  }
  
  if (filters.start_after) {
    conditions.push(`start_date >= $${paramIndex++}`);
    params.push(filters.start_after);
  }
  
  if (filters.start_before) {
    conditions.push(`start_date <= $${paramIndex++}`);
    params.push(filters.start_before);
  }
  
  if (filters.end_after) {
    conditions.push(`end_date >= $${paramIndex++}`);
    params.push(filters.end_after);
  }
  
  if (filters.end_before) {
    conditions.push(`end_date <= $${paramIndex++}`);
    params.push(filters.end_before);
  }
  
  if (filters.min_budget !== undefined) {
    conditions.push(`budget >= $${paramIndex++}`);
    params.push(filters.min_budget);
  }
  
  if (filters.max_budget !== undefined) {
    conditions.push(`budget <= $${paramIndex++}`);
    params.push(filters.max_budget);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  // Count total
  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM campaigns ${whereClause}`,
    params
  );
  const total = parseInt(countResult[0].count, 10);
  
  // Get paginated results
  const offset = (filters.page - 1) * filters.limit;
  const orderBy = filters.sort_by;
  const orderDir = filters.sort_order.toUpperCase();
  
  const dataResult = await db.query<Campaign>(
    `SELECT * FROM campaigns ${whereClause} 
     ORDER BY ${orderBy} ${orderDir}
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, filters.limit, offset]
  );
  
  const totalPages = Math.ceil(total / filters.limit);
  
  return {
    data: dataResult,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      total_pages: totalPages,
      has_next: filters.page < totalPages,
      has_prev: filters.page > 1
    }
  };
}

async function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  const result = await db.query<Campaign>(
    `INSERT INTO campaigns (
      name, campaign_type, status, budget, currency,
      utm_source, utm_medium, utm_campaign, start_date, end_date, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      input.name,
      input.campaign_type ?? null,
      input.status,
      input.budget ?? null,
      input.currency,
      input.utm_source ?? null,
      input.utm_medium ?? null,
      input.utm_campaign ?? null,
      input.start_date ?? null,
      input.end_date ?? null,
      input.metadata ?? {}
    ]
  );
  
  return result[0];
}

async function updateCampaign(id: string, input: UpdateCampaignInput): Promise<Campaign> {
  // First, verify campaign exists
  await getCampaignById(id);
  
  const updates: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;
  
  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    params.push(input.name);
  }
  
  if (input.campaign_type !== undefined) {
    updates.push(`campaign_type = $${paramIndex++}`);
    params.push(input.campaign_type);
  }
  
  if (input.status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    params.push(input.status);
  }
  
  if (input.budget !== undefined) {
    updates.push(`budget = $${paramIndex++}`);
    params.push(input.budget);
  }
  
  if (input.spent !== undefined) {
    updates.push(`spent = $${paramIndex++}`);
    params.push(input.spent);
  }
  
  if (input.currency !== undefined) {
    updates.push(`currency = $${paramIndex++}`);
    params.push(input.currency);
  }
  
  if (input.utm_source !== undefined) {
    updates.push(`utm_source = $${paramIndex++}`);
    params.push(input.utm_source);
  }
  
  if (input.utm_medium !== undefined) {
    updates.push(`utm_medium = $${paramIndex++}`);
    params.push(input.utm_medium);
  }
  
  if (input.utm_campaign !== undefined) {
    updates.push(`utm_campaign = $${paramIndex++}`);
    params.push(input.utm_campaign);
  }
  
  if (input.start_date !== undefined) {
    updates.push(`start_date = $${paramIndex++}`);
    params.push(input.start_date);
  }
  
  if (input.end_date !== undefined) {
    updates.push(`end_date = $${paramIndex++}`);
    params.push(input.end_date);
  }
  
  if (input.metadata !== undefined) {
    updates.push(`metadata = $${paramIndex++}`);
    params.push(input.metadata);
  }
  
  if (updates.length === 0) {
    return getCampaignById(id);
  }
  
  params.push(id);
  
  const result = await db.query<Campaign>(
    `UPDATE campaigns SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );
  
  return result[0];
}

async function deleteCampaign(id: string): Promise<void> {
  // First, verify campaign exists
  await getCampaignById(id);
  
  await db.query('DELETE FROM campaigns WHERE id = $1', [id]);
}

async function getCampaignStats(id: string): Promise<CampaignStats> {
  const campaign = await getCampaignById(id);
  
  // Calculate additional stats from related data
  const leadsResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM leads 
     WHERE first_touch_campaign = $1 OR last_touch_campaign = $1`,
    [campaign.utm_campaign]
  );
  
  const dealsResult = await db.query<{ count: string; total_value: string }>(
    `SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as total_value 
     FROM deals d
     JOIN leads l ON d.lead_id = l.id
     WHERE l.first_touch_campaign = $1 OR l.last_touch_campaign = $1`,
    [campaign.utm_campaign]
  );
  
  const totalLeads = parseInt(leadsResult[0].count, 10) || campaign.leads_generated;
  const totalDeals = parseInt(dealsResult[0].count, 10) || campaign.deals_created;
  const totalRevenue = parseFloat(dealsResult[0].total_value) || campaign.revenue_attributed;
  
  const conversionRate = totalLeads > 0 ? (totalDeals / totalLeads) * 100 : 0;
  const costPerLead = campaign.spent > 0 && totalLeads > 0 ? campaign.spent / totalLeads : null;
  const roi = campaign.spent > 0 ? ((totalRevenue - campaign.spent) / campaign.spent) * 100 : null;
  
  return {
    total_leads: totalLeads,
    total_deals: totalDeals,
    total_revenue: totalRevenue,
    conversion_rate: Math.round(conversionRate * 100) / 100,
    cost_per_lead: costPerLead ? Math.round(costPerLead * 100) / 100 : null,
    roi: roi ? Math.round(roi * 100) / 100 : null
  };
}

async function getCampaignCountsByStatus(): Promise<Record<CampaignStatus, number>> {
  const result = await db.query<{ status: CampaignStatus; count: string }>(
    `SELECT status, COUNT(*) as count FROM campaigns GROUP BY status`
  );
  
  const counts: Record<CampaignStatus, number> = {
    draft: 0,
    active: 0,
    paused: 0,
    completed: 0
  };
  
  for (const row of result) {
    counts[row.status] = parseInt(row.count, 10);
  }
  
  return counts;
}

// =============================================================================
// Route Registration
// =============================================================================

export async function campaignsRoutes(fastify: FastifyInstance): Promise<void> {

  // ===========================================================================
  // GET /api/v1/campaigns
  // ===========================================================================
  /**
   * List campaigns with filtering, searching, and pagination.
   */
  fastify.get<{
    Querystring: CampaignFiltersInput;
  }>(
    '/campaigns',
    {
      preHandler: validateApiKey,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['draft', 'active', 'paused', 'completed'] },
            campaign_type: { type: 'string' },
            search: { type: 'string', description: 'Search in name and utm_campaign' },
            utm_source: { type: 'string' },
            utm_medium: { type: 'string' },
            start_after: { type: 'string', format: 'date-time' },
            start_before: { type: 'string', format: 'date-time' },
            end_after: { type: 'string', format: 'date-time' },
            end_before: { type: 'string', format: 'date-time' },
            min_budget: { type: 'number', minimum: 0 },
            max_budget: { type: 'number' },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sort_by: { type: 'string', enum: ['created_at', 'updated_at', 'name', 'start_date', 'end_date', 'budget', 'leads_generated', 'revenue_attributed'], default: 'created_at' },
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
      const parseResult = campaignFiltersSchema.safeParse(request.query);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid query parameters', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const result = await searchCampaigns(parseResult.data);
      
      return {
        data: result.data.map(transformCampaignResponse),
        pagination: result.pagination
      };
    }
  );

  // ===========================================================================
  // GET /api/v1/campaigns/stats
  // ===========================================================================
  /**
   * Get campaign statistics summary.
   */
  fastify.get(
    '/campaigns/stats',
    {
      preHandler: validateApiKey,
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              by_status: {
                type: 'object',
                properties: {
                  draft: { type: 'integer' },
                  active: { type: 'integer' },
                  paused: { type: 'integer' },
                  completed: { type: 'integer' }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const byStatus = await getCampaignCountsByStatus();
      
      return {
        by_status: byStatus
      };
    }
  );

  // ===========================================================================
  // GET /api/v1/campaigns/:id
  // ===========================================================================
  /**
   * Get a single campaign by ID.
   */
  fastify.get<{
    Params: IdParams;
  }>(
    '/campaigns/:id',
    {
      preHandler: validateApiKey,
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
      const parseResult = campaignIdParamSchema.safeParse(request.params);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid campaign ID', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const campaign = await getCampaignById(parseResult.data.id);
      return transformCampaignResponse(campaign);
    }
  );

  // ===========================================================================
  // GET /api/v1/campaigns/:id/stats
  // ===========================================================================
  /**
   * Get detailed statistics for a campaign.
   */
  fastify.get<{
    Params: IdParams;
  }>(
    '/campaigns/:id/stats',
    {
      preHandler: validateApiKey,
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
              total_leads: { type: 'integer' },
              total_deals: { type: 'integer' },
              total_revenue: { type: 'number' },
              conversion_rate: { type: 'number' },
              cost_per_lead: { type: ['number', 'null'] },
              roi: { type: ['number', 'null'] }
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
      const parseResult = campaignIdParamSchema.safeParse(request.params);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid campaign ID', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const stats = await getCampaignStats(parseResult.data.id);
      return stats;
    }
  );

  // ===========================================================================
  // POST /api/v1/campaigns
  // ===========================================================================
  /**
   * Create a new campaign.
   */
  fastify.post<{
    Body: CreateCampaignInput;
  }>(
    '/campaigns',
    {
      preHandler: validateApiKey,
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            campaign_type: { type: 'string', maxLength: 50 },
            status: { type: 'string', enum: ['draft', 'active', 'paused', 'completed'], default: 'draft' },
            budget: { type: 'number', minimum: 0 },
            currency: { type: 'string', minLength: 3, maxLength: 3, default: 'EUR' },
            utm_source: { type: 'string', maxLength: 100 },
            utm_medium: { type: 'string', maxLength: 100 },
            utm_campaign: { type: 'string', maxLength: 100 },
            start_date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            end_date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            metadata: { type: 'object', additionalProperties: true }
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
      const parseResult = createCampaignSchema.safeParse(request.body);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid campaign data', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const campaign = await createCampaign(parseResult.data);
      
      request.log.info({
        campaignId: campaign.id,
        name: campaign.name
      }, 'Campaign created');
      
      return reply.code(201).send(transformCampaignResponse(campaign));
    }
  );

  // ===========================================================================
  // PATCH /api/v1/campaigns/:id
  // ===========================================================================
  /**
   * Update an existing campaign.
   */
  fastify.patch<{
    Params: IdParams;
    Body: UpdateCampaignInput;
  }>(
    '/campaigns/:id',
    {
      preHandler: validateApiKey,
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
            name: { type: 'string', minLength: 1, maxLength: 255 },
            campaign_type: { type: ['string', 'null'], maxLength: 50 },
            status: { type: 'string', enum: ['draft', 'active', 'paused', 'completed'] },
            budget: { type: ['number', 'null'], minimum: 0 },
            spent: { type: 'number', minimum: 0 },
            currency: { type: 'string', minLength: 3, maxLength: 3 },
            utm_source: { type: ['string', 'null'], maxLength: 100 },
            utm_medium: { type: ['string', 'null'], maxLength: 100 },
            utm_campaign: { type: ['string', 'null'], maxLength: 100 },
            start_date: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            end_date: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            metadata: { type: 'object', additionalProperties: true }
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
      const paramResult = campaignIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid campaign ID', {
          validationErrors: paramResult.error.errors
        });
      }
      
      const bodyResult = updateCampaignSchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw new ValidationError('Invalid campaign data', {
          validationErrors: bodyResult.error.errors
        });
      }
      
      const campaign = await updateCampaign(paramResult.data.id, bodyResult.data);
      
      request.log.info({
        campaignId: campaign.id
      }, 'Campaign updated');
      
      return transformCampaignResponse(campaign);
    }
  );

  // ===========================================================================
  // DELETE /api/v1/campaigns/:id
  // ===========================================================================
  /**
   * Delete a campaign.
   */
  fastify.delete<{
    Params: IdParams;
  }>(
    '/campaigns/:id',
    {
      preHandler: validateApiKey,
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
      const parseResult = campaignIdParamSchema.safeParse(request.params);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid campaign ID', {
          validationErrors: parseResult.error.errors
        });
      }
      
      await deleteCampaign(parseResult.data.id);
      
      request.log.info({
        campaignId: parseResult.data.id
      }, 'Campaign deleted');
      
      return {
        success: true,
        message: 'Campaign deleted successfully'
      };
    }
  );

  // ===========================================================================
  // POST /api/v1/campaigns/:id/activate
  // ===========================================================================
  /**
   * Activate a campaign.
   */
  fastify.post<{
    Params: IdParams;
  }>(
    '/campaigns/:id/activate',
    {
      preHandler: validateApiKey,
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
      const parseResult = campaignIdParamSchema.safeParse(request.params);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid campaign ID', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const campaign = await updateCampaign(parseResult.data.id, { status: 'active' });
      
      request.log.info({
        campaignId: campaign.id
      }, 'Campaign activated');
      
      return transformCampaignResponse(campaign);
    }
  );

  // ===========================================================================
  // POST /api/v1/campaigns/:id/pause
  // ===========================================================================
  /**
   * Pause a campaign.
   */
  fastify.post<{
    Params: IdParams;
  }>(
    '/campaigns/:id/pause',
    {
      preHandler: validateApiKey,
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
      const parseResult = campaignIdParamSchema.safeParse(request.params);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid campaign ID', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const campaign = await updateCampaign(parseResult.data.id, { status: 'paused' });
      
      request.log.info({
        campaignId: campaign.id
      }, 'Campaign paused');
      
      return transformCampaignResponse(campaign);
    }
  );

  // ===========================================================================
  // POST /api/v1/campaigns/:id/complete
  // ===========================================================================
  /**
   * Mark a campaign as completed.
   */
  fastify.post<{
    Params: IdParams;
  }>(
    '/campaigns/:id/complete',
    {
      preHandler: validateApiKey,
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
      const parseResult = campaignIdParamSchema.safeParse(request.params);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid campaign ID', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const campaign = await updateCampaign(parseResult.data.id, { status: 'completed' });
      
      request.log.info({
        campaignId: campaign.id
      }, 'Campaign completed');
      
      return transformCampaignResponse(campaign);
    }
  );
}

export default campaignsRoutes;
