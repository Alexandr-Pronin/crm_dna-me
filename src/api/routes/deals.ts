// =============================================================================
// src/api/routes/deals.ts
// Deal Management API Routes
// =============================================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { validateApiKey } from '../middleware/apiKey.js';
import { 
  getDealService,
  type CreateDealInput,
  type UpdateDealInput,
  type MoveDealInput,
  type CloseDealInput,
  type DealFiltersInput,
  type DealWithRelations,
  type ReorderDealsInput
} from '../../services/dealService.js';
import { ValidationError } from '../../errors/index.js';
import type { Deal, DealStatus } from '../../types/index.js';

// =============================================================================
// Zod Schemas
// =============================================================================

const createDealSchema = z.object({
  lead_id: z.string().uuid(),
  pipeline_id: z.string().uuid(),
  stage_id: z.string().uuid().optional(),
  name: z.string().max(255).optional(),
  value: z.number().min(0).optional(),
  currency: z.string().length(3).default('EUR'),
  expected_close_date: z.string().datetime().optional(),
  assigned_to: z.string().uuid().optional(),
  assigned_region: z.string().max(50).optional(),
  metadata: z.record(z.unknown()).optional()
});

const updateDealSchema = z.object({
  name: z.string().max(255).optional(),
  value: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  expected_close_date: z.string().datetime().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  assigned_region: z.string().max(50).nullable().optional(),
  metadata: z.record(z.unknown()).optional()
});

const moveDealSchema = z.object({
  stage_id: z.string().uuid()
});

const reorderDealsSchema = z.object({
  stage_id: z.string().uuid(),
  ordered_ids: z.array(z.string().uuid()).min(1)
});

const closeDealSchema = z.object({
  status: z.enum(['won', 'lost']),
  close_reason: z.string().max(500).optional()
});

