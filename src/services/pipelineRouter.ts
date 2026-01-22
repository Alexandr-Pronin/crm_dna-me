// =============================================================================
// src/services/pipelineRouter.ts
// Smart Pipeline Routing Service
// =============================================================================

import { db } from '../db/index.js';
import { getRoutingQueue, getNotificationsQueue } from '../config/queues.js';
import { 
  ROUTING_CONFIG, 
  getPipelineForIntent, 
  getOwnerAssignmentConfig,
  meetsRoutingThresholds 
} from '../config/routingConfig.js';
import type { 
  Lead, 
  Deal, 
  Pipeline, 
  PipelineStage, 
  TeamMember,
  IntentSignal, 
  IntentType, 
  RoutingResult,
  IntentSummary
} from '../types/index.js';

// =============================================================================
// Pipeline Router Class
// =============================================================================

export class PipelineRouter {
  
  // ===========================================================================
  // Main Routing Method
  // ===========================================================================
  
  /**
   * Evaluates a lead and routes to appropriate pipeline if criteria are met.
   * Called after scoring and intent detection.
   */
  async evaluateAndRoute(leadId: string): Promise<RoutingResult> {
    // 1. Get lead with latest data
    const lead = await db.queryOne<Lead>(`
      SELECT * FROM leads WHERE id = $1
    `, [leadId]);
    
    if (!lead) {
      return { action: 'skip', reason: 'lead_not_found' };
    }
    
    console.log(`[Router] Evaluating lead ${lead.email} (score=${lead.total_score}, intent=${lead.primary_intent}, confidence=${lead.intent_confidence}%)`);
    
    // 2. Skip if already routed
    if (lead.pipeline_id !== null) {
      console.log(`[Router] Lead already routed to pipeline ${lead.pipeline_id}`);
      return { action: 'skip', reason: 'already_routed' };
    }
    
    // 3. Check minimum score
    if (lead.total_score < ROUTING_CONFIG.min_score_threshold) {
      console.log(`[Router] Score ${lead.total_score} below threshold ${ROUTING_CONFIG.min_score_threshold}`);
      return { 
        action: 'skip', 
        reason: 'score_below_threshold',
        details: `Score ${lead.total_score} < ${ROUTING_CONFIG.min_score_threshold}`
      };
    }
    
    // 4. Get intent signals and recalculate confidence
    const signals = await db.query<IntentSignal>(`
      SELECT * FROM intent_signals WHERE lead_id = $1
    `, [lead.id]);
    
    // 5. Calculate intent confidence
    const intent = this.calculateIntentConfidence(signals);
    
    // 6. Update lead's intent fields
    await db.execute(`
      UPDATE leads SET 
        primary_intent = $2,
        intent_confidence = $3,
        intent_summary = $4,
        updated_at = NOW()
      WHERE id = $1
    `, [lead.id, intent.primary_intent, intent.intent_confidence, JSON.stringify(intent.intent_summary)]);
    
    // 7. Route if confident enough
    if (intent.is_routable && intent.primary_intent) {
      console.log(`[Router] Lead is routable with intent=${intent.primary_intent}, confidence=${intent.intent_confidence}%`);
      return await this.routeLeadToPipeline(lead, intent.primary_intent);
    }
    
    // 8. Handle conflicts
    if (intent.conflict_detected) {
      console.log(`[Router] Intent conflict detected - sending for manual review`);
      await this.handleIntentConflict(lead, intent);
      
      // Update routing status to manual review
      await db.execute(`
        UPDATE leads SET routing_status = 'manual_review', updated_at = NOW()
        WHERE id = $1
      `, [lead.id]);
      
      return { action: 'manual_review', reason: 'intent_conflict' };
    }
    
    // 9. Check if stuck too long
    const daysInPool = this.daysSinceCreation(lead.created_at);
    if (daysInPool > ROUTING_CONFIG.max_unrouted_days) {
      console.log(`[Router] Lead stuck for ${daysInPool} days - sending for manual review`);
      await this.handleStuckLead(lead, intent);
      
      // Update routing status to manual review
      await db.execute(`
        UPDATE leads SET routing_status = 'manual_review', updated_at = NOW()
        WHERE id = $1
      `, [lead.id]);
      
      return { action: 'manual_review', reason: 'stuck_in_pool', days_in_pool: daysInPool };
    }
    
    // 10. Not ready yet
    console.log(`[Router] Lead not ready for routing - confidence ${intent.intent_confidence}% < ${ROUTING_CONFIG.min_intent_confidence}%`);
    return { action: 'wait', reason: 'insufficient_confidence' };
  }
  
