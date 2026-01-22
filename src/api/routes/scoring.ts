// =============================================================================
// src/api/routes/scoring.ts
// Scoring Rules and Score Management API Routes
// =============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { getScoringEngine } from '../../services/scoringEngine.js';
import { SCORE_THRESHOLDS, getScoreTier } from '../../config/scoringRules.js';
import { NotFoundError, ValidationError } from '../../errors/index.js';
import type { ScoringRule, ScoreHistory, Lead } from '../../types/index.js';

// =============================================================================
// Validation Schemas
// =============================================================================

const createRuleSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  rule_type: z.enum(['event', 'field', 'threshold']),
  category: z.enum(['demographic', 'engagement', 'behavior']),
  conditions: z.object({
    event_type: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
    field: z.string().optional(),
    operator: z.enum(['equals', 'in', 'contains', 'gte', 'lte', 'pattern']).optional(),
    value: z.unknown().optional()
  }),
  points: z.number().int(),
  max_per_day: z.number().int().positive().optional(),
  max_per_lead: z.number().int().positive().optional(),
  decay_days: z.number().int().positive().optional(),
  priority: z.number().int().default(100),
  is_active: z.boolean().default(true)
});

const updateRuleSchema = createRuleSchema.partial().omit({ slug: true });

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.enum(['demographic', 'engagement', 'behavior']).optional(),
  is_active: z.coerce.boolean().optional()
});

// =============================================================================
// Routes
// =============================================================================

