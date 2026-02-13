// =============================================================================
// src/services/scoringEngine.ts
// Scoring Engine Service for Lead Scoring
// =============================================================================

import { db } from '../db/index.js';
import { SCORE_THRESHOLDS, getScoreTier } from '../config/scoringRules.js';
import type { 
  Lead, 
  MarketingEvent, 
  ScoringRule, 
  ScoreHistory,
  ScoreCategory,
  ScoringConditions
} from '../types/index.js';

// =============================================================================
// Scoring Result Types
// =============================================================================

export interface ScoringResult {
  rules_matched: string[];
  points_added: number;
  new_scores: {
    demographic: number;
    engagement: number;
    behavior: number;
    total: number;
  };
  score_tier: 'cold' | 'warm' | 'hot' | 'very_hot';
  triggers: ScoringTrigger[];
}

export interface ScoringTrigger {
  type: 'hot_lead_alert' | 'threshold_crossed';
  threshold: number;
  old_score: number;
  new_score: number;
}

// =============================================================================
// Scoring Engine Class
// =============================================================================

export class ScoringEngine {
  private rules: ScoringRule[] = [];
  private rulesLoaded: boolean = false;

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Load active scoring rules from database
   */
  async loadRules(): Promise<void> {
    this.rules = await db.query<ScoringRule>(`
      SELECT * FROM scoring_rules 
      WHERE is_active = TRUE 
      ORDER BY priority ASC, created_at ASC
    `);
    this.rulesLoaded = true;
    console.log(`[Scoring Engine] Loaded ${this.rules.length} active rules`);
  }

  /**
   * Get all loaded rules
   */
  getRules(): ScoringRule[] {
    return this.rules;
  }

  // ===========================================================================
  // Event Processing
  // ===========================================================================

  /**
   * Process an event and update lead scores
   */
  async processEvent(event: MarketingEvent, lead: Lead): Promise<ScoringResult> {
    // Ensure rules are loaded
    if (!this.rulesLoaded) {
      await this.loadRules();
    }

    const result: ScoringResult = {
      rules_matched: [],
      points_added: 0,
      new_scores: {
        demographic: lead.demographic_score,
        engagement: lead.engagement_score,
        behavior: lead.behavior_score,
        total: lead.total_score
      },
      score_tier: getScoreTier(lead.total_score),
      triggers: []
    };

    const oldTotalScore = lead.total_score;

    // Process each active rule
    for (const rule of this.rules) {
      // Skip field-based rules - they're processed separately on profile update
      if (rule.rule_type === 'field') {
        continue;
      }

      // Check if rule matches the event
      if (this.matchesConditions(rule, event, lead)) {
        // Check if rule can be applied (respecting limits)
        if (await this.canApplyRule(rule, lead.id)) {
          // Apply the score
          await this.applyScore(rule, lead.id, event.id);
          result.rules_matched.push(rule.slug);
          result.points_added += rule.points;
          
          console.log(`[Scoring Engine] Applied rule "${rule.slug}" (+${rule.points} ${rule.category}) to lead ${lead.id}`);
        }
      }
    }

    // Recalculate scores if any rules matched
    if (result.rules_matched.length > 0) {
      await db.execute(`SELECT recalculate_lead_scores($1)`, [lead.id]);

      // Get updated scores
      const updated = await db.queryOne<{
        demographic_score: number;
        engagement_score: number;
        behavior_score: number;
        total_score: number;
      }>(`
        SELECT demographic_score, engagement_score, behavior_score, total_score
        FROM leads WHERE id = $1
      `, [lead.id]);

      if (updated) {
        result.new_scores = {
          demographic: updated.demographic_score,
          engagement: updated.engagement_score,
          behavior: updated.behavior_score,
          total: updated.total_score
        };
        result.score_tier = getScoreTier(updated.total_score);
      }
    }

    // Check for triggers
    result.triggers = this.checkTriggers(oldTotalScore, result.new_scores.total);

    // Handle triggers
    for (const trigger of result.triggers) {
      if (trigger.type === 'hot_lead_alert') {
        await this.handleHotLeadAlert(lead.id, result.new_scores.total);
      }
    }

    return result;
  }

  // ===========================================================================
  // Profile-Based Scoring
  // ===========================================================================

