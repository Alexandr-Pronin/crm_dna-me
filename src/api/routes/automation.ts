// =============================================================================
// src/api/routes/automation.ts
// Automation Rules CRUD API Routes
// =============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { getAutomationEngine } from '../../services/automationEngine.js';
import { NotFoundError, ValidationError } from '../../errors/index.js';
import type { AutomationRule } from '../../types/index.js';

// =============================================================================
// Validation Schemas
// =============================================================================

const triggerTypeEnum = z.enum([
  'event',
  'score_threshold',
  'intent_detected',
  'time_in_stage',
  'stage_change'
]);

const actionTypeEnum = z.enum([
  'move_to_stage',
  'assign_owner',
  'send_notification',
  'create_task',
  'sync_moco',
  'update_field',
  'route_to_pipeline'
]);

const createRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
  priority: z.number().int().default(100),
  pipeline_id: z.string().uuid().optional(),
  stage_id: z.string().uuid().optional(),
  trigger_type: triggerTypeEnum,
  trigger_config: z.record(z.unknown()),
  action_type: actionTypeEnum,
  action_config: z.record(z.unknown())
});

const updateRuleSchema = createRuleSchema.partial();

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  trigger_type: triggerTypeEnum.optional(),
  action_type: actionTypeEnum.optional(),
  is_active: z.coerce.boolean().optional(),
  pipeline_id: z.string().uuid().optional()
});

// =============================================================================
// Routes
// =============================================================================

