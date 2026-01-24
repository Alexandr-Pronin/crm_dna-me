// =============================================================================
// src/api/routes/pipelines.ts
// Pipeline Management API Routes
// =============================================================================

import type { FastifyInstance } from 'fastify';
import { validateApiKey } from '../middleware/apiKey.js';
import { getPipelineService } from '../../services/pipelineService.js';
import { getDealService } from '../../services/dealService.js';
import { ValidationError } from '../../errors/index.js';
import type { Pipeline, PipelineStage, Deal, AutomationStageConfig } from '../../types/index.js';

// =============================================================================
// Type Definitions
// =============================================================================

interface IdParams {
  id: string;
}

interface StageIdParams {
  id: string;
}

interface DealsQuery {
  status?: 'open' | 'won' | 'lost';
  limit?: string;
  offset?: string;
}

interface CreatePipelineBody {
  name: string;
  slug?: string;
  description?: string;
  is_active?: boolean;
  is_default?: boolean;
  sales_cycle_days?: number;
  target_persona?: string;
  config?: Record<string, unknown>;
}

interface UpdatePipelineBody {
  name?: string;
  slug?: string;
  description?: string;
  is_active?: boolean;
  is_default?: boolean;
  sales_cycle_days?: number | null;
  target_persona?: string | null;
  config?: Record<string, unknown>;
}

interface CreateStageBody {
  name: string;
  slug?: string;
  position?: number;
  stage_type?: string;
  automation_config?: AutomationStageConfig[];
}

interface UpdateStageBody {
  name?: string;
  slug?: string;
  stage_type?: string | null;
  automation_config?: AutomationStageConfig[];
}

interface ReorderStagesBody {
  stage_ids: string[];
}

// =============================================================================
// Helper Functions
// =============================================================================

function transformPipelineResponse(pipeline: Pipeline) {
  return {
    id: pipeline.id,
    slug: pipeline.slug,
    name: pipeline.name,
    description: pipeline.description ?? null,
    is_active: pipeline.is_active,
    is_default: pipeline.is_default,
    sales_cycle_days: pipeline.sales_cycle_days ?? null,
    target_persona: pipeline.target_persona ?? null,
    config: pipeline.config ?? {},
    created_at: pipeline.created_at?.toISOString?.() ?? (pipeline.created_at as unknown as string)
  };
}

function transformStageResponse(stage: PipelineStage) {
  return {
    id: stage.id,
    pipeline_id: stage.pipeline_id,
    slug: stage.slug,
    name: stage.name,
    position: stage.position,
    stage_type: stage.stage_type ?? null,
    automation_config: stage.automation_config ?? [],
    created_at: stage.created_at?.toISOString?.() ?? (stage.created_at as unknown as string)
  };
}