  // ===========================================================================
  // Route Lead to Pipeline
  // ===========================================================================
  
  /**
   * Routes a lead to the appropriate pipeline based on intent.
   */
  private async routeLeadToPipeline(lead: Lead, intent: IntentType): Promise<RoutingResult> {
    const pipelineSlug = getPipelineForIntent(intent);
    
    // Get pipeline
    const pipeline = await db.queryOne<Pipeline>(`
      SELECT * FROM pipelines WHERE slug = $1 AND is_active = TRUE
    `, [pipelineSlug]);
    
    if (!pipeline) {
      console.error(`[Router] Pipeline not found: ${pipelineSlug}`);
      return { action: 'skip', reason: 'pipeline_not_found', details: pipelineSlug };
    }
    
    // Get first stage
    const firstStage = await db.queryOne<PipelineStage>(`
      SELECT * FROM pipeline_stages 
      WHERE pipeline_id = $1 
      ORDER BY position ASC 
      LIMIT 1
    `, [pipeline.id]);
    
    if (!firstStage) {
      console.error(`[Router] No stages found for pipeline: ${pipeline.id}`);
      return { action: 'skip', reason: 'no_pipeline_stages' };
    }
    
    // Create deal name
    const dealName = `${lead.first_name || ''} ${lead.last_name || ''} - ${pipeline.name}`.trim() || `${lead.email} - ${pipeline.name}`;
    
    // Create deal
    const deal = await db.queryOne<Deal>(`
      INSERT INTO deals (lead_id, pipeline_id, stage_id, name, status, created_at, updated_at, stage_entered_at)
      VALUES ($1, $2, $3, $4, 'open', NOW(), NOW(), NOW())
      ON CONFLICT (lead_id, pipeline_id) DO UPDATE SET
        stage_id = EXCLUDED.stage_id,
        updated_at = NOW()
      RETURNING *
    `, [lead.id, pipeline.id, firstStage.id, dealName]);
    
    if (!deal) {
      console.error(`[Router] Failed to create deal`);
      return { action: 'skip', reason: 'deal_creation_failed' };
    }
    
    // Update lead
    await db.execute(`
      UPDATE leads SET 
        pipeline_id = $2, 
        routing_status = 'routed', 
        routed_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `, [lead.id, pipeline.id]);
    
    // Assign owner
    const ownerConfig = getOwnerAssignmentConfig(intent);
    const owner = await this.assignOwner(deal.id, ownerConfig, lead);
    
    console.log(`[Router] ✅ Lead ${lead.email} routed to ${pipeline.name}, deal ${deal.id}, assigned to ${owner?.email || 'unassigned'}`);
    
    // Send notification
    await this.sendRoutingNotification(lead, pipeline, deal, intent, owner);
    
    return {
      action: 'routed',
      reason: 'intent_match',
      pipeline_id: pipeline.id,
      pipeline_name: pipeline.name,
      deal_id: deal.id,
      assigned_to: owner?.email
    };
  }
  
  // ===========================================================================
  // Owner Assignment
  // ===========================================================================
  
  /**
   * Assigns an owner to a deal based on the assignment config.
   */
  private async assignOwner(
    dealId: string, 
    config: { role: string; strategy: string; region_aware?: boolean; value_tier_aware?: boolean },
    lead: Lead
  ): Promise<TeamMember | null> {
    let owner: TeamMember | null = null;
    
    switch (config.strategy) {
      case 'round_robin':
        owner = await this.getNextAvailableOwner(config.role, config.region_aware ? this.getLeadRegion(lead) : undefined);
        break;
        
      case 'capacity_based':
        owner = await this.getLeastLoadedOwner(config.role, config.region_aware ? this.getLeadRegion(lead) : undefined);
        break;
        
      case 'manual':
        // Don't auto-assign, just queue notification
        await this.queueAssignmentNotification(dealId, config.role);
        return null;
        
      case 'notify_only':
        // Just notify, don't assign
        await this.queueAssignmentNotification(dealId, config.role);
        return null;
        
      default:
        console.warn(`[Router] Unknown assignment strategy: ${config.strategy}`);
        return null;
    }
    
    if (!owner) {
      console.warn(`[Router] No available owner found for role: ${config.role}`);
      await this.queueAssignmentNotification(dealId, config.role);
      return null;
    }
    
    // Update deal assignment
    await db.execute(`
      UPDATE deals 
      SET assigned_to = $1, assigned_at = NOW(), updated_at = NOW()
      WHERE id = $2
    `, [owner.email, dealId]);
    
    // Increment owner's lead count
    await db.execute(`
      UPDATE team_members 
      SET current_leads = current_leads + 1
      WHERE email = $1
    `, [owner.email]);
    
    return owner;
  }
  
