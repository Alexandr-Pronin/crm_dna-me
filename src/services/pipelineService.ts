// =============================================================================
// src/services/pipelineService.ts
// Pipeline Management Service
// =============================================================================

import { db } from '../db/index.js';
import { NotFoundError, ValidationError, ConflictError } from '../errors/index.js';
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

  // ===========================================================================
  // Create Pipeline
  // ===========================================================================
  
  async createPipeline(data: {
    name: string;
    slug?: string;
    description?: string;
    is_active?: boolean;
    is_default?: boolean;
    sales_cycle_days?: number;
    target_persona?: string;
    config?: Record<string, unknown>;
  }): Promise<Pipeline> {
    // Generate slug from name if not provided
    const slug = data.slug || this.generateSlug(data.name);
    
    // Check if slug already exists
    const existingPipeline = await this.getPipelineBySlug(slug);
    if (existingPipeline) {
      throw new ConflictError(`Pipeline with slug '${slug}' already exists`);
    }
    
    // If this pipeline is set as default, unset other defaults
    if (data.is_default) {
      await db.execute(
        'UPDATE pipelines SET is_default = FALSE WHERE is_default = TRUE'
      );
    }
    
    const pipeline = await db.queryOne<Pipeline>(
      `INSERT INTO pipelines (slug, name, description, is_active, is_default, sales_cycle_days, target_persona, config)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        slug,
        data.name,
        data.description || null,
        data.is_active ?? true,
        data.is_default ?? false,
        data.sales_cycle_days || null,
        data.target_persona || null,
        JSON.stringify(data.config || {})
      ]
    );
    
    if (!pipeline) {
      throw new Error('Failed to create pipeline');
    }
    
    return pipeline;
  }

  // ===========================================================================
  // Update Pipeline
  // ===========================================================================
  
  async updatePipeline(id: string, data: {
    name?: string;
    slug?: string;
    description?: string;
    is_active?: boolean;
    is_default?: boolean;
    sales_cycle_days?: number | null;
    target_persona?: string | null;
    config?: Record<string, unknown>;
  }): Promise<Pipeline> {
    // Verify pipeline exists
    const existingPipeline = await this.getPipelineById(id);
    
    // If changing slug, check it doesn't conflict
    if (data.slug && data.slug !== existingPipeline.slug) {
      const slugConflict = await this.getPipelineBySlug(data.slug);
      if (slugConflict) {
        throw new ConflictError(`Pipeline with slug '${data.slug}' already exists`);
      }
    }
    
    // If setting as default, unset other defaults
    if (data.is_default === true) {
      await db.execute(
        'UPDATE pipelines SET is_default = FALSE WHERE is_default = TRUE AND id != $1',
        [id]
      );
    }
    
    // Build dynamic update query
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;
    
    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.slug !== undefined) {
      updates.push(`slug = $${paramIndex++}`);
      values.push(data.slug);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(data.is_active);
    }
    if (data.is_default !== undefined) {
      updates.push(`is_default = $${paramIndex++}`);
      values.push(data.is_default);
    }
    if (data.sales_cycle_days !== undefined) {
      updates.push(`sales_cycle_days = $${paramIndex++}`);
      values.push(data.sales_cycle_days);
    }
    if (data.target_persona !== undefined) {
      updates.push(`target_persona = $${paramIndex++}`);
      values.push(data.target_persona);
    }
    if (data.config !== undefined) {
      updates.push(`config = $${paramIndex++}`);
      values.push(JSON.stringify(data.config));
    }
    
    if (updates.length === 0) {
      return existingPipeline;
    }
    
    values.push(id);
    
    const pipeline = await db.queryOne<Pipeline>(
      `UPDATE pipelines SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    if (!pipeline) {
      throw new Error('Failed to update pipeline');
    }
    
    return pipeline;
  }

  // ===========================================================================
  // Delete Pipeline
  // ===========================================================================
  
  async deletePipeline(id: string): Promise<void> {
    // Verify pipeline exists
    const pipeline = await this.getPipelineById(id);
    
    // Check if it's the default pipeline
    if (pipeline.is_default) {
      throw new ValidationError('Cannot delete the default pipeline. Set another pipeline as default first.');
    }
    
    // Check for active deals
    const dealCount = await db.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM deals WHERE pipeline_id = $1 AND status = $2',
      [id, 'open']
    );
    
    if (dealCount && parseInt(dealCount.count, 10) > 0) {
      throw new ConflictError(
        `Cannot delete pipeline: ${dealCount.count} open deals exist. Move or close them first.`,
        { open_deals: parseInt(dealCount.count, 10) }
      );
    }
    
    // Delete pipeline (cascade will remove stages)
    await db.execute('DELETE FROM pipelines WHERE id = $1', [id]);
  }

  // ===========================================================================
  // Create Stage
  // ===========================================================================
  
  async createStage(pipelineId: string, data: {
    name: string;
    slug?: string;
    position?: number;
    color?: string;
    stage_type?: string;
    automation_config?: Record<string, unknown>[];
  }): Promise<PipelineStage> {
    // Verify pipeline exists
    await this.getPipelineById(pipelineId);
    
    // Generate slug from name if not provided
    const slug = data.slug || this.generateSlug(data.name);
    
    // Check if slug already exists in this pipeline
    const existingStage = await db.queryOne<PipelineStage>(
      'SELECT * FROM pipeline_stages WHERE pipeline_id = $1 AND slug = $2',
      [pipelineId, slug]
    );
    if (existingStage) {
      throw new ConflictError(`Stage with slug '${slug}' already exists in this pipeline`);
    }
    
    // Get max position if not provided
    let position = data.position;
    if (position === undefined) {
      const maxPos = await db.queryOne<{ max_pos: string | null }>(
        'SELECT MAX(position) as max_pos FROM pipeline_stages WHERE pipeline_id = $1',
        [pipelineId]
      );
      position = (maxPos?.max_pos ? parseInt(maxPos.max_pos, 10) : 0) + 1;
    } else {
      // Check if position conflicts
      const positionConflict = await db.queryOne<PipelineStage>(
        'SELECT * FROM pipeline_stages WHERE pipeline_id = $1 AND position = $2',
        [pipelineId, position]
      );
      if (positionConflict) {
        // Shift existing stages to make room
        await db.execute(
          'UPDATE pipeline_stages SET position = position + 1 WHERE pipeline_id = $1 AND position >= $2',
          [pipelineId, position]
        );
      }
    }
    
    const stage = await db.queryOne<PipelineStage>(
      `INSERT INTO pipeline_stages (pipeline_id, slug, name, position, color, stage_type, automation_config)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        pipelineId,
        slug,
        data.name,
        position,
        data.color || null,
        data.stage_type || null,
        JSON.stringify(data.automation_config || [])
      ]
    );
    
    if (!stage) {
      throw new Error('Failed to create stage');
    }
    
    return stage;
  }

  // ===========================================================================
  // Update Stage
  // ===========================================================================
  
  async updateStage(stageId: string, data: {
    name?: string;
    slug?: string;
    color?: string | null;
    stage_type?: string | null;
    automation_config?: Record<string, unknown>[];
  }): Promise<PipelineStage> {
    // Verify stage exists
    const existingStage = await this.getStageById(stageId);
    
    // If changing slug, check it doesn't conflict in the same pipeline
    if (data.slug && data.slug !== existingStage.slug) {
      const slugConflict = await db.queryOne<PipelineStage>(
        'SELECT * FROM pipeline_stages WHERE pipeline_id = $1 AND slug = $2 AND id != $3',
        [existingStage.pipeline_id, data.slug, stageId]
      );
      if (slugConflict) {
        throw new ConflictError(`Stage with slug '${data.slug}' already exists in this pipeline`);
      }
    }
    
    // Build dynamic update query
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;
    
    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.slug !== undefined) {
      updates.push(`slug = $${paramIndex++}`);
      values.push(data.slug);
    }
    if (data.color !== undefined) {
      updates.push(`color = $${paramIndex++}`);
      values.push(data.color);
    }
    if (data.stage_type !== undefined) {
      updates.push(`stage_type = $${paramIndex++}`);
      values.push(data.stage_type);
    }
    if (data.automation_config !== undefined) {
      updates.push(`automation_config = $${paramIndex++}`);
      values.push(JSON.stringify(data.automation_config));
    }
    
    if (updates.length === 0) {
      return existingStage;
    }
    
    values.push(stageId);
    
    const stage = await db.queryOne<PipelineStage>(
      `UPDATE pipeline_stages SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    if (!stage) {
      throw new Error('Failed to update stage');
    }
    
    return stage;
  }

  // ===========================================================================
  // Delete Stage
  // ===========================================================================
  
  async deleteStage(stageId: string): Promise<void> {
    // Verify stage exists
    const stage = await this.getStageById(stageId);
    
    // Check for active deals in this stage
    const dealCount = await db.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM deals WHERE stage_id = $1 AND status = $2',
      [stageId, 'open']
    );
    
    if (dealCount && parseInt(dealCount.count, 10) > 0) {
      throw new ConflictError(
        `Cannot delete stage: ${dealCount.count} open deals exist. Move them to another stage first.`,
        { open_deals: parseInt(dealCount.count, 10) }
      );
    }
    
    // Check minimum stages (pipeline should have at least 1 stage)
    const stageCount = await db.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM pipeline_stages WHERE pipeline_id = $1',
      [stage.pipeline_id]
    );
    
    if (stageCount && parseInt(stageCount.count, 10) <= 1) {
      throw new ValidationError('Cannot delete the last stage of a pipeline');
    }
    
    // Delete stage
    await db.execute('DELETE FROM pipeline_stages WHERE id = $1', [stageId]);
    
    // Reorder remaining stages to close gaps
    await db.execute(
      `UPDATE pipeline_stages 
       SET position = subquery.new_position 
       FROM (
         SELECT id, ROW_NUMBER() OVER (ORDER BY position) as new_position 
         FROM pipeline_stages 
         WHERE pipeline_id = $1
       ) as subquery 
       WHERE pipeline_stages.id = subquery.id`,
      [stage.pipeline_id]
    );
  }

  // ===========================================================================
  // Reorder Stages
  // ===========================================================================
  
  async reorderStages(pipelineId: string, stageIds: string[]): Promise<PipelineStage[]> {
    // Verify pipeline exists
    await this.getPipelineById(pipelineId);
    
    // Verify all stages belong to this pipeline
    const existingStages = await this.getPipelineStages(pipelineId);
    const existingIds = new Set(existingStages.map(s => s.id));
    
    // Check all provided stage IDs exist in this pipeline
    for (const stageId of stageIds) {
      if (!existingIds.has(stageId)) {
        throw new ValidationError(`Stage '${stageId}' does not belong to this pipeline`);
      }
    }
    
    // Check we have all stages (no missing stages)
    if (stageIds.length !== existingStages.length) {
      throw new ValidationError(
        `Expected ${existingStages.length} stages but received ${stageIds.length}. All stages must be included.`
      );
    }
    
    // Check for duplicates
    const uniqueIds = new Set(stageIds);
    if (uniqueIds.size !== stageIds.length) {
      throw new ValidationError('Duplicate stage IDs provided');
    }
    
    // Use transaction to update all positions
    await db.transaction(async (client) => {
      // First, set all positions to negative to avoid unique constraint violations
      await client.query(
        'UPDATE pipeline_stages SET position = -position WHERE pipeline_id = $1',
        [pipelineId]
      );
      
      // Then update each stage to its new position
      for (let i = 0; i < stageIds.length; i++) {
        await client.query(
          'UPDATE pipeline_stages SET position = $1 WHERE id = $2',
          [i + 1, stageIds[i]]
        );
      }
    });
    
    // Return updated stages
    return await this.getPipelineStages(pipelineId);
  }

  // ===========================================================================
  // Helper: Generate Slug
  // ===========================================================================
  
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[äöüß]/g, (char) => {
        const map: Record<string, string> = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
        return map[char] || char;
      })
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);
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