  /**
   * Process demographic scoring rules based on lead profile
   * Called when lead profile is created or updated
   */
  async processLeadProfile(lead: Lead, organization?: { 
    industry?: string; 
    company_size?: string; 
    country?: string; 
  }): Promise<ScoringResult> {
    if (!this.rulesLoaded) {
      await this.loadRules();
    }

    const result: ScoringResult = {
      rules_matched: [],
      points_added: 0,
      new_scores: {
        demographic: lead.demographic_score,
        engagement: lead.engagement_score,
        behavior: lead.behavior_score,
        total: lead.total_score
      },
      score_tier: getScoreTier(lead.total_score),
      triggers: []
    };

    const oldTotalScore = lead.total_score;

    // Filter field-based rules only
    const fieldRules = this.rules.filter(r => r.rule_type === 'field');

    for (const rule of fieldRules) {
      if (this.matchesFieldConditions(rule, lead, organization)) {
        if (await this.canApplyRule(rule, lead.id)) {
          await this.applyScore(rule, lead.id, undefined);
          result.rules_matched.push(rule.slug);
          result.points_added += rule.points;
          
          console.log(`[Scoring Engine] Applied demographic rule "${rule.slug}" (+${rule.points}) to lead ${lead.id}`);
        }
      }
    }

    // Recalculate if rules matched
    if (result.rules_matched.length > 0) {
      await db.execute(`SELECT recalculate_lead_scores($1)`, [lead.id]);

      const updated = await db.queryOne<{
        demographic_score: number;
        engagement_score: number;
        behavior_score: number;
        total_score: number;
      }>(`
        SELECT demographic_score, engagement_score, behavior_score, total_score
        FROM leads WHERE id = $1
      `, [lead.id]);

      if (updated) {
        result.new_scores = {
          demographic: updated.demographic_score,
          engagement: updated.engagement_score,
          behavior: updated.behavior_score,
          total: updated.total_score
        };
        result.score_tier = getScoreTier(updated.total_score);
      }
    }

    result.triggers = this.checkTriggers(oldTotalScore, result.new_scores.total);

    return result;
  }

  // ===========================================================================
  // Condition Matching
  // ===========================================================================

  /**
   * Check if an event matches a rule's conditions
   */
  private matchesConditions(rule: ScoringRule, event: MarketingEvent, lead: Lead): boolean {
    const conditions = rule.conditions;

    // Event type matching
    if (conditions.event_type) {
      if (event.event_type !== conditions.event_type) {
        return false;
      }

      // Metadata matching (if specified)
      if (conditions.metadata) {
        for (const [key, expectedValue] of Object.entries(conditions.metadata)) {
          const actualValue = event.metadata?.[key];
          
          // Handle comparison operators in metadata
          if (typeof expectedValue === 'object' && expectedValue !== null) {
            const opObj = expectedValue as { lt?: number; lte?: number; gt?: number; gte?: number };
            if (opObj.lt !== undefined && !(Number(actualValue) < opObj.lt)) return false;
            if (opObj.lte !== undefined && !(Number(actualValue) <= opObj.lte)) return false;
            if (opObj.gt !== undefined && !(Number(actualValue) > opObj.gt)) return false;
            if (opObj.gte !== undefined && !(Number(actualValue) >= opObj.gte)) return false;
          } else if (actualValue !== expectedValue) {
            return false;
          }
        }
      }

      return true;
    }

    return false;
  }

  /**
   * Check if a lead's profile matches field-based conditions
   */
  private matchesFieldConditions(
    rule: ScoringRule, 
    lead: Lead, 
    organization?: { industry?: string; company_size?: string; country?: string }
  ): boolean {
    const conditions = rule.conditions;

    if (!conditions.field || !conditions.operator) {
      return false;
    }

    // Get the field value
    const value = this.getFieldValue(conditions.field, lead, organization);
    
    if (value === undefined || value === null) {
      return false;
    }

    // Apply operator
    switch (conditions.operator) {
      case 'equals':
        return value === conditions.value;

      case 'in':
        return Array.isArray(conditions.value) && conditions.value.includes(value);

      case 'contains':
        if (typeof value !== 'string') return false;
        if (Array.isArray(conditions.value)) {
          return conditions.value.some((v: string) => 
            value.toLowerCase().includes(v.toLowerCase())
          );
        }
        return value.toLowerCase().includes(String(conditions.value).toLowerCase());

      case 'pattern':
        if (typeof value !== 'string') return false;
        try {
          const regex = new RegExp(conditions.value as string, 'i');
          return regex.test(value);
        } catch {
          return false;
        }

      case 'gte':
        return Number(value) >= Number(conditions.value);

      case 'lte':
        return Number(value) <= Number(conditions.value);

      default:
        return false;
    }
  }