  /**
   * Gets the next available owner using round-robin strategy.
   */
  private async getNextAvailableOwner(role: string, region?: string): Promise<TeamMember | null> {
    let sql = `
      SELECT * FROM team_members 
      WHERE role = $1 
        AND is_active = TRUE 
        AND current_leads < max_leads
    `;
    const params: unknown[] = [role];
    
    if (region) {
      sql += ` AND (region = $2 OR region IS NULL)`;
      params.push(region);
    }
    
    sql += ` ORDER BY current_leads ASC, RANDOM() LIMIT 1`;
    
    return await db.queryOne<TeamMember>(sql, params);
  }
  
  /**
   * Gets the least loaded owner using capacity-based strategy.
   */
  private async getLeastLoadedOwner(role: string, region?: string): Promise<TeamMember | null> {
    let sql = `
      SELECT * FROM team_members 
      WHERE role = $1 
        AND is_active = TRUE 
        AND current_leads < max_leads
    `;
    const params: unknown[] = [role];
    
    if (region) {
      sql += ` AND (region = $2 OR region IS NULL)`;
      params.push(region);
    }
    
    // Capacity ratio = current_leads / max_leads (lower is better)
    sql += ` ORDER BY (current_leads::float / NULLIF(max_leads, 0)) ASC LIMIT 1`;
    
    return await db.queryOne<TeamMember>(sql, params);
  }
  
  // ===========================================================================
  // Intent Confidence Calculation
  // ===========================================================================
  
  /**
   * Calculates intent confidence from intent signals.
   */
  calculateIntentConfidence(signals: IntentSignal[]): {
    primary_intent: IntentType | null;
    intent_confidence: number;
    intent_summary: IntentSummary;
    is_routable: boolean;
    conflict_detected: boolean;
  } {
    // 1. Aggregate points by intent
    const summary: IntentSummary = { research: 0, b2b: 0, co_creation: 0 };
    
    for (const signal of signals) {
      summary[signal.intent] += signal.confidence_points;
    }
    
    // 2. Find primary and secondary intents
    const sorted = Object.entries(summary).sort(([, a], [, b]) => b - a) as [IntentType, number][];
    const [primaryIntent, primaryScore] = sorted[0];
    const [, secondaryScore] = sorted[1] || [null, 0];
    
    // 3. Calculate total points
    const totalPoints = Object.values(summary).reduce((a, b) => a + b, 0);
    
    // 4. Calculate confidence (0-100)
    let confidence = 0;
    if (totalPoints > 0) {
      // Dominance of primary intent
      confidence = Math.round((primaryScore / totalPoints) * 100);
      
      // Boost if primary clearly beats secondary
      if (primaryScore - secondaryScore >= ROUTING_CONFIG.intent_confidence_margin) {
        confidence = Math.min(100, confidence + 10);
      }
      
      // Reduce if total signals are weak
      if (totalPoints < 30) {
        confidence = Math.max(0, confidence - 20);
      }
    }
    
    // 5. Detect conflict
    const conflict_detected = 
      secondaryScore > 0 && 
      (primaryScore - secondaryScore) < ROUTING_CONFIG.intent_confidence_margin;
    
    // 6. Determine if routable
    const is_routable = 
      primaryScore > 0 &&
      confidence >= ROUTING_CONFIG.min_intent_confidence && 
      !conflict_detected;
    
    return {
      primary_intent: primaryScore > 0 ? primaryIntent : null,
      intent_confidence: confidence,
      intent_summary: summary,
      is_routable,
      conflict_detected
    };
  }
  
  // ===========================================================================
  // Conflict and Stuck Lead Handling
  // ===========================================================================
  
  /**
   * Handles leads with conflicting intents.
   */
  private async handleIntentConflict(
    lead: Lead, 
    intent: { intent_summary: IntentSummary; intent_confidence: number }
  ): Promise<void> {
    const notificationsQueue = getNotificationsQueue();
    
    await notificationsQueue.add('slack_notification', {
      channel: '#lead-routing',
      type: 'intent_conflict',
      message: `⚠️ Intent Conflict: ${lead.email}\n` +
               `Research: ${intent.intent_summary.research} | ` +
               `B2B: ${intent.intent_summary.b2b} | ` +
               `Co-Creation: ${intent.intent_summary.co_creation}\n` +
               `Score: ${lead.total_score} | Confidence: ${intent.intent_confidence}%\n` +
               `Please review and manually route.`,
      lead_id: lead.id
    });
  }
  