export async function automationRoutes(fastify: FastifyInstance): Promise<void> {
  const automationEngine = getAutomationEngine();

  // ===========================================================================
  // GET /automation/rules - List all automation rules
  // ===========================================================================
  fastify.get('/automation/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = paginationSchema.parse(request.query);
    const { page, limit, trigger_type, action_type, is_active, pipeline_id } = query;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (trigger_type) {
      conditions.push(`trigger_type = $${paramIndex++}`);
      params.push(trigger_type);
    }

    if (action_type) {
      conditions.push(`action_type = $${paramIndex++}`);
      params.push(action_type);
    }

    if (is_active !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    if (pipeline_id) {
      conditions.push(`pipeline_id = $${paramIndex++}`);
      params.push(pipeline_id);
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';

    // Get total count
    const countResult = await db.queryOne<{ count: number }>(`
      SELECT COUNT(*)::int as count FROM automation_rules ${whereClause}
    `, params);
    const total = countResult?.count ?? 0;

    // Get rules with related pipeline/stage info
    const rules = await db.query<AutomationRule & { 
      pipeline_name?: string; 
      stage_name?: string;
    }>(`
      SELECT 
        ar.*,
        p.name as pipeline_name,
        ps.name as stage_name
      FROM automation_rules ar
      LEFT JOIN pipelines p ON ar.pipeline_id = p.id
      LEFT JOIN pipeline_stages ps ON ar.stage_id = ps.id
      ${whereClause}
      ORDER BY ar.priority ASC, ar.created_at ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, [...params, limit, offset]);

    return {
      data: rules,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_prev: page > 1
      }
    };
  });

  // ===========================================================================
  // GET /automation/rules/:id - Get single rule
  // ===========================================================================
  fastify.get('/automation/rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const rule = await db.queryOne<AutomationRule & { 
      pipeline_name?: string; 
      stage_name?: string;
    }>(`
      SELECT 
        ar.*,
        p.name as pipeline_name,
        ps.name as stage_name
      FROM automation_rules ar
      LEFT JOIN pipelines p ON ar.pipeline_id = p.id
      LEFT JOIN pipeline_stages ps ON ar.stage_id = ps.id
      WHERE ar.id = $1
    `, [id]);

    if (!rule) {
      throw new NotFoundError(`Automation rule with ID ${id} not found`);
    }

    // Get execution statistics
    const stats = await db.queryOne<{ 
      total_executions: number;
      successful_executions: number;
      failed_executions: number;
      unique_leads: number;
      last_7_days: number;
    }>(`
      SELECT 
        COUNT(*)::int as total_executions,
        COUNT(*) FILTER (WHERE success = TRUE)::int as successful_executions,
        COUNT(*) FILTER (WHERE success = FALSE)::int as failed_executions,
        COUNT(DISTINCT lead_id)::int as unique_leads,
        COUNT(*) FILTER (WHERE executed_at > NOW() - INTERVAL '7 days')::int as last_7_days
      FROM automation_logs
      WHERE rule_id = $1
    `, [id]);

    return {
      ...rule,
      stats: stats || { 
        total_executions: 0, 
        successful_executions: 0, 
        failed_executions: 0, 
        unique_leads: 0,
        last_7_days: 0
      }
    };
  });

  // ===========================================================================
  // POST /automation/rules - Create new rule
  // ===========================================================================
  fastify.post('/automation/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createRuleSchema.parse(request.body);

    // Validate pipeline_id if provided
    if (data.pipeline_id) {
      const pipeline = await db.queryOne<{ id: string }>(`
        SELECT id FROM pipelines WHERE id = $1
      `, [data.pipeline_id]);

      if (!pipeline) {
        throw new ValidationError(`Pipeline with ID "${data.pipeline_id}" not found`);
      }
    }

    // Validate stage_id if provided
    if (data.stage_id) {
      const stage = await db.queryOne<{ id: string; pipeline_id: string }>(`
        SELECT id, pipeline_id FROM pipeline_stages WHERE id = $1
      `, [data.stage_id]);

      if (!stage) {
        throw new ValidationError(`Pipeline stage with ID "${data.stage_id}" not found`);
      }

      // If pipeline_id is also provided, ensure stage belongs to that pipeline
      if (data.pipeline_id && stage.pipeline_id !== data.pipeline_id) {
        throw new ValidationError('Stage does not belong to the specified pipeline');
      }
    }

    const rule = await db.queryOne<AutomationRule>(`
      INSERT INTO automation_rules (
        name, description, is_active, priority,
        pipeline_id, stage_id, trigger_type, trigger_config,
        action_type, action_config
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      data.name,
      data.description || null,
      data.is_active,
      data.priority,
      data.pipeline_id || null,
      data.stage_id || null,
      data.trigger_type,
      JSON.stringify(data.trigger_config),
      data.action_type,
      JSON.stringify(data.action_config)
    ]);

    // Reload rules in automation engine
    await automationEngine.loadRules();

    reply.code(201);
    return rule;
  });

  // ===========================================================================
  // PATCH /automation/rules/:id - Update rule
  // ===========================================================================
  fastify.patch('/automation/rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = updateRuleSchema.parse(request.body);

    // Check if rule exists
    const existing = await db.queryOne<AutomationRule>(`
      SELECT * FROM automation_rules WHERE id = $1
    `, [id]);

    if (!existing) {
      throw new NotFoundError(`Automation rule with ID ${id} not found`);
    }

    // Validate pipeline_id if provided
    if (data.pipeline_id) {
      const pipeline = await db.queryOne<{ id: string }>(`
        SELECT id FROM pipelines WHERE id = $1
      `, [data.pipeline_id]);

      if (!pipeline) {
        throw new ValidationError(`Pipeline with ID "${data.pipeline_id}" not found`);
      }
    }

    // Validate stage_id if provided
    if (data.stage_id) {
      const stage = await db.queryOne<{ id: string; pipeline_id: string }>(`
        SELECT id, pipeline_id FROM pipeline_stages WHERE id = $1
      `, [data.stage_id]);

      if (!stage) {
        throw new ValidationError(`Pipeline stage with ID "${data.stage_id}" not found`);
      }

      // If pipeline_id is provided (either in update or existing), ensure stage belongs to that pipeline
      const pipelineId = data.pipeline_id ?? existing.pipeline_id;
      if (pipelineId && stage.pipeline_id !== pipelineId) {
        throw new ValidationError('Stage does not belong to the specified pipeline');
      }
    }

    // Build update query
    const updates: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(data.is_active);
    }
    if (data.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      values.push(data.priority);
    }
    if (data.pipeline_id !== undefined) {
      updates.push(`pipeline_id = $${paramIndex++}`);
      values.push(data.pipeline_id);
    }
    if (data.stage_id !== undefined) {
      updates.push(`stage_id = $${paramIndex++}`);
      values.push(data.stage_id);
    }
    if (data.trigger_type !== undefined) {
      updates.push(`trigger_type = $${paramIndex++}`);
      values.push(data.trigger_type);
    }
    if (data.trigger_config !== undefined) {
      updates.push(`trigger_config = $${paramIndex++}`);
      values.push(JSON.stringify(data.trigger_config));
    }
    if (data.action_type !== undefined) {
      updates.push(`action_type = $${paramIndex++}`);
      values.push(data.action_type);
    }
    if (data.action_config !== undefined) {
      updates.push(`action_config = $${paramIndex++}`);
      values.push(JSON.stringify(data.action_config));
    }

    values.push(id);

    const rule = await db.queryOne<AutomationRule>(`
      UPDATE automation_rules SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    // Reload rules in automation engine
    await automationEngine.loadRules();

    return rule;
  });

  // ===========================================================================
  // DELETE /automation/rules/:id - Delete rule
  // ===========================================================================
  fastify.delete('/automation/rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    // Check if rule exists first
    const existing = await db.queryOne<{ id: string }>(`
      SELECT id FROM automation_rules WHERE id = $1
    `, [id]);

    if (!existing) {
      throw new NotFoundError(`Automation rule with ID ${id} not found`);
    }

    // Delete automation logs for this rule first (or they'll be orphaned)
    await db.execute(`
      DELETE FROM automation_logs WHERE rule_id = $1
    `, [id]);

    // Delete the rule
    await db.execute(`
      DELETE FROM automation_rules WHERE id = $1
    `, [id]);

    // Reload rules in automation engine
    await automationEngine.loadRules();

    reply.code(204);
    return null;
  });

  // ===========================================================================
  // GET /automation/rules/:id/logs - Get execution logs for a rule
  // ===========================================================================
  fastify.get('/automation/rules/:id/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };
    const offset = (page - 1) * limit;

    // Check if rule exists
    const rule = await db.queryOne<{ id: string }>(`
      SELECT id FROM automation_rules WHERE id = $1
    `, [id]);

    if (!rule) {
      throw new NotFoundError(`Automation rule with ID ${id} not found`);
    }

    // Get total count
    const countResult = await db.queryOne<{ count: number }>(`
      SELECT COUNT(*)::int as count FROM automation_logs WHERE rule_id = $1
    `, [id]);
    const total = countResult?.count ?? 0;

    // Get logs with lead info
    const logs = await db.query<{
      id: string;
      lead_id: string;
      deal_id?: string;
      trigger_data: Record<string, unknown>;
      action_result: Record<string, unknown>;
      success: boolean;
      error_message?: string;
      executed_at: Date;
      lead_email?: string;
      lead_name?: string;
    }>(`
      SELECT 
        al.*,
        l.email as lead_email,
        CONCAT(l.first_name, ' ', l.last_name) as lead_name
      FROM automation_logs al
      LEFT JOIN leads l ON al.lead_id = l.id
      WHERE al.rule_id = $1
      ORDER BY al.executed_at DESC
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_prev: page > 1
      }
    };
  });

  // ===========================================================================
  // GET /automation/stats - Get overall automation statistics
  // ===========================================================================
  fastify.get('/automation/stats', async () => {
    // Rules stats
    const rulesStats = await db.queryOne<{
      total_rules: number;
      active_rules: number;
    }>(`
      SELECT 
        COUNT(*)::int as total_rules,
        COUNT(*) FILTER (WHERE is_active = TRUE)::int as active_rules
      FROM automation_rules
    `);

    // Breakdown by trigger type
    const triggerBreakdown = await db.query<{ trigger_type: string; count: number }>(`
      SELECT trigger_type, COUNT(*)::int as count 
      FROM automation_rules 
      GROUP BY trigger_type
    `);
    
    const rules_by_trigger = triggerBreakdown.reduce((acc, row) => {
      acc[row.trigger_type] = row.count;
      return acc;
    }, {} as Record<string, number>);

    // Breakdown by action type
    const actionBreakdown = await db.query<{ action_type: string; count: number }>(`
      SELECT action_type, COUNT(*)::int as count 
      FROM automation_rules 
      GROUP BY action_type
    `);
    
    const rules_by_action = actionBreakdown.reduce((acc, row) => {
      acc[row.action_type] = row.count;
      return acc;
    }, {} as Record<string, number>);

    // Execution stats
    const executionStats = await db.queryOne<{
      total_executions: number;
      successful_executions: number;
      failed_executions: number;
      executions_today: number;
      executions_7_days: number;
    }>(`
      SELECT 
        COUNT(*)::int as total_executions,
        COUNT(*) FILTER (WHERE success = TRUE)::int as successful_executions,
        COUNT(*) FILTER (WHERE success = FALSE)::int as failed_executions,
        COUNT(*) FILTER (WHERE executed_at > NOW() - INTERVAL '1 day')::int as executions_today,
        COUNT(*) FILTER (WHERE executed_at > NOW() - INTERVAL '7 days')::int as executions_7_days
      FROM automation_logs
    `);

    // Top performing rules (by execution count in last 7 days)
    const topRules = await db.query<{
      rule_id: string;
      rule_name: string;
      executions: number;
      success_rate: number;
    }>(`
      SELECT 
        ar.id as rule_id,
        ar.name as rule_name,
        COUNT(*)::int as executions,
        ROUND(AVG(CASE WHEN al.success THEN 100 ELSE 0 END)::numeric, 1) as success_rate
      FROM automation_logs al
      JOIN automation_rules ar ON al.rule_id = ar.id
      WHERE al.executed_at > NOW() - INTERVAL '7 days'
      GROUP BY ar.id, ar.name
      ORDER BY executions DESC
      LIMIT 10
    `);

    return {
      rules: {
        total: rulesStats?.total_rules ?? 0,
        active: rulesStats?.active_rules ?? 0,
        by_trigger_type: rules_by_trigger,
        by_action_type: rules_by_action
      },
      executions: executionStats || {
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        executions_today: 0,
        executions_7_days: 0
      },
      top_rules_7d: topRules
    };
  });
}

export default automationRoutes;
