// =============================================================================
// src/services/pipelineService.ts
// Pipeline Management Service
// =============================================================================

import { db } from '../db/index.js';
import { NotFoundError } from '../errors/index.js';
import type {
  Pipeline,
  PipelineStage
} from '../types/index.js';

// =============================================================================
// Types
// =============================================================================

export interface PipelineWithStages extends Pipeline {
  stages: PipelineStage[];
}

export interface StageMetrics {
  stage_id: string;
  stage_name: string;
  stage_position: number;
  deals_count: number;
  total_value: number;
  avg_value: number;
}

export interface PipelineMetrics {
  pipeline_id: string;
  pipeline_name: string;
  total_deals: number;
  open_deals: number;
  won_deals: number;
  lost_deals: number;
  total_value: number;
  won_value: number;
  win_rate: number;
  avg_deal_value: number;
  avg_sales_cycle_days: number | null;
  stages: StageMetrics[];
}

// =============================================================================
// Pipeline Service Class
// =============================================================================

export class PipelineService {
  // ===========================================================================
  // Get All Pipelines
  // ===========================================================================
  
  async getAllPipelines(includeInactive: boolean = false): Promise<Pipeline[]> {
    const whereClause = includeInactive ? '' : 'WHERE is_active = TRUE';
    
    return await db.query<Pipeline>(
      `SELECT * FROM pipelines ${whereClause} ORDER BY is_default DESC, name ASC`
    );
  }

  // ===========================================================================
  // Get Pipeline by ID
  // ===========================================================================
  
  async getPipelineById(id: string): Promise<Pipeline> {
    const pipeline = await db.queryOne<Pipeline>(
      'SELECT * FROM pipelines WHERE id = $1',
      [id]
    );
    
    if (!pipeline) {
      throw new NotFoundError('Pipeline', id);
    }
    
    return pipeline;
  }

  // ===========================================================================
  // Get Pipeline by Slug
  // ===========================================================================
  
  async getPipelineBySlug(slug: string): Promise<Pipeline | null> {
    return await db.queryOne<Pipeline>(
      'SELECT * FROM pipelines WHERE slug = $1',
      [slug]
    );
  }

  // ===========================================================================
  // Get Pipeline with Stages
  // ===========================================================================
  
  async getPipelineWithStages(id: string): Promise<PipelineWithStages> {
    const pipeline = await this.getPipelineById(id);
    
    const stages = await db.query<PipelineStage>(
      `SELECT * FROM pipeline_stages 
       WHERE pipeline_id = $1 
       ORDER BY position ASC`,
      [id]
    );
    
    return {
      ...pipeline,
      stages
    };
  }

  // ===========================================================================
  // Get All Pipeline Stages
  // ===========================================================================
  
  async getPipelineStages(pipelineId: string): Promise<PipelineStage[]> {
    // Verify pipeline exists
    await this.getPipelineById(pipelineId);
    
    return await db.query<PipelineStage>(
      `SELECT * FROM pipeline_stages 
       WHERE pipeline_id = $1 
       ORDER BY position ASC`,
      [pipelineId]
    );
  }

  // ===========================================================================
  // Get Stage by ID
  // ===========================================================================
  
  async getStageById(stageId: string): Promise<PipelineStage> {
    const stage = await db.queryOne<PipelineStage>(
      'SELECT * FROM pipeline_stages WHERE id = $1',
      [stageId]
    );
    
    if (!stage) {
      throw new NotFoundError('Pipeline Stage', stageId);
    }
    
    return stage;
  }

  // ===========================================================================
  // Get First Stage of Pipeline
  // ===========================================================================
  
  async getFirstStage(pipelineId: string): Promise<PipelineStage | null> {
    return await db.queryOne<PipelineStage>(
      `SELECT * FROM pipeline_stages 
       WHERE pipeline_id = $1 
       ORDER BY position ASC 
       LIMIT 1`,
      [pipelineId]
    );
  }

  // ===========================================================================
  // Get Pipeline Metrics
  // ===========================================================================
  