  /**
   * Handles leads stuck in the global pool too long.
   */
  private async handleStuckLead(
    lead: Lead, 
    intent: { intent_summary: IntentSummary; intent_confidence: number; primary_intent: IntentType | null }
  ): Promise<void> {
    const notificationsQueue = getNotificationsQueue();
    const daysInPool = this.daysSinceCreation(lead.created_at);
    
    await notificationsQueue.add('slack_notification', {
      channel: '#lead-routing',
      type: 'stuck_lead',
      message: `🕐 Stuck Lead Alert: ${lead.email}\n` +
               `Days in pool: ${daysInPool}\n` +
               `Score: ${lead.total_score} | Primary Intent: ${intent.primary_intent || 'unknown'}\n` +
               `Research: ${intent.intent_summary.research} | ` +
               `B2B: ${intent.intent_summary.b2b} | ` +
               `Co-Creation: ${intent.intent_summary.co_creation}\n` +
               `Please review and manually route or disqualify.`,
      lead_id: lead.id
    });
  }
  
  /**
   * Sends notification for routing success.
   */
  private async sendRoutingNotification(
    lead: Lead,
    pipeline: Pipeline,
    deal: Deal,
    intent: IntentType,
    owner: TeamMember | null
  ): Promise<void> {
    const notificationsQueue = getNotificationsQueue();
    
    await notificationsQueue.add('slack_notification', {
      channel: '#hot-leads',
      type: 'lead_routed',
      message: `🎯 Lead Routed!\n` +
               `${lead.first_name || ''} ${lead.last_name || ''} (${lead.email})\n` +
               `→ ${pipeline.name}\n` +
               `Intent: ${intent} (${lead.intent_confidence}% confidence)\n` +
               `Score: ${lead.total_score}\n` +
               `Assigned: ${owner?.email || 'Unassigned'}`,
      lead_id: lead.id,
      deal_id: deal.id
    });
  }
  
  /**
   * Queues a notification for manual assignment needed.
   */
  private async queueAssignmentNotification(dealId: string, role: string): Promise<void> {
    const notificationsQueue = getNotificationsQueue();
    
    await notificationsQueue.add('slack_notification', {
      channel: '#lead-routing',
      type: 'assignment_needed',
      message: `📋 Assignment Needed\n` +
               `Deal ID: ${dealId}\n` +
               `Role needed: ${role}\n` +
               `Please assign an owner.`,
      deal_id: dealId,
      role
    });
  }
  
  // ===========================================================================
  // Helper Methods
  // ===========================================================================
  