const dealFiltersSchema = z.object({
  pipeline_id: z.string().uuid().optional(),
  stage_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional(),
  status: z.enum(['open', 'won', 'lost']).optional(),
  assigned_to: z.string().uuid().optional(),
  min_value: z.coerce.number().min(0).optional(),
  max_value: z.coerce.number().optional(),
  created_after: z.string().datetime().optional(),
  created_before: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort_by: z.enum(['created_at', 'updated_at', 'value', 'name', 'stage_entered_at', 'position']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

const dealIdParamSchema = z.object({
  id: z.string().uuid()
});

// =============================================================================
// Type Definitions
// =============================================================================

interface IdParams {
  id: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function transformDealResponse(deal: DealWithRelations) {
  return {
    id: deal.id,
    lead_id: deal.lead_id,
    pipeline_id: deal.pipeline_id,
    stage_id: deal.stage_id,
    position: deal.position,
    name: deal.name ?? null,
    value: deal.value ?? null,
    currency: deal.currency,
    expected_close_date: deal.expected_close_date?.toISOString?.() ?? (deal.expected_close_date as unknown as string) ?? null,
    stage_entered_at: deal.stage_entered_at?.toISOString?.() ?? (deal.stage_entered_at as unknown as string),
    assigned_to: deal.assigned_to ?? null,
    assigned_region: deal.assigned_region ?? null,
    assigned_at: deal.assigned_at?.toISOString?.() ?? (deal.assigned_at as unknown as string) ?? null,
    status: deal.status,
    close_reason: deal.close_reason ?? null,
    closed_at: deal.closed_at?.toISOString?.() ?? (deal.closed_at as unknown as string) ?? null,
    moco_offer_id: deal.moco_offer_id ?? null,
    metadata: deal.metadata ?? {},
    created_at: deal.created_at?.toISOString?.() ?? (deal.created_at as unknown as string),
    updated_at: deal.updated_at?.toISOString?.() ?? (deal.updated_at as unknown as string),
    pipeline_name: deal.pipeline_name ?? undefined,
    stage_name: deal.stage_name ?? undefined
  };
}

// =============================================================================
// Route Registration
// =============================================================================

export async function dealsRoutes(fastify: FastifyInstance): Promise<void> {
  const dealService = getDealService();

  // ===========================================================================
  // GET /api/v1/deals
  // ===========================================================================
  /**
   * List deals with filtering, searching, and pagination.
   */
  fastify.get<{
    Querystring: DealFiltersInput;
  }>(
    '/deals',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'List deals with filtering and pagination',
        tags: ['Deals'],
        querystring: {
          type: 'object',
          properties: {
            pipeline_id: { type: 'string', format: 'uuid' },
            stage_id: { type: 'string', format: 'uuid' },
            lead_id: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['open', 'won', 'lost'] },
            assigned_to: { type: 'string', format: 'uuid' },
            min_value: { type: 'number', minimum: 0 },
            max_value: { type: 'number' },
            created_after: { type: 'string', format: 'date-time' },
            created_before: { type: 'string', format: 'date-time' },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sort_by: { type: 'string', enum: ['created_at', 'updated_at', 'value', 'name', 'stage_entered_at', 'position'], default: 'created_at' },
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
      const parseResult = dealFiltersSchema.safeParse(request.query);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid query parameters', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const result = await dealService.searchDeals(parseResult.data);
      
      return {
        data: result.data.map(transformDealResponse),
        pagination: result.pagination
      };
    }
  );

  // ===========================================================================
  // GET /api/v1/deals/stats
  // ===========================================================================
  /**
   * Get deal statistics.
   */
  fastify.get<{
    Querystring: { pipeline_id?: string };
  }>(
    '/deals/stats',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Get deal statistics',
        tags: ['Deals'],
        querystring: {
          type: 'object',
          properties: {
            pipeline_id: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              by_status: {
                type: 'object',
                properties: {
                  open: { type: 'integer' },
                  won: { type: 'integer' },
                  lost: { type: 'integer' }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const byStatus = await dealService.getDealCountsByStatus(request.query.pipeline_id);
      
      return {
        by_status: byStatus
      };
    }
  );

  // ===========================================================================
  // GET /api/v1/deals/:id
  // ===========================================================================
  /**
   * Get a single deal by ID.
   */
  fastify.get<{
    Params: IdParams;
  }>(
    '/deals/:id',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Get a deal by ID',
        tags: ['Deals'],
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
      const parseResult = dealIdParamSchema.safeParse(request.params);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid deal ID', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const deal = await dealService.getDealWithRelations(parseResult.data.id);
      return transformDealResponse(deal);
    }
  );

  // ===========================================================================
  // POST /api/v1/deals
  // ===========================================================================
  /**
   * Create a new deal.
   */
  fastify.post<{
    Body: CreateDealInput;
  }>(
    '/deals',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Create a new deal',
        tags: ['Deals'],
        body: {
          type: 'object',
          required: ['lead_id', 'pipeline_id'],
          properties: {
            lead_id: { type: 'string', format: 'uuid' },
            pipeline_id: { type: 'string', format: 'uuid' },
            stage_id: { type: 'string', format: 'uuid' },
            name: { type: 'string', maxLength: 255 },
            value: { type: 'number', minimum: 0 },
            currency: { type: 'string', minLength: 3, maxLength: 3, default: 'EUR' },
            expected_close_date: { type: 'string', format: 'date-time' },
            assigned_to: { type: 'string', format: 'uuid' },
            assigned_region: { type: 'string', maxLength: 50 },
            metadata: { type: 'object', additionalProperties: true }
          }
        },
        response: {
          201: { type: 'object', additionalProperties: true },
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
          },
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
      const parseResult = createDealSchema.safeParse(request.body);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid deal data', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const deal = await dealService.createDeal(parseResult.data);
      
      request.log.info({
        dealId: deal.id,
        leadId: deal.lead_id,
        pipelineId: deal.pipeline_id
      }, 'Deal created');
      
      return reply.code(201).send(transformDealResponse(deal));
    }
  );

  // ===========================================================================
  // PATCH /api/v1/deals/:id
  // ===========================================================================
  /**
   * Update an existing deal.
   */
  fastify.patch<{
    Params: IdParams;
    Body: UpdateDealInput;
  }>(
    '/deals/:id',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Update a deal',
        tags: ['Deals'],
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
            name: { type: 'string', maxLength: 255 },
            value: { type: 'number', minimum: 0 },
            currency: { type: 'string', minLength: 3, maxLength: 3 },
            expected_close_date: { type: ['string', 'null'], format: 'date-time' },
            assigned_to: { type: ['string', 'null'], format: 'uuid' },
            assigned_region: { type: ['string', 'null'], maxLength: 50 },
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
      const paramResult = dealIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid deal ID', {
          validationErrors: paramResult.error.errors
        });
      }
      
      const bodyResult = updateDealSchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw new ValidationError('Invalid deal data', {
          validationErrors: bodyResult.error.errors
        });
      }
      
      const deal = await dealService.updateDeal(paramResult.data.id, bodyResult.data);
      
      request.log.info({
        dealId: deal.id
      }, 'Deal updated');
      
      return transformDealResponse(deal);
    }
  );

  // ===========================================================================
  // POST /api/v1/deals/:id/move
  // ===========================================================================
  /**
   * Move a deal to a different stage.
   */
  fastify.post<{
    Params: IdParams;
    Body: MoveDealInput;
  }>(
    '/deals/:id/move',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Move a deal to a different stage',
        tags: ['Deals'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          required: ['stage_id'],
          properties: {
            stage_id: { type: 'string', format: 'uuid' }
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
          },
          422: {
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
      const paramResult = dealIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid deal ID', {
          validationErrors: paramResult.error.errors
        });
      }
      
      const bodyResult = moveDealSchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw new ValidationError('Invalid move data', {
          validationErrors: bodyResult.error.errors
        });
      }
      
      const deal = await dealService.moveDealToStage(paramResult.data.id, bodyResult.data);
      
      request.log.info({
        dealId: deal.id,
        newStageId: bodyResult.data.stage_id
      }, 'Deal moved to new stage');
      
      return transformDealResponse(deal);
    }
  );

  // ===========================================================================
  // POST /api/v1/deals/reorder
  // ===========================================================================
  /**
   * Reorder deals within a stage.
   */
  fastify.post<{
    Body: ReorderDealsInput;
  }>(
    '/deals/reorder',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Reorder deals within a stage',
        tags: ['Deals'],
        body: {
          type: 'object',
          required: ['stage_id', 'ordered_ids'],
          properties: {
            stage_id: { type: 'string', format: 'uuid' },
            ordered_ids: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' }
            }
          },
          422: {
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
      const bodyResult = reorderDealsSchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw new ValidationError('Invalid reorder data', {
          validationErrors: bodyResult.error.errors
        });
      }

      await dealService.reorderDealsInStage(bodyResult.data);

      return { success: true };
    }
  );

  // ===========================================================================
  // POST /api/v1/deals/:id/close
  // ===========================================================================
  /**
   * Close a deal (won or lost).
   */
  fastify.post<{
    Params: IdParams;
    Body: CloseDealInput;
  }>(
    '/deals/:id/close',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Close a deal as won or lost',
        tags: ['Deals'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['won', 'lost'] },
            close_reason: { type: 'string', maxLength: 500 }
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
          },
          422: {
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
      const paramResult = dealIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid deal ID', {
          validationErrors: paramResult.error.errors
        });
      }
      
      const bodyResult = closeDealSchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw new ValidationError('Invalid close data', {
          validationErrors: bodyResult.error.errors
        });
      }
      
      const deal = await dealService.closeDeal(paramResult.data.id, bodyResult.data);
      
      request.log.info({
        dealId: deal.id,
        status: bodyResult.data.status,
        closeReason: bodyResult.data.close_reason
      }, 'Deal closed');
      
      return transformDealResponse(deal);
    }
  );

  // ===========================================================================
  // POST /api/v1/deals/:id/reopen
  // ===========================================================================
  /**
   * Reopen a closed deal.
   */
  fastify.post<{
    Params: IdParams;
  }>(
    '/deals/:id/reopen',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Reopen a closed deal',
        tags: ['Deals'],
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
          },
          422: {
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
      const parseResult = dealIdParamSchema.safeParse(request.params);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid deal ID', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const deal = await dealService.reopenDeal(parseResult.data.id);
      
      request.log.info({
        dealId: deal.id
      }, 'Deal reopened');
      
      return transformDealResponse(deal);
    }
  );

  // ===========================================================================
  // PATCH /api/v1/deals/:id/lead
  // ===========================================================================
  /**
   * Update the lead associated with a deal.
   */
  fastify.patch<{
    Params: IdParams;
    Body: { lead_id: string };
  }>(
    '/deals/:id/lead',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Update the lead associated with a deal',
        tags: ['Deals'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          required: ['lead_id'],
          properties: {
            lead_id: { type: 'string', format: 'uuid' }
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
          },
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
      const paramResult = dealIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid deal ID', {
          validationErrors: paramResult.error.errors
        });
      }
      
      const bodyResult = z.object({ lead_id: z.string().uuid() }).safeParse(request.body);
      if (!bodyResult.success) {
        throw new ValidationError('Invalid lead ID', {
          validationErrors: bodyResult.error.errors
        });
      }
      
      const deal = await dealService.updateDealLead(paramResult.data.id, bodyResult.data.lead_id);
      
      request.log.info({
        dealId: deal.id,
        newLeadId: bodyResult.data.lead_id
      }, 'Deal lead updated');
      
      return transformDealResponse(deal);
    }
  );

  // ===========================================================================
  // DELETE /api/v1/deals/:id
  // ===========================================================================
  /**
   * Delete a deal.
   */
  fastify.delete<{
    Params: IdParams;
  }>(
    '/deals/:id',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Delete a deal',
        tags: ['Deals'],
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
      const parseResult = dealIdParamSchema.safeParse(request.params);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid deal ID', {
          validationErrors: parseResult.error.errors
        });
      }
      
      await dealService.deleteDeal(parseResult.data.id);
      
      request.log.info({
        dealId: parseResult.data.id
      }, 'Deal deleted');
      
      return {
        success: true,
        message: 'Deal deleted successfully'
      };
    }
  );
}

export default dealsRoutes;
