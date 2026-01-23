// =============================================================================
// src/services/dealService.ts
// Deal Management Service
// =============================================================================

import { db } from '../db/index.js';
import { NotFoundError, ValidationError, ConflictError, BusinessLogicError } from '../errors/index.js';
import { getSyncQueue } from '../config/queues.js';
import { getPipelineService } from './pipelineService.js';
import { getAutomationEngine } from './automationEngine.js';
import type {
  Deal,
  DealStatus,
  Lead,
  PaginatedResponse,
  PipelineStage,
  SyncJob
} from '../types/index.js';

// =============================================================================
// Types
// =============================================================================

export interface CreateDealInput {
  lead_id: string;
  pipeline_id: string;
  stage_id?: string;
  name?: string;
  value?: number;
  currency?: string;
  expected_close_date?: string;
  assigned_to?: string;
  assigned_region?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateDealInput {
  name?: string;
  value?: number;
  currency?: string;
  expected_close_date?: string | null;
  assigned_to?: string | null;
  assigned_region?: string | null;
  metadata?: Record<string, unknown>;
}

export interface MoveDealInput {
  stage_id: string;
}

export interface ReorderDealsInput {
  stage_id: string;
  ordered_ids: string[];
}

export interface CloseDealInput {
  status: 'won' | 'lost';
  close_reason?: string;
}

export interface DealFiltersInput {
  pipeline_id?: string;
  stage_id?: string;
  lead_id?: string;
  status?: DealStatus;
  assigned_to?: string;
  min_value?: number;
  max_value?: number;
  created_after?: string;
  created_before?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface DealWithRelations extends Deal {
  lead?: Lead;
  pipeline_name?: string;
  stage_name?: string;
}

// =============================================================================
// Deal Service Class
// =============================================================================

export class DealService {
  private pipelineService = getPipelineService();

  // ===========================================================================
  // Create Deal
  // ===========================================================================
  
  async createDeal(data: CreateDealInput): Promise<Deal> {
    // Verify lead exists
    const lead = await db.queryOne<Lead>(
      'SELECT * FROM leads WHERE id = $1',
      [data.lead_id]
    );
    
    if (!lead) {
      throw new NotFoundError('Lead', data.lead_id);
    }
    
    // Verify pipeline exists and is active
    const pipeline = await this.pipelineService.getPipelineById(data.pipeline_id);
    if (!pipeline.is_active) {
      throw new ValidationError('Pipeline is not active');
    }
    
    // Get stage - either specified or first stage of pipeline
    let stageId = data.stage_id;
    if (!stageId) {
      const firstStage = await this.pipelineService.getFirstStage(data.pipeline_id);
      if (!firstStage) {
        throw new ValidationError('Pipeline has no stages');
      }
      stageId = firstStage.id;
    } else {
      // Verify stage belongs to pipeline
      const stage = await this.pipelineService.getStageById(stageId);
      if (stage.pipeline_id !== data.pipeline_id) {
        throw new ValidationError('Stage does not belong to specified pipeline');
      }
    }
    
    // Check for existing deal for this lead in this pipeline
    const existingDeal = await db.queryOne<Deal>(
      'SELECT * FROM deals WHERE lead_id = $1 AND pipeline_id = $2',
      [data.lead_id, data.pipeline_id]
    );
    
    if (existingDeal) {
      throw new ConflictError('Deal already exists for this lead in this pipeline', {
        existing_deal_id: existingDeal.id
      });
    }
    
    // Generate deal name if not provided
    const dealName = data.name || 
      `${lead.first_name || ''} ${lead.last_name || ''} - ${lead.email}`.trim();
    
    const positionResult = await db.queryOne<{ next_position: number }>(
      `SELECT COALESCE(MAX(position), 0) + 1 AS next_position
       FROM deals
       WHERE pipeline_id = $1 AND stage_id = $2`,
      [data.pipeline_id, stageId]
    );

    const position = positionResult?.next_position ?? 1;

    const sql = `
      INSERT INTO deals (
        lead_id, pipeline_id, stage_id, position, name, value, currency,
        expected_close_date, assigned_to, assigned_region,
        assigned_at, status, metadata, created_at, updated_at, stage_entered_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10,
        $11, 'open', $12, NOW(), NOW(), NOW()
      )
      RETURNING *
    `;
    
    const params = [
      data.lead_id,
      data.pipeline_id,
      stageId,
      position,
      dealName,
      data.value || null,
      data.currency || 'EUR',
      data.expected_close_date || null,
      data.assigned_to || null,
      data.assigned_region || null,
      data.assigned_to ? new Date().toISOString() : null,
      JSON.stringify(data.metadata || {})
    ];
    
    const deals = await db.query<Deal>(sql, params);
    return deals[0];
  }

