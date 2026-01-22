// =============================================================================
// src/api/routes/reports.ts
// Reports & Analytics API Routes
// =============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { validateApiKey } from '../middleware/apiKey.js';
import { getReportService } from '../../services/reportService.js';
import { ValidationError } from '../../errors/index.js';

// =============================================================================
// Validation Schemas
// =============================================================================

const dateRangeSchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional()
});

const pipelineFunnelSchema = z.object({
  pipeline_id: z.string().uuid().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional()
});

// =============================================================================
// Routes
// =============================================================================

export async function reportsRoutes(fastify: FastifyInstance): Promise<void> {
  const reportService = getReportService();

  // ===========================================================================
  // GET /reports/leads-by-score
  // ===========================================================================
  /**
   * Get lead distribution by score tier (cold, warm, hot, very_hot)
   */
  fastify.get(
    '/reports/leads-by-score',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Get lead distribution by score tier',
        tags: ['Reports'],
        querystring: {
          type: 'object',
          properties: {
            start_date: { type: 'string', format: 'date-time', description: 'Filter leads created after this date' },
            end_date: { type: 'string', format: 'date-time', description: 'Filter leads created before this date' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              total_leads: { type: 'integer' },
              score_distribution: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    tier: { type: 'string', enum: ['cold', 'warm', 'hot', 'very_hot'] },
                    count: { type: 'integer' },
                    percentage: { type: 'number' },
                    avg_score: { type: 'number' },
                    min_score_threshold: { type: 'integer' },
                    max_score_threshold: { type: ['integer', 'null'] }
                  }
                }
              },
              avg_total_score: { type: 'number' },
              score_breakdown: {
                type: 'object',
                properties: {
                  avg_demographic: { type: 'number' },
                  avg_engagement: { type: 'number' },
                  avg_behavior: { type: 'number' }
                }
              }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = dateRangeSchema.safeParse(request.query);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid query parameters', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const result = await reportService.getLeadsByScore(parseResult.data);
      return result;
    }
  );

  // ===========================================================================
  // GET /reports/leads-by-intent
  // ===========================================================================
  /**
   * Get lead distribution by intent type (research, b2b, co_creation)
   */
  fastify.get(
    '/reports/leads-by-intent',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Get lead distribution by intent type',
        tags: ['Reports'],
        querystring: {
          type: 'object',
          properties: {
            start_date: { type: 'string', format: 'date-time', description: 'Filter leads created after this date' },
            end_date: { type: 'string', format: 'date-time', description: 'Filter leads created before this date' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              total_leads_with_intent: { type: 'integer' },
              no_intent_count: { type: 'integer' },
              intent_distribution: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    intent: { type: 'string', enum: ['research', 'b2b', 'co_creation'] },
                    count: { type: 'integer' },
                    percentage: { type: 'number' },
                    avg_confidence: { type: 'number' },
                    routed_count: { type: 'integer' },
                    routed_percentage: { type: 'number' }
                  }
                }
              },
              conflict_count: { type: 'integer' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = dateRangeSchema.safeParse(request.query);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid query parameters', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const result = await reportService.getLeadsByIntent(parseResult.data);
      return result;
    }
  );

  // ===========================================================================
  // GET /reports/pipeline-funnel
  // ===========================================================================
  /**
   * Get pipeline funnel metrics with stage-by-stage analysis
   */
  fastify.get(
    '/reports/pipeline-funnel',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Get pipeline funnel metrics with stage analysis',
        tags: ['Reports'],
        querystring: {
          type: 'object',
          properties: {
            pipeline_id: { type: 'string', format: 'uuid', description: 'Filter by specific pipeline' },
            start_date: { type: 'string', format: 'date-time', description: 'Filter deals created after this date' },
            end_date: { type: 'string', format: 'date-time', description: 'Filter deals created before this date' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    pipeline_id: { type: 'string', format: 'uuid' },
                    pipeline_name: { type: 'string' },
                    total_deals: { type: 'integer' },
                    open_deals: { type: 'integer' },
                    won_deals: { type: 'integer' },
                    lost_deals: { type: 'integer' },
                    total_value: { type: 'number' },
                    won_value: { type: 'number' },
                    win_rate: { type: 'number' },
                    avg_sales_cycle_days: { type: 'number' },
                    stages: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          stage_id: { type: 'string', format: 'uuid' },
                          stage_name: { type: 'string' },
                          position: { type: 'integer' },
                          deal_count: { type: 'integer' },
                          total_value: { type: 'number' },
                          avg_value: { type: 'number' },
                          avg_time_in_stage_days: { type: 'number' },
                          conversion_rate: { type: 'number' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = pipelineFunnelSchema.safeParse(request.query);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid query parameters', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const { pipeline_id, start_date, end_date } = parseResult.data;
      const result = await reportService.getPipelineFunnel(
        pipeline_id,
        { start_date, end_date }
      );
      
      return { data: result };
    }
  );

  // ===========================================================================
  // GET /reports/campaign-attribution
  // ===========================================================================
  /**
   * Get campaign attribution metrics including ROI and source analysis
   */
  fastify.get(
    '/reports/campaign-attribution',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Get campaign attribution metrics with ROI analysis',
        tags: ['Reports'],
        querystring: {
          type: 'object',
          properties: {
            start_date: { type: 'string', format: 'date-time', description: 'Filter campaigns created after this date' },
            end_date: { type: 'string', format: 'date-time', description: 'Filter campaigns created before this date' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              total_campaigns: { type: 'integer' },
              total_leads_attributed: { type: 'integer' },
              total_revenue: { type: 'number' },
              total_spent: { type: 'number' },
              overall_roi: { type: 'number' },
              campaigns: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    campaign_id: { type: 'string', format: 'uuid' },
                    campaign_name: { type: 'string' },
                    utm_campaign: { type: ['string', 'null'] },
                    status: { type: 'string' },
                    leads_generated: { type: 'integer' },
                    first_touch_leads: { type: 'integer' },
                    last_touch_leads: { type: 'integer' },
                    deals_created: { type: 'integer' },
                    revenue_attributed: { type: 'number' },
                    spent: { type: 'number' },
                    roi: { type: 'number' },
                    cost_per_lead: { type: 'number' }
                  }
                }
              },
              top_sources: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    source: { type: 'string' },
                    lead_count: { type: 'integer' },
                    percentage: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = dateRangeSchema.safeParse(request.query);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid query parameters', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const result = await reportService.getCampaignAttribution(parseResult.data);
      return result;
    }
  );

  // ===========================================================================
  // GET /reports/routing-effectiveness
  // ===========================================================================
  /**
   * Get routing effectiveness metrics including time-to-route and pipeline distribution
   */
  fastify.get(
    '/reports/routing-effectiveness',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Get routing effectiveness metrics',
        tags: ['Reports'],
        querystring: {
          type: 'object',
          properties: {
            start_date: { type: 'string', format: 'date-time', description: 'Filter leads created after this date' },
            end_date: { type: 'string', format: 'date-time', description: 'Filter leads created before this date' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              total_leads: { type: 'integer' },
              routed_count: { type: 'integer' },
              unrouted_count: { type: 'integer' },
              pending_count: { type: 'integer' },
              manual_review_count: { type: 'integer' },
              routing_rate: { type: 'number' },
              avg_score_at_routing: { type: 'number' },
              avg_time_to_route_hours: { type: 'number' },
              routing_by_period: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    period: { type: 'string' },
                    total_routed: { type: 'integer' },
                    by_pipeline: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          pipeline_name: { type: 'string' },
                          count: { type: 'integer' },
                          percentage: { type: 'number' }
                        }
                      }
                    },
                    by_intent: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          intent: { type: 'string', enum: ['research', 'b2b', 'co_creation'] },
                          count: { type: 'integer' },
                          percentage: { type: 'number' }
                        }
                      }
                    },
                    avg_time_to_route_hours: { type: 'number' },
                    manual_review_count: { type: 'integer' },
                    manual_review_percentage: { type: 'number' }
                  }
                }
              },
              pipeline_distribution: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    pipeline_name: { type: 'string' },
                    count: { type: 'integer' },
                    percentage: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = dateRangeSchema.safeParse(request.query);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid query parameters', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const result = await reportService.getRoutingEffectiveness(parseResult.data);
      return result;
    }
  );

  // ===========================================================================
  // GET /reports/summary
  // ===========================================================================
  /**
   * Get a high-level summary of all key metrics
   */
  fastify.get(
    '/reports/summary',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Get high-level summary of all key metrics',
        tags: ['Reports'],
        querystring: {
          type: 'object',
          properties: {
            start_date: { type: 'string', format: 'date-time' },
            end_date: { type: 'string', format: 'date-time' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              leads: {
                type: 'object',
                properties: {
                  total: { type: 'integer' },
                  avg_score: { type: 'number' },
                  hot_leads: { type: 'integer' },
                  routing_rate: { type: 'number' }
                }
              },
              deals: {
                type: 'object',
                properties: {
                  total: { type: 'integer' },
                  open: { type: 'integer' },
                  won: { type: 'integer' },
                  win_rate: { type: 'number' },
                  total_value: { type: 'number' }
                }
              },
              campaigns: {
                type: 'object',
                properties: {
                  total: { type: 'integer' },
                  active: { type: 'integer' },
                  total_spent: { type: 'number' },
                  overall_roi: { type: 'number' }
                }
              }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = dateRangeSchema.safeParse(request.query);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid query parameters', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const filters = parseResult.data;
      
      // Fetch all reports in parallel for efficiency
      const [scoreReport, routingReport, campaignReport, funnelReport] = await Promise.all([
        reportService.getLeadsByScore(filters),
        reportService.getRoutingEffectiveness(filters),
        reportService.getCampaignAttribution(filters),
        reportService.getPipelineFunnel(undefined, filters)
      ]);
      
      // Calculate deal totals from funnel
      const dealTotals = funnelReport.reduce((acc, p) => ({
        total: acc.total + p.total_deals,
        open: acc.open + p.open_deals,
        won: acc.won + p.won_deals,
        value: acc.value + p.total_value
      }), { total: 0, open: 0, won: 0, value: 0 });
      
      // Count hot leads
      const hotLeads = scoreReport.score_distribution
        .filter(d => d.tier === 'hot' || d.tier === 'very_hot')
        .reduce((sum, d) => sum + d.count, 0);
      
      return {
        leads: {
          total: scoreReport.total_leads,
          avg_score: scoreReport.avg_total_score,
          hot_leads: hotLeads,
          routing_rate: routingReport.routing_rate
        },
        deals: {
          total: dealTotals.total,
          open: dealTotals.open,
          won: dealTotals.won,
          win_rate: dealTotals.total > 0 
            ? Number(((dealTotals.won / dealTotals.total) * 100).toFixed(2)) 
            : 0,
          total_value: dealTotals.value
        },
        campaigns: {
          total: campaignReport.total_campaigns,
          active: campaignReport.campaigns.filter(c => c.status === 'active').length,
          total_spent: campaignReport.total_spent,
          overall_roi: campaignReport.overall_roi
        }
      };
    }
  );
}

export default reportsRoutes;