  /**
   * Calculates days since lead creation.
   */
  private daysSinceCreation(createdAt: Date): number {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
  
  /**
   * Determines lead region based on email domain or organization.
   */
  private getLeadRegion(lead: Lead): string | undefined {
    // Simple heuristic: check email domain for region hints
    const email = lead.email.toLowerCase();
    
    if (email.endsWith('.de') || email.includes('.uni-')) {
      return 'DACH';
    }
    if (email.endsWith('.uk') || email.endsWith('.ac.uk')) {
      return 'UK';
    }
    if (email.endsWith('.edu')) {
      return 'US';
    }
    if (email.endsWith('.fr')) {
      return 'France';
    }
    
    return undefined;
  }
  
  // ===========================================================================
  // Manual Routing Methods
  // ===========================================================================
  
  /**
   * Manually route a lead to a specific pipeline.
   */
  async manualRoute(
    leadId: string, 
    pipelineId: string, 
    assignedTo?: string
  ): Promise<RoutingResult> {
    const lead = await db.queryOne<Lead>(`SELECT * FROM leads WHERE id = $1`, [leadId]);
    
    if (!lead) {
      return { action: 'skip', reason: 'lead_not_found' };
    }
    
    const pipeline = await db.queryOne<Pipeline>(`
      SELECT * FROM pipelines WHERE id = $1 AND is_active = TRUE
    `, [pipelineId]);
    
    if (!pipeline) {
      return { action: 'skip', reason: 'pipeline_not_found' };
    }
    
    const firstStage = await db.queryOne<PipelineStage>(`
      SELECT * FROM pipeline_stages 
      WHERE pipeline_id = $1 
      ORDER BY position ASC 
      LIMIT 1
    `, [pipeline.id]);
    
    if (!firstStage) {
      return { action: 'skip', reason: 'no_pipeline_stages' };
    }
    
    const dealName = `${lead.first_name || ''} ${lead.last_name || ''} - ${pipeline.name}`.trim() || `${lead.email} - ${pipeline.name}`;
    
    // Create or update deal
    const deal = await db.queryOne<Deal>(`
      INSERT INTO deals (lead_id, pipeline_id, stage_id, name, assigned_to, assigned_at, status, created_at, updated_at, stage_entered_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'open', NOW(), NOW(), NOW())
      ON CONFLICT (lead_id, pipeline_id) DO UPDATE SET
        stage_id = EXCLUDED.stage_id,
        assigned_to = EXCLUDED.assigned_to,
        assigned_at = EXCLUDED.assigned_at,
        updated_at = NOW()
      RETURNING *
    `, [lead.id, pipeline.id, firstStage.id, dealName, assignedTo || null, assignedTo ? new Date() : null]);
    
    // Update lead
    await db.execute(`
      UPDATE leads SET 
        pipeline_id = $2, 
        routing_status = 'routed', 
        routed_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `, [lead.id, pipeline.id]);
    
    // Update team member lead count if assigned
    if (assignedTo) {
      await db.execute(`
        UPDATE team_members 
        SET current_leads = current_leads + 1
        WHERE email = $1
      `, [assignedTo]);
    }
    
    console.log(`[Router] ✅ Lead ${lead.email} manually routed to ${pipeline.name}`);
    
    return {
      action: 'routed',
      reason: 'manual_route',
      pipeline_id: pipeline.id,
      pipeline_name: pipeline.name,
      deal_id: deal?.id,
      assigned_to: assignedTo
    };
  }
  
  // ===========================================================================
  // Batch Operations
  // ===========================================================================
  
  /**
   * Queue routing evaluation for multiple leads.
   */
  async queueRoutingEvaluation(leadIds: string[]): Promise<void> {
    const routingQueue = getRoutingQueue();
    
    for (const leadId of leadIds) {
      await routingQueue.add('evaluate', {
        lead_id: leadId,
        trigger: 'manual'
      }, {
        jobId: `routing-${leadId}-${Date.now()}`
      });
    }
    
    console.log(`[Router] Queued ${leadIds.length} leads for routing evaluation`);
  }
  
  /**
   * Get routing statistics.
   */
  async getRoutingStats(): Promise<{
    total_leads: number;
    unrouted: number;
    pending: number;
    routed: number;
    manual_review: number;
    by_pipeline: { pipeline_name: string; count: number }[];
    by_intent: { intent: string; count: number }[];
  }> {
    const statusCounts = await db.query<{ routing_status: string; count: string }>(`
      SELECT routing_status, COUNT(*) as count 
      FROM leads 
      GROUP BY routing_status
    `);
    
    const pipelineCounts = await db.query<{ pipeline_name: string; count: string }>(`
      SELECT p.name as pipeline_name, COUNT(*) as count 
      FROM leads l
      JOIN pipelines p ON l.pipeline_id = p.id
      WHERE l.pipeline_id IS NOT NULL
      GROUP BY p.name
    `);
    
    const intentCounts = await db.query<{ intent: string; count: string }>(`
      SELECT primary_intent as intent, COUNT(*) as count 
      FROM leads 
      WHERE primary_intent IS NOT NULL
      GROUP BY primary_intent
    `);
    
    const stats = {
      total_leads: 0,
      unrouted: 0,
      pending: 0,
      routed: 0,
      manual_review: 0
    };
    
    for (const row of statusCounts) {
      const count = parseInt(row.count, 10);
      stats.total_leads += count;
      
      if (row.routing_status === 'unrouted') stats.unrouted = count;
      else if (row.routing_status === 'pending') stats.pending = count;
      else if (row.routing_status === 'routed') stats.routed = count;
      else if (row.routing_status === 'manual_review') stats.manual_review = count;
    }
    
    return {
      ...stats,
      by_pipeline: pipelineCounts.map(r => ({ 
        pipeline_name: r.pipeline_name, 
        count: parseInt(r.count, 10) 
      })),
      by_intent: intentCounts.map(r => ({ 
        intent: r.intent, 
        count: parseInt(r.count, 10) 
      }))
    };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let routerInstance: PipelineRouter | null = null;

export function getPipelineRouter(): PipelineRouter {
  if (!routerInstance) {
    routerInstance = new PipelineRouter();
  }
  return routerInstance;
}

export default PipelineRouter;