  // ===========================================================================
  // Get Deal by ID
  // ===========================================================================
  
  async getDealById(id: string): Promise<Deal> {
    const deal = await db.queryOne<Deal>(
      'SELECT * FROM deals WHERE id = $1',
      [id]
    );
    
    if (!deal) {
      throw new NotFoundError('Deal', id);
    }
    
    return deal;
  }

  // ===========================================================================
  // Get Deal with Relations
  // ===========================================================================
  
  async getDealWithRelations(id: string): Promise<DealWithRelations> {
    const deal = await db.queryOne<DealWithRelations>(
      `SELECT 
        d.*,
        p.name as pipeline_name,
        ps.name as stage_name
       FROM deals d
       JOIN pipelines p ON p.id = d.pipeline_id
       JOIN pipeline_stages ps ON ps.id = d.stage_id
       WHERE d.id = $1`,
      [id]
    );
    
    if (!deal) {
      throw new NotFoundError('Deal', id);
    }
    
    return deal;
  }

  // ===========================================================================
  // Get Deals by Pipeline
  // ===========================================================================
  
  async getDealsByPipeline(
    pipelineId: string, 
    options?: { status?: DealStatus; limit?: number; offset?: number }
  ): Promise<Deal[]> {
    // Verify pipeline exists
    await this.pipelineService.getPipelineById(pipelineId);
    
    let sql = `
      SELECT d.*, ps.name as stage_name, ps.position as stage_position
      FROM deals d
      JOIN pipeline_stages ps ON ps.id = d.stage_id
      WHERE d.pipeline_id = $1
    `;
    const params: unknown[] = [pipelineId];
    let paramIndex = 2;
    
    if (options?.status) {
      sql += ` AND d.status = $${paramIndex++}`;
      params.push(options.status);
    }
    
    sql += ' ORDER BY ps.position ASC, d.position ASC, d.created_at DESC';
    
    if (options?.limit) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }
    
    if (options?.offset) {
      sql += ` OFFSET $${paramIndex}`;
      params.push(options.offset);
    }
    
    return await db.query<Deal>(sql, params);
  }

  // ===========================================================================
  // Get Deals by Lead
  // ===========================================================================
  
  async getDealsByLead(leadId: string): Promise<Deal[]> {
    return await db.query<Deal>(
      `SELECT d.*, p.name as pipeline_name, ps.name as stage_name
       FROM deals d
       JOIN pipelines p ON p.id = d.pipeline_id
       JOIN pipeline_stages ps ON ps.id = d.stage_id
       WHERE d.lead_id = $1
       ORDER BY d.created_at DESC`,
      [leadId]
    );
  }

  // ===========================================================================
  // Search Deals
  // ===========================================================================
  
  async searchDeals(filters: DealFiltersInput): Promise<PaginatedResponse<DealWithRelations>> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;
    
    if (filters.pipeline_id) {
      conditions.push(`d.pipeline_id = $${paramIndex++}`);
      params.push(filters.pipeline_id);
    }
    
    if (filters.stage_id) {
      conditions.push(`d.stage_id = $${paramIndex++}`);
      params.push(filters.stage_id);
    }
    
    if (filters.lead_id) {
      conditions.push(`d.lead_id = $${paramIndex++}`);
      params.push(filters.lead_id);
    }
    
    if (filters.status) {
      conditions.push(`d.status = $${paramIndex++}`);
      params.push(filters.status);
    }
    
    if (filters.assigned_to) {
      conditions.push(`d.assigned_to = $${paramIndex++}`);
      params.push(filters.assigned_to);
    }
    
    if (filters.min_value !== undefined) {
      conditions.push(`d.value >= $${paramIndex++}`);
      params.push(filters.min_value);
    }
    
    if (filters.max_value !== undefined) {
      conditions.push(`d.value <= $${paramIndex++}`);
      params.push(filters.max_value);
    }
    
    if (filters.created_after) {
      conditions.push(`d.created_at >= $${paramIndex++}`);
      params.push(filters.created_after);
    }
    
    if (filters.created_before) {
      conditions.push(`d.created_at <= $${paramIndex++}`);
      params.push(filters.created_before);
    }
    
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';
    
    // Count total
    const countSql = `SELECT COUNT(*) as count FROM deals d ${whereClause}`;
    const countResult = await db.queryOne<{ count: string }>(countSql, params);
    const total = parseInt(countResult?.count || '0', 10);
    
    // Calculate pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);
    