  /**
   * Get nested field value from lead or organization
   */
  private getFieldValue(
    field: string, 
    lead: Lead, 
    organization?: { industry?: string; company_size?: string; country?: string }
  ): unknown {
    const parts = field.split('.');
    
    if (parts[0] === 'organization' && organization) {
      return organization[parts[1] as keyof typeof organization];
    }
    
    return (lead as unknown as Record<string, unknown>)[field];
  }

  // ===========================================================================
  // Rule Application
  // ===========================================================================

  /**
   * Check if a rule can be applied (respecting daily/total limits)
   */
  private async canApplyRule(rule: ScoringRule, leadId: string): Promise<boolean> {
    // Check max_per_day
    if (rule.max_per_day) {
      const todayCount = await db.queryOne<{ count: number }>(`
        SELECT COUNT(*)::int as count FROM score_history 
        WHERE lead_id = $1 
          AND rule_id = $2 
          AND created_at > NOW() - INTERVAL '1 day'
      `, [leadId, rule.id]);

      if (todayCount && todayCount.count >= rule.max_per_day) {
        console.log(`[Scoring Engine] Rule "${rule.slug}" max_per_day (${rule.max_per_day}) reached for lead ${leadId}`);
        return false;
      }
    }

    // Check max_per_lead (total applications)
    if (rule.max_per_lead) {
      const totalCount = await db.queryOne<{ count: number }>(`
        SELECT COUNT(*)::int as count FROM score_history 
        WHERE lead_id = $1 AND rule_id = $2
      `, [leadId, rule.id]);

      if (totalCount && totalCount.count >= rule.max_per_lead) {
        console.log(`[Scoring Engine] Rule "${rule.slug}" max_per_lead (${rule.max_per_lead}) reached for lead ${leadId}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Apply a score and create history entry
   */
  private async applyScore(
    rule: ScoringRule, 
    leadId: string, 
    eventId: string | undefined
  ): Promise<void> {
    // Calculate expiration date if decay is configured
    const expiresAt = rule.decay_days
      ? new Date(Date.now() + rule.decay_days * 24 * 60 * 60 * 1000)
      : null;

    // Get current total for category
    const current = await db.queryOne<{ total: number }>(`
      SELECT COALESCE(SUM(points_change), 0)::int as total 
      FROM score_history 
      WHERE lead_id = $1 AND category = $2 AND expired = FALSE
    `, [leadId, rule.category]);

    const currentTotal = current?.total ?? 0;
    const newTotal = currentTotal + rule.points;

    // Insert score history entry
    await db.execute(`
      INSERT INTO score_history (
        lead_id, event_id, rule_id, category, 
        points_change, new_total, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      leadId,
      eventId || null,
      rule.id,
      rule.category,
      rule.points,
      newTotal,
      expiresAt
    ]);

    // Update event's score tracking (if event provided)
    if (eventId) {
      await db.execute(`
        UPDATE events 
        SET score_points = COALESCE(score_points, 0) + $1, score_category = $2
        WHERE id = $3
      `, [rule.points, rule.category, eventId]);
    }
  }

  // ===========================================================================
  // Triggers
  // ===========================================================================

  /**
   * Check for score threshold triggers
   */
  private checkTriggers(oldScore: number, newScore: number): ScoringTrigger[] {
    const triggers: ScoringTrigger[] = [];

    // Hot lead threshold crossed
    if (oldScore < SCORE_THRESHOLDS.HOT && newScore >= SCORE_THRESHOLDS.HOT) {
      triggers.push({
        type: 'hot_lead_alert',
        threshold: SCORE_THRESHOLDS.HOT,
        old_score: oldScore,
        new_score: newScore
      });
    }

    // Very hot threshold
    if (oldScore < SCORE_THRESHOLDS.VERY_HOT && newScore >= SCORE_THRESHOLDS.VERY_HOT) {
      triggers.push({
        type: 'threshold_crossed',
        threshold: SCORE_THRESHOLDS.VERY_HOT,
        old_score: oldScore,
        new_score: newScore
      });
    }

    // Warm threshold (for initial routing)
    if (oldScore < SCORE_THRESHOLDS.WARM && newScore >= SCORE_THRESHOLDS.WARM) {
      triggers.push({
        type: 'threshold_crossed',
        threshold: SCORE_THRESHOLDS.WARM,
        old_score: oldScore,
        new_score: newScore
      });
    }

    return triggers;
  }

  /**
   * Handle hot lead alert (placeholder for Slack notification)
   */
  private async handleHotLeadAlert(leadId: string, score: number): Promise<void> {
    console.log(`[Scoring Engine] 🔥 HOT LEAD ALERT: Lead ${leadId} reached score ${score}`);
    
    // Get lead details for alert
    const lead = await db.queryOne<Lead>(`
      SELECT * FROM leads WHERE id = $1
    `, [leadId]);

    if (lead) {
      // TODO: Queue Slack notification in Phase 12
      console.log(`[Scoring Engine] Hot lead: ${lead.first_name} ${lead.last_name} (${lead.email}) - Score: ${score}`);
    }
  }

  // ===========================================================================
  // Score Queries
  // ===========================================================================

  /**
   * Get score history for a lead
   */
  async getScoreHistory(leadId: string, limit: number = 50): Promise<ScoreHistory[]> {
    return db.query<ScoreHistory>(`
      SELECT 
        sh.*,
        sr.slug as rule_slug,
        sr.name as rule_name
      FROM score_history sh
      LEFT JOIN scoring_rules sr ON sh.rule_id = sr.id
      WHERE sh.lead_id = $1
      ORDER BY sh.created_at DESC
      LIMIT $2
    `, [leadId, limit]);
  }

  /**
   * Get score breakdown by category
   */
  async getScoreBreakdown(leadId: string): Promise<{
    demographic: number;
    engagement: number;
    behavior: number;
    total: number;
    history_count: number;
    expired_points: number;
  }> {
    const result = await db.queryOne<{
      demographic: number;
      engagement: number;
      behavior: number;
      total: number;
      history_count: number;
      expired_points: number;
    }>(`
      SELECT 
        l.demographic_score as demographic,
        l.engagement_score as engagement,
        l.behavior_score as behavior,
        l.total_score as total,
        (SELECT COUNT(*)::int FROM score_history WHERE lead_id = $1) as history_count,
        (SELECT COALESCE(SUM(points_change), 0)::int FROM score_history WHERE lead_id = $1 AND expired = TRUE) as expired_points
      FROM leads l
      WHERE l.id = $1
    `, [leadId]);

    return result || {
      demographic: 0,
      engagement: 0,
      behavior: 0,
      total: 0,
      history_count: 0,
      expired_points: 0
    };
  }

  /**
   * Manually recalculate scores for a lead
   */
  async recalculateScores(leadId: string): Promise<{
    demographic: number;
    engagement: number;
    behavior: number;
    total: number;
  }> {
    await db.execute(`SELECT recalculate_lead_scores($1)`, [leadId]);

    const updated = await db.queryOne<{
      demographic_score: number;
      engagement_score: number;
      behavior_score: number;
      total_score: number;
    }>(`
      SELECT demographic_score, engagement_score, behavior_score, total_score
      FROM leads WHERE id = $1
    `, [leadId]);

    return {
      demographic: updated?.demographic_score ?? 0,
      engagement: updated?.engagement_score ?? 0,
      behavior: updated?.behavior_score ?? 0,
      total: updated?.total_score ?? 0
    };
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let scoringEngineInstance: ScoringEngine | null = null;

export function getScoringEngine(): ScoringEngine {
  if (!scoringEngineInstance) {
    scoringEngineInstance = new ScoringEngine();
  }
  return scoringEngineInstance;
}

export default ScoringEngine;