export async function scoringRoutes(fastify: FastifyInstance): Promise<void> {
  const scoringEngine = getScoringEngine();

  // ===========================================================================
  // GET /scoring/rules - List all scoring rules
  // ===========================================================================
  fastify.get('/scoring/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = paginationSchema.parse(request.query);
    const { page, limit, category, is_active } = query;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(category);
    }

    if (is_active !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';

    // Get total count
    const countResult = await db.queryOne<{ count: number }>(`
      SELECT COUNT(*)::int as count FROM scoring_rules ${whereClause}
    `, params);
    const total = countResult?.count ?? 0;

    // Get rules
    const rules = await db.query<ScoringRule>(`
      SELECT * FROM scoring_rules 
      ${whereClause}
      ORDER BY priority ASC, category ASC, created_at ASC
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
  // GET /scoring/rules/:id - Get single rule
  // ===========================================================================
  fastify.get('/scoring/rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const rule = await db.queryOne<ScoringRule>(`
      SELECT * FROM scoring_rules WHERE id = $1
    `, [id]);

    if (!rule) {
      throw new NotFoundError(`Scoring rule with ID ${id} not found`);
    }

    // Get usage statistics
    const stats = await db.queryOne<{ 
      total_applications: number; 
      unique_leads: number;
      total_points: number;
    }>(`
      SELECT 
        COUNT(*)::int as total_applications,
        COUNT(DISTINCT lead_id)::int as unique_leads,
        COALESCE(SUM(points_change), 0)::int as total_points
      FROM score_history
      WHERE rule_id = $1
    `, [id]);

    return {
      ...rule,
      stats: stats || { total_applications: 0, unique_leads: 0, total_points: 0 }
    };
  });

  // ===========================================================================
  // POST /scoring/rules - Create new rule
  // ===========================================================================
  fastify.post('/scoring/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createRuleSchema.parse(request.body);

    // Check if slug already exists
    const existing = await db.queryOne<{ id: string }>(`
      SELECT id FROM scoring_rules WHERE slug = $1
    `, [data.slug]);

    if (existing) {
      throw new ValidationError(`Rule with slug "${data.slug}" already exists`);
    }

    const rule = await db.queryOne<ScoringRule>(`
      INSERT INTO scoring_rules (
        slug, name, description, is_active, priority,
        rule_type, category, conditions, points,
        max_per_day, max_per_lead, decay_days
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      data.slug,
      data.name,
      data.description || null,
      data.is_active,
      data.priority,
      data.rule_type,
      data.category,
      JSON.stringify(data.conditions),
      data.points,
      data.max_per_day ?? null,
      data.max_per_lead ?? null,
      data.decay_days ?? null
    ]);

    // Reload rules in scoring engine
    await scoringEngine.loadRules();

    reply.code(201);
    return rule;
  });

  // ===========================================================================
  // PATCH /scoring/rules/:id - Update rule
  // ===========================================================================
  fastify.patch('/scoring/rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = updateRuleSchema.parse(request.body);

    // Check if rule exists
    const existing = await db.queryOne<ScoringRule>(`
      SELECT * FROM scoring_rules WHERE id = $1
    `, [id]);

    if (!existing) {
      throw new NotFoundError(`Scoring rule with ID ${id} not found`);
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
    if (data.rule_type !== undefined) {
      updates.push(`rule_type = $${paramIndex++}`);
      values.push(data.rule_type);
    }
    if (data.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(data.category);
    }
    if (data.conditions !== undefined) {
      updates.push(`conditions = $${paramIndex++}`);
      values.push(JSON.stringify(data.conditions));
    }
    if (data.points !== undefined) {
      updates.push(`points = $${paramIndex++}`);
      values.push(data.points);
    }
    if (data.max_per_day !== undefined) {
      updates.push(`max_per_day = $${paramIndex++}`);
      values.push(data.max_per_day);
    }
    if (data.max_per_lead !== undefined) {
      updates.push(`max_per_lead = $${paramIndex++}`);
      values.push(data.max_per_lead);
    }
    if (data.decay_days !== undefined) {
      updates.push(`decay_days = $${paramIndex++}`);
      values.push(data.decay_days);
    }

    values.push(id);

    const rule = await db.queryOne<ScoringRule>(`
      UPDATE scoring_rules SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    // Reload rules in scoring engine
    await scoringEngine.loadRules();

    return rule;
  });

  // ===========================================================================
  // DELETE /scoring/rules/:id - Delete rule
  // ===========================================================================
  fastify.delete('/scoring/rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const result = await db.execute(`
      DELETE FROM scoring_rules WHERE id = $1
    `, [id]);

    if (result === 0) {
      throw new NotFoundError(`Scoring rule with ID ${id} not found`);
    }

    // Reload rules in scoring engine
    await scoringEngine.loadRules();

    reply.code(204);
    return null;
  });

  // ===========================================================================
  // GET /scoring/thresholds - Get score thresholds config
  // ===========================================================================
  fastify.get('/scoring/thresholds', async () => {
    return {
      thresholds: SCORE_THRESHOLDS,
      tiers: [
        { name: 'cold', min: 0, max: SCORE_THRESHOLDS.WARM - 1, description: 'Nurture required' },
        { name: 'warm', min: SCORE_THRESHOLDS.WARM, max: SCORE_THRESHOLDS.HOT - 1, description: 'MQL - Consider routing' },
        { name: 'hot', min: SCORE_THRESHOLDS.HOT, max: SCORE_THRESHOLDS.VERY_HOT - 1, description: 'SQL - High priority' },
        { name: 'very_hot', min: SCORE_THRESHOLDS.VERY_HOT, max: null, description: 'Immediate contact required' }
      ]
    };
  });

  // ===========================================================================
  // GET /scoring/leads/:leadId/history - Get lead's score history
  // ===========================================================================
  fastify.get('/scoring/leads/:leadId/history', async (request: FastifyRequest, reply: FastifyReply) => {
    const { leadId } = request.params as { leadId: string };
    const { limit = 50 } = request.query as { limit?: number };

    // Verify lead exists
    const lead = await db.queryOne<{ id: string }>(`
      SELECT id FROM leads WHERE id = $1
    `, [leadId]);

    if (!lead) {
      throw new NotFoundError(`Lead with ID ${leadId} not found`);
    }

    const history = await scoringEngine.getScoreHistory(leadId, limit);

    return { data: history };
  });

  // ===========================================================================
  // GET /scoring/leads/:leadId/breakdown - Get lead's score breakdown
  // ===========================================================================
  fastify.get('/scoring/leads/:leadId/breakdown', async (request: FastifyRequest, reply: FastifyReply) => {
    const { leadId } = request.params as { leadId: string };

    // Verify lead exists
    const lead = await db.queryOne<Lead>(`
      SELECT * FROM leads WHERE id = $1
    `, [leadId]);

    if (!lead) {
      throw new NotFoundError(`Lead with ID ${leadId} not found`);
    }

    const breakdown = await scoringEngine.getScoreBreakdown(leadId);

    return {
      lead_id: leadId,
      email: lead.email,
      score_tier: getScoreTier(breakdown.total),
      ...breakdown
    };
  });

  // ===========================================================================
  // POST /scoring/leads/:leadId/recalculate - Recalculate lead scores
  // ===========================================================================
  fastify.post('/scoring/leads/:leadId/recalculate', async (request: FastifyRequest, reply: FastifyReply) => {
    const { leadId } = request.params as { leadId: string };

    // Verify lead exists
    const lead = await db.queryOne<{ id: string; total_score: number }>(`
      SELECT id, total_score FROM leads WHERE id = $1
    `, [leadId]);

    if (!lead) {
      throw new NotFoundError(`Lead with ID ${leadId} not found`);
    }

    const oldScore = lead.total_score;
    const newScores = await scoringEngine.recalculateScores(leadId);

    return {
      lead_id: leadId,
      old_score: oldScore,
      new_scores: newScores,
      score_tier: getScoreTier(newScores.total),
      changed: oldScore !== newScores.total
    };
  });

  // ===========================================================================
  // GET /scoring/stats - Get overall scoring statistics
  // ===========================================================================
  fastify.get('/scoring/stats', async () => {
    // Rules stats - separate queries for clarity
    const rulesCounts = await db.queryOne<{
      total_rules: number;
      active_rules: number;
    }>(`
      SELECT 
        COUNT(*)::int as total_rules,
        COUNT(*) FILTER (WHERE is_active = TRUE)::int as active_rules
      FROM scoring_rules
    `);

    const categoryBreakdown = await db.query<{ category: string; count: number }>(`
      SELECT category, COUNT(*)::int as count 
      FROM scoring_rules 
      GROUP BY category
    `);
    
    const rules_by_category = categoryBreakdown.reduce((acc, row) => {
      acc[row.category] = row.count;
      return acc;
    }, {} as Record<string, number>);

    const rulesStats = {
      total_rules: rulesCounts?.total_rules ?? 0,
      active_rules: rulesCounts?.active_rules ?? 0,
      rules_by_category
    };

    // Score history stats
    const historyStats = await db.queryOne<{
      total_entries: number;
      total_points_awarded: number;
      expired_entries: number;
    }>(`
      SELECT 
        COUNT(*)::int as total_entries,
        COALESCE(SUM(points_change), 0)::int as total_points_awarded,
        COUNT(*) FILTER (WHERE expired = TRUE)::int as expired_entries
      FROM score_history
    `);

    // Lead score distribution
    const distribution = await db.query<{ tier: string; count: number }>(`
      SELECT tier, COUNT(*)::int as count
      FROM (
        SELECT 
          CASE 
            WHEN total_score >= ${SCORE_THRESHOLDS.VERY_HOT} THEN 'very_hot'
            WHEN total_score >= ${SCORE_THRESHOLDS.HOT} THEN 'hot'
            WHEN total_score >= ${SCORE_THRESHOLDS.WARM} THEN 'warm'
            ELSE 'cold'
          END as tier
        FROM leads
      ) lead_tiers
      GROUP BY tier
      ORDER BY 
        CASE tier 
          WHEN 'very_hot' THEN 1 
          WHEN 'hot' THEN 2 
          WHEN 'warm' THEN 3 
          ELSE 4 
        END
    `);

    // Top performing rules
    const topRules = await db.query<{
      rule_slug: string;
      rule_name: string;
      applications: number;
      total_points: number;
    }>(`
      SELECT 
        sr.slug as rule_slug,
        sr.name as rule_name,
        COUNT(*)::int as applications,
        SUM(sh.points_change)::int as total_points
      FROM score_history sh
      JOIN scoring_rules sr ON sh.rule_id = sr.id
      WHERE sh.created_at > NOW() - INTERVAL '30 days'
      GROUP BY sr.slug, sr.name
      ORDER BY applications DESC
      LIMIT 10
    `);

    return {
      rules: rulesStats,
      history: historyStats,
      lead_distribution: distribution,
      top_rules_30d: topRules
    };
  });
}

export default scoringRoutes;