    // Build order clause
    const validSortColumns = ['created_at', 'updated_at', 'value', 'name', 'stage_entered_at', 'position'];
    const sortBy = validSortColumns.includes(filters.sort_by || '') ? filters.sort_by : 'created_at';
    const sortOrder = (filters.sort_order || 'desc').toUpperCase();
    const orderClause = `ORDER BY d.${sortBy} ${sortOrder} NULLS LAST`;
    
    // Get data with relations
    const dataSql = `
      SELECT 
        d.*,
        p.name as pipeline_name,
        ps.name as stage_name
      FROM deals d
      JOIN pipelines p ON p.id = d.pipeline_id
      JOIN pipeline_stages ps ON ps.id = d.stage_id
      ${whereClause}
      ${orderClause}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    
    const dataParams = [...params, limit, offset];
    const data = await db.query<DealWithRelations>(dataSql, dataParams);
    
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    };
  }

  // ===========================================================================
  // Update Deal
  // ===========================================================================
  
  async updateDeal(id: string, data: UpdateDealInput): Promise<Deal> {
    // Check if deal exists
    await this.getDealById(id);
    
    // Build dynamic update query
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;
    
    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(data.name);
    }
    
    if (data.value !== undefined) {
      updates.push(`value = $${paramIndex++}`);
      params.push(data.value);
    }
    
    if (data.currency !== undefined) {
      updates.push(`currency = $${paramIndex++}`);
      params.push(data.currency);
    }
    
    if (data.expected_close_date !== undefined) {
      updates.push(`expected_close_date = $${paramIndex++}`);
      params.push(data.expected_close_date);
    }
    
    if (data.assigned_to !== undefined) {
      updates.push(`assigned_to = $${paramIndex++}`);
      params.push(data.assigned_to);
      if (data.assigned_to) {
        updates.push(`assigned_at = NOW()`);
      }
    }
    
    if (data.assigned_region !== undefined) {
      updates.push(`assigned_region = $${paramIndex++}`);
      params.push(data.assigned_region);
    }
    
    if (data.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      params.push(JSON.stringify(data.metadata));
    }
    
    if (updates.length === 0) {
      return this.getDealById(id);
    }
    
    params.push(id);
    
    const sql = `
      UPDATE deals 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const deals = await db.query<Deal>(sql, params);
    return deals[0];
  }

  // ===========================================================================
  // Move Deal to Stage
  // ===========================================================================
  
  async moveDealToStage(id: string, data: MoveDealInput): Promise<Deal> {
    const deal = await this.getDealById(id);
    
    // Cannot move closed deals
    if (deal.status !== 'open') {
      throw new BusinessLogicError('Cannot move a closed deal', {
        current_status: deal.status
      });
    }
    
    // Get current stage for automation
    let fromStage: PipelineStage | null = null;
    try {
      fromStage = await this.pipelineService.getStageById(deal.stage_id);
    } catch {
      // Stage might not exist anymore
    }
    
    // Verify new stage exists and belongs to same pipeline
    const newStage = await this.pipelineService.getStageById(data.stage_id);
    if (newStage.pipeline_id !== deal.pipeline_id) {
      throw new ValidationError('Target stage does not belong to the deal\'s pipeline');
    }
    
    const positionResult = await db.queryOne<{ next_position: number }>(
      `SELECT COALESCE(MAX(position), 0) + 1 AS next_position
       FROM deals
       WHERE pipeline_id = $1 AND stage_id = $2`,
      [deal.pipeline_id, data.stage_id]
    );
    const position = positionResult?.next_position ?? 1;

    // Update deal with new stage
    const updatedDeal = await db.queryOne<Deal>(
      `UPDATE deals 
       SET stage_id = $1, position = $2, stage_entered_at = NOW(), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [data.stage_id, position, id]
    );
    
    // Process stage change automation
    try {
      const automationEngine = getAutomationEngine();
      await automationEngine.processStageChange(updatedDeal!, fromStage, newStage);
    } catch (automationError) {
      console.error('[Deal Service] Automation error on stage change:', automationError);
      // Don't fail the stage move if automation fails
    }
    
    return updatedDeal!;
  }

  // ===========================================================================
  // Reorder Deals within a Stage
  // ===========================================================================
  
  async reorderDealsInStage(data: ReorderDealsInput): Promise<void> {
    if (!data.ordered_ids.length) {
      return;
    }

    const existing = await db.query<{ id: string }>(
      `SELECT id FROM deals WHERE stage_id = $1 AND id = ANY($2::uuid[])`,
      [data.stage_id, data.ordered_ids]
    );

    if (existing.length !== data.ordered_ids.length) {
      throw new ValidationError('One or more deals do not belong to the target stage');
    }

    const values: string[] = [];
    const params: unknown[] = [data.stage_id];
    let paramIndex = 2;

    data.ordered_ids.forEach((id, index) => {
      values.push(`($${paramIndex++}::uuid, $${paramIndex++}::int)`);
      params.push(id, index + 1);
    });

    const sql = `
      UPDATE deals AS d
      SET position = v.position, updated_at = NOW()
      FROM (VALUES ${values.join(', ')}) AS v(id, position)
      WHERE d.id = v.id AND d.stage_id = $1
    `;

    await db.execute(sql, params);
  }

  // ===========================================================================
  // Close Deal
  // ===========================================================================
  
  async closeDeal(id: string, data: CloseDealInput): Promise<Deal> {
    const deal = await this.getDealById(id);
    
    // Cannot close already closed deals
    if (deal.status !== 'open') {
      throw new BusinessLogicError('Deal is already closed', {
        current_status: deal.status
      });
    }
    
    // Update deal status
    const updatedDeal = await db.queryOne<Deal>(
      `UPDATE deals 
       SET status = $1, close_reason = $2, closed_at = NOW(), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [data.status, data.close_reason || null, id]
    );
    
    // If deal is won, queue Moco sync job
    if (data.status === 'won') {
      await this.queueMocoSync(deal);
    }
    
    // Update lead lifecycle stage if won
    if (data.status === 'won') {
      await db.execute(
        `UPDATE leads 
         SET lifecycle_stage = 'customer', status = 'customer', updated_at = NOW()
         WHERE id = $1`,
        [deal.lead_id]
      );
    }
    
    return updatedDeal!;
  }