  async getPipelineMetrics(pipelineId: string): Promise<PipelineMetrics> {
    const pipeline = await this.getPipelineById(pipelineId);
    
    // Get overall deal stats
    const dealStats = await db.queryOne<{
      total_deals: string;
      open_deals: string;
      won_deals: string;
      lost_deals: string;
      total_value: string;
      won_value: string;
      avg_deal_value: string;
    }>(
      `SELECT 
        COUNT(*) as total_deals,
        COUNT(*) FILTER (WHERE status = 'open') as open_deals,
        COUNT(*) FILTER (WHERE status = 'won') as won_deals,
        COUNT(*) FILTER (WHERE status = 'lost') as lost_deals,
        COALESCE(SUM(value), 0) as total_value,
        COALESCE(SUM(value) FILTER (WHERE status = 'won'), 0) as won_value,
        COALESCE(AVG(value), 0) as avg_deal_value
       FROM deals 
       WHERE pipeline_id = $1`,
      [pipelineId]
    );
    
    // Calculate average sales cycle (days from created to closed for won deals)
    const salesCycle = await db.queryOne<{ avg_days: string | null }>(
      `SELECT AVG(EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400) as avg_days
       FROM deals 
       WHERE pipeline_id = $1 AND status = 'won' AND closed_at IS NOT NULL`,
      [pipelineId]
    );
    
    // Get metrics per stage
    const stageMetrics = await db.query<{
      stage_id: string;
      stage_name: string;
      stage_position: number;
      deals_count: string;
      total_value: string;
      avg_value: string;
    }>(
      `SELECT 
        ps.id as stage_id,
        ps.name as stage_name,
        ps.position as stage_position,
        COUNT(d.id) as deals_count,
        COALESCE(SUM(d.value), 0) as total_value,
        COALESCE(AVG(d.value), 0) as avg_value
       FROM pipeline_stages ps
       LEFT JOIN deals d ON d.stage_id = ps.id AND d.status = 'open'
       WHERE ps.pipeline_id = $1
       GROUP BY ps.id, ps.name, ps.position
       ORDER BY ps.position ASC`,
      [pipelineId]
    );
    
    const totalDeals = parseInt(dealStats?.total_deals || '0', 10);
    const wonDeals = parseInt(dealStats?.won_deals || '0', 10);
    const closedDeals = wonDeals + parseInt(dealStats?.lost_deals || '0', 10);
    
    return {
      pipeline_id: pipeline.id,
      pipeline_name: pipeline.name,
      total_deals: totalDeals,
      open_deals: parseInt(dealStats?.open_deals || '0', 10),
      won_deals: wonDeals,
      lost_deals: parseInt(dealStats?.lost_deals || '0', 10),
      total_value: parseFloat(dealStats?.total_value || '0'),
      won_value: parseFloat(dealStats?.won_value || '0'),
      win_rate: closedDeals > 0 ? Math.round((wonDeals / closedDeals) * 100) : 0,
      avg_deal_value: parseFloat(dealStats?.avg_deal_value || '0'),
      avg_sales_cycle_days: salesCycle?.avg_days ? Math.round(parseFloat(salesCycle.avg_days)) : null,
      stages: stageMetrics.map(s => ({
        stage_id: s.stage_id,
        stage_name: s.stage_name,
        stage_position: s.stage_position,
        deals_count: parseInt(s.deals_count, 10),
        total_value: parseFloat(s.total_value),
        avg_value: parseFloat(s.avg_value)
      }))
    };
  }

  // ===========================================================================
  // Get All Pipelines with Metrics Summary
  // ===========================================================================
  
  async getAllPipelinesWithSummary(): Promise<Array<Pipeline & { 
    deals_count: number; 
    total_value: number;
    stages_count: number;
  }>> {
    return await db.query<Pipeline & { 
      deals_count: number; 
      total_value: number;
      stages_count: number;
    }>(
      `SELECT 
        p.*,
        COALESCE(d.deals_count, 0)::integer as deals_count,
        COALESCE(d.total_value, 0)::numeric as total_value,
        COALESCE(s.stages_count, 0)::integer as stages_count
       FROM pipelines p
       LEFT JOIN (
         SELECT pipeline_id, COUNT(*) as deals_count, SUM(value) as total_value
         FROM deals WHERE status = 'open'
         GROUP BY pipeline_id
       ) d ON d.pipeline_id = p.id
       LEFT JOIN (
         SELECT pipeline_id, COUNT(*) as stages_count
         FROM pipeline_stages
         GROUP BY pipeline_id
       ) s ON s.pipeline_id = p.id
       WHERE p.is_active = TRUE
       ORDER BY p.is_default DESC, p.name ASC`
    );
  }

  // ===========================================================================
  // Get Default Pipeline
  // ===========================================================================
  
  async getDefaultPipeline(): Promise<Pipeline | null> {
    return await db.queryOne<Pipeline>(
      'SELECT * FROM pipelines WHERE is_default = TRUE AND is_active = TRUE LIMIT 1'
    );
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let pipelineServiceInstance: PipelineService | null = null;

export function getPipelineService(): PipelineService {
  if (!pipelineServiceInstance) {
    pipelineServiceInstance = new PipelineService();
  }
  return pipelineServiceInstance;
}

export const pipelineService = {
  get instance() {
    return getPipelineService();
  }
};

export default pipelineService;