function transformDealResponse(deal: Deal & { pipeline_name?: string; stage_name?: string }) {
  return {
    id: deal.id,
    lead_id: deal.lead_id,
    pipeline_id: deal.pipeline_id,
    stage_id: deal.stage_id,
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

export async function pipelinesRoutes(fastify: FastifyInstance): Promise<void> {
  const pipelineService = getPipelineService();
  const dealService = getDealService();

  // ===========================================================================
  // GET /api/v1/pipelines
  // ===========================================================================
  /**
   * List all pipelines with optional summary metrics.
   */
  fastify.get<{
    Querystring: { include_inactive?: string; with_summary?: string };
  }>(
    '/pipelines',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'List all pipelines',
        tags: ['Pipelines'],
        querystring: {
          type: 'object',
          properties: {
            include_inactive: { type: 'string', enum: ['true', 'false'], default: 'false' },
            with_summary: { type: 'string', enum: ['true', 'false'], default: 'false' }
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
      const includeInactive = request.query.include_inactive === 'true';
      const withSummary = request.query.with_summary === 'true';
      
      if (withSummary) {
        const pipelines = await pipelineService.getAllPipelinesWithSummary();
        return {
          data: pipelines.map(p => ({
            ...transformPipelineResponse(p),
            deals_count: p.deals_count,
            total_value: p.total_value,
            stages_count: p.stages_count
          }))
        };
      }
      
      const pipelines = await pipelineService.getAllPipelines(includeInactive);
      return {
        data: pipelines.map(transformPipelineResponse)
      };
    }
  );

  // ===========================================================================
  // GET /api/v1/pipelines/:id
  // ===========================================================================
  /**
   * Get a single pipeline by ID with its stages.
   */
  fastify.get<{
    Params: IdParams;
    Querystring: { include_stages?: string };
  }>(
    '/pipelines/:id',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Get a pipeline by ID',
        tags: ['Pipelines'],
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
            include_stages: { type: 'string', enum: ['true', 'false'], default: 'true' }
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
      const { id } = request.params;
      const includeStages = request.query.include_stages !== 'false';
      
      if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        throw new ValidationError('Invalid pipeline ID format');
      }
      
      if (includeStages) {
        const pipeline = await pipelineService.getPipelineWithStages(id);
        return {
          ...transformPipelineResponse(pipeline),
          stages: pipeline.stages.map(transformStageResponse)
        };
      }
      
      const pipeline = await pipelineService.getPipelineById(id);
      return transformPipelineResponse(pipeline);
    }
  );

  // ===========================================================================
  // GET /api/v1/pipelines/:id/stages
  // ===========================================================================
  /**
   * Get all stages for a pipeline.
   */
  fastify.get<{
    Params: IdParams;
  }>(
    '/pipelines/:id/stages',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Get all stages for a pipeline',
        tags: ['Pipelines'],
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
              data: { type: 'array', items: { type: 'object', additionalProperties: true } }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;
      
      if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        throw new ValidationError('Invalid pipeline ID format');
      }
      
      const stages = await pipelineService.getPipelineStages(id);
      return {
        data: stages.map(transformStageResponse)
      };
    }
  );

  // ===========================================================================
  // GET /api/v1/pipelines/:id/deals
  // ===========================================================================
  /**
   * Get all deals in a pipeline.
   */
  fastify.get<{
    Params: IdParams;
    Querystring: DealsQuery;
  }>(
    '/pipelines/:id/deals',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Get all deals in a pipeline',
        tags: ['Pipelines', 'Deals'],
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
            status: { type: 'string', enum: ['open', 'won', 'lost'] },
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
      const { id } = request.params;
      
      if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        throw new ValidationError('Invalid pipeline ID format');
      }
      
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;
      const offset = request.query.offset ? parseInt(request.query.offset, 10) : 0;
      
      const deals = await dealService.getDealsByPipeline(id, {
        status: request.query.status,
        limit,
        offset
      });
      
      return {
        data: deals.map(transformDealResponse)
      };
    }
  );

  // ===========================================================================
  // GET /api/v1/pipelines/:id/metrics
  // ===========================================================================
  /**
   * Get metrics for a pipeline.
   */
  fastify.get<{
    Params: IdParams;
  }>(
    '/pipelines/:id/metrics',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Get pipeline metrics and statistics',
        tags: ['Pipelines'],
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
              pipeline_id: { type: 'string' },
              pipeline_name: { type: 'string' },
              total_deals: { type: 'integer' },
              open_deals: { type: 'integer' },
              won_deals: { type: 'integer' },
              lost_deals: { type: 'integer' },
              total_value: { type: 'number' },
              won_value: { type: 'number' },
              win_rate: { type: 'number' },
              avg_deal_value: { type: 'number' },
              avg_sales_cycle_days: { type: ['integer', 'null'] },
              stages: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    stage_id: { type: 'string' },
                    stage_name: { type: 'string' },
                    stage_position: { type: 'integer' },
                    deals_count: { type: 'integer' },
                    total_value: { type: 'number' },
                    avg_value: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;
      
      if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        throw new ValidationError('Invalid pipeline ID format');
      }
      
      const metrics = await pipelineService.getPipelineMetrics(id);
      return metrics;
    }
  );

  // ===========================================================================
  // POST /api/v1/pipelines
  // ===========================================================================
  /**
   * Create a new pipeline.
   */
  fastify.post<{
    Body: CreatePipelineBody;
  }>(
    '/pipelines',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Create a new pipeline',
        tags: ['Pipelines'],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            slug: { type: 'string', minLength: 1, maxLength: 100, pattern: '^[a-z0-9-]+$' },
            description: { type: 'string' },
            is_active: { type: 'boolean', default: true },
            is_default: { type: 'boolean', default: false },
            sales_cycle_days: { type: 'integer', minimum: 1 },
            target_persona: { type: 'string', maxLength: 255 },
            config: { type: 'object', additionalProperties: true }
          }
        },
        response: {
          201: { type: 'object', additionalProperties: true },
          400: {
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
      const pipeline = await pipelineService.createPipeline(request.body);
      reply.status(201);
      return transformPipelineResponse(pipeline);
    }
  );

  // ===========================================================================
  // PATCH /api/v1/pipelines/:id
  // ===========================================================================
  /**
   * Update a pipeline.
   */
  fastify.patch<{
    Params: IdParams;
    Body: UpdatePipelineBody;
  }>(
    '/pipelines/:id',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Update a pipeline',
        tags: ['Pipelines'],
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
            slug: { type: 'string', minLength: 1, maxLength: 100, pattern: '^[a-z0-9-]+$' },
            description: { type: ['string', 'null'] },
            is_active: { type: 'boolean' },
            is_default: { type: 'boolean' },
            sales_cycle_days: { type: ['integer', 'null'], minimum: 1 },
            target_persona: { type: ['string', 'null'], maxLength: 255 },
            config: { type: 'object', additionalProperties: true }
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
      const { id } = request.params;
      
      if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        throw new ValidationError('Invalid pipeline ID format');
      }
      
      const pipeline = await pipelineService.updatePipeline(id, request.body);
      return transformPipelineResponse(pipeline);
    }
  );

  // ===========================================================================
  // DELETE /api/v1/pipelines/:id
  // ===========================================================================
  /**
   * Delete a pipeline.
   */
  fastify.delete<{
    Params: IdParams;
  }>(
    '/pipelines/:id',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Delete a pipeline',
        tags: ['Pipelines'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          204: { type: 'null' },
          400: {
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
      const { id } = request.params;
      
      if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        throw new ValidationError('Invalid pipeline ID format');
      }
      
      await pipelineService.deletePipeline(id);
      reply.status(204);
      return;
    }
  );

  // ===========================================================================
  // POST /api/v1/pipelines/:id/stages
  // ===========================================================================
  /**
   * Create a new stage in a pipeline.
   */
  fastify.post<{
    Params: IdParams;
    Body: CreateStageBody;
  }>(
    '/pipelines/:id/stages',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Create a new stage in a pipeline',
        tags: ['Pipelines'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            slug: { type: 'string', minLength: 1, maxLength: 100, pattern: '^[a-z0-9-]+$' },
            position: { type: 'integer', minimum: 1 },
            stage_type: { type: 'string', maxLength: 50 },
            automation_config: { type: 'array', items: { type: 'object', additionalProperties: true } }
          }
        },
        response: {
          201: { type: 'object', additionalProperties: true },
          400: {
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
      const { id } = request.params;
      
      if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        throw new ValidationError('Invalid pipeline ID format');
      }
      
      const stage = await pipelineService.createStage(id, request.body as {
        name: string;
        slug?: string;
        position?: number;
        stage_type?: string;
        automation_config?: Record<string, unknown>[];
      });
      reply.status(201);
      return transformStageResponse(stage);
    }
  );

  // ===========================================================================
  // POST /api/v1/pipelines/:id/stages/reorder
  // ===========================================================================
  /**
   * Reorder stages in a pipeline.
   */
  fastify.post<{
    Params: IdParams;
    Body: ReorderStagesBody;
  }>(
    '/pipelines/:id/stages/reorder',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Reorder stages in a pipeline',
        tags: ['Pipelines'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          required: ['stage_ids'],
          properties: {
            stage_ids: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
              minItems: 1
            }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { type: 'object', additionalProperties: true } }
            }
          },
          400: {
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
      const { id } = request.params;
      
      if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        throw new ValidationError('Invalid pipeline ID format');
      }
      
      // Validate all stage IDs are valid UUIDs
      for (const stageId of request.body.stage_ids) {
        if (!stageId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          throw new ValidationError(`Invalid stage ID format: ${stageId}`);
        }
      }
      
      const stages = await pipelineService.reorderStages(id, request.body.stage_ids);
      return {
        data: stages.map(transformStageResponse)
      };
    }
  );

  // ===========================================================================
  // PATCH /api/v1/stages/:id
  // ===========================================================================
  /**
   * Update a stage.
   */
  fastify.patch<{
    Params: StageIdParams;
    Body: UpdateStageBody;
  }>(
    '/stages/:id',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Update a stage',
        tags: ['Pipelines'],
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
            slug: { type: 'string', minLength: 1, maxLength: 100, pattern: '^[a-z0-9-]+$' },
            stage_type: { type: ['string', 'null'], maxLength: 50 },
            automation_config: { type: 'array', items: { type: 'object', additionalProperties: true } }
          }
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          400: {
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
      const { id } = request.params;
      
      if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        throw new ValidationError('Invalid stage ID format');
      }
      
      const stage = await pipelineService.updateStage(id, request.body as {
        name?: string;
        slug?: string;
        stage_type?: string | null;
        automation_config?: Record<string, unknown>[];
      });
      return transformStageResponse(stage);
    }
  );

  // ===========================================================================
  // DELETE /api/v1/stages/:id
  // ===========================================================================
  /**
   * Delete a stage.
   */
  fastify.delete<{
    Params: StageIdParams;
  }>(
    '/stages/:id',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Delete a stage',
        tags: ['Pipelines'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          204: { type: 'null' },
          400: {
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
      const { id } = request.params;
      
      if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        throw new ValidationError('Invalid stage ID format');
      }
      
      await pipelineService.deleteStage(id);
      reply.status(204);
      return;
    }
  );
}

export default pipelinesRoutes;