  // ===========================================================================
  // Reopen Deal
  // ===========================================================================
  
  async reopenDeal(id: string): Promise<Deal> {
    const deal = await this.getDealById(id);
    
    if (deal.status === 'open') {
      throw new BusinessLogicError('Deal is already open');
    }
    
    const updatedDeal = await db.queryOne<Deal>(
      `UPDATE deals 
       SET status = 'open', close_reason = NULL, closed_at = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    
    return updatedDeal!;
  }

  // ===========================================================================
  // Delete Deal
  // ===========================================================================
  
  async deleteDeal(id: string): Promise<void> {
    await this.getDealById(id);
    await db.execute('DELETE FROM deals WHERE id = $1', [id]);
  }

  // ===========================================================================
  // Get Deals Count by Status
  // ===========================================================================
  
  async getDealCountsByStatus(pipelineId?: string): Promise<Record<DealStatus, number>> {
    let sql = `SELECT status, COUNT(*) as count FROM deals`;
    const params: unknown[] = [];
    
    if (pipelineId) {
      sql += ' WHERE pipeline_id = $1';
      params.push(pipelineId);
    }
    
    sql += ' GROUP BY status';
    
    const results = await db.query<{ status: DealStatus; count: string }>(sql, params);
    
    return results.reduce((acc, row) => {
      acc[row.status] = parseInt(row.count, 10);
      return acc;
    }, { open: 0, won: 0, lost: 0 } as Record<DealStatus, number>);
  }

  // ===========================================================================
  // Assign Deal to Team Member
  // ===========================================================================
  
  async assignDeal(id: string, assignedTo: string, assignedRegion?: string): Promise<Deal> {
    // Verify deal exists
    await this.getDealById(id);
    
    const updatedDeal = await db.queryOne<Deal>(
      `UPDATE deals 
       SET assigned_to = $1, assigned_region = $2, assigned_at = NOW(), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [assignedTo, assignedRegion || null, id]
    );
    
    return updatedDeal!;
  }

  // ===========================================================================
  // Queue Moco Sync
  // ===========================================================================
  
  private async queueMocoSync(deal: Deal): Promise<void> {
    const syncQueue = getSyncQueue();
    
    // First, sync the customer (organization/lead)
    const customerJob: SyncJob = {
      entity_type: 'lead',
      entity_id: deal.lead_id,
      target: 'moco',
      action: 'create_customer'
    };
    
    await syncQueue.add('moco-customer-sync', customerJob, {
      priority: 1,
      delay: 0
    });
    
    // Then, create the offer
    const offerJob: SyncJob = {
      entity_type: 'deal',
      entity_id: deal.id,
      target: 'moco',
      action: 'create_offer'
    };
    
    await syncQueue.add('moco-offer-sync', offerJob, {
      priority: 2,
      delay: 5000 // Wait 5 seconds for customer to be created
    });
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let dealServiceInstance: DealService | null = null;

export function getDealService(): DealService {
  if (!dealServiceInstance) {
    dealServiceInstance = new DealService();
  }
  return dealServiceInstance;
}

export const dealService = {
  get instance() {
    return getDealService();
  }
};

export default dealService;
