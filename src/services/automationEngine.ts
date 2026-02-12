// =============================================================================
// src/services/automationEngine.ts
// Automation Rules Engine for DNA Marketing Engine
// =============================================================================

import { db } from '../db/index.js';
import { getSyncQueue, getNotificationsQueue } from '../config/queues.js';
import { NotFoundError } from '../errors/index.js';
import { pauseDealEnrollments } from '../workers/emailSequenceWorker.js';
import { getTriggerService } from './triggerService.js';
import type {
  AutomationRule,
  Lead,
  Deal,
  MarketingEvent,
  PipelineStage,
  Task,
  AutomationTriggerType,
  AutomationActionType,
  SyncJob
} from '../types/index.js';

// =============================================================================
// Types
// =============================================================================

export interface AutomationResult {
  lead_id: string;
  rules_executed: RuleExecutionResult[];
  actions_taken: ActionResult[];
}

export interface RuleExecutionResult {
  rule_id: string;
  rule_name: string;
  action_type: AutomationActionType;
  success: boolean;
  result?: ActionResult;
  error?: string;
}

export interface ActionResult {
  action: string;
  success: boolean;
  [key: string]: unknown;
}

// =============================================================================
// Automation Engine Class
// =============================================================================

export class AutomationEngine {
  private rules: AutomationRule[] = [];
  
  // ===========================================================================
  // Load Rules
  // ===========================================================================
  
  async loadRules(): Promise<void> {
    this.rules = await db.query<AutomationRule>(`
      SELECT * FROM automation_rules 
      WHERE is_active = TRUE 
      ORDER BY priority ASC
    `);
    console.log(`[Automation Engine] Loaded ${this.rules.length} active rules`);
  }
  
  // ===========================================================================
  // Process Event
  // ===========================================================================
  
  /**
   * Process automation rules for a lead after an event
   */
  async processEvent(lead: Lead, event: MarketingEvent): Promise<AutomationResult> {
    const results: AutomationResult = {
      lead_id: lead.id,
      rules_executed: [],
      actions_taken: []
    };
    
    // Get lead's current deal (if exists)
    const deal = await this.getLeadDeal(lead.id);
    
    // Find matching rules
    for (const rule of this.rules) {
      const matches = await this.evaluateTrigger(rule, lead, event, deal);
      
      if (matches) {
        try {
          const actionResult = await this.executeAction(rule, lead, event, deal);
          results.rules_executed.push({
            rule_id: rule.id,
            rule_name: rule.name,
            action_type: rule.action_type,
            success: true,
            result: actionResult
          });
          results.actions_taken.push(actionResult);
          
          // Update rule execution stats
          await db.execute(`
            UPDATE automation_rules 
            SET last_executed = NOW(), execution_count = execution_count + 1
            WHERE id = $1
          `, [rule.id]);
          
          // Log automation execution
          await this.logAutomationExecution(rule, lead, event, actionResult);
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.rules_executed.push({
            rule_id: rule.id,
            rule_name: rule.name,
            action_type: rule.action_type,
            success: false,
            error: errorMessage
          });
          console.error(`[Automation Engine] Rule ${rule.name} failed:`, errorMessage);
        }
      }
    }
    
    return results;
  }
  
  // ===========================================================================
  // Process Stage Change
  // ===========================================================================
  
  /**
   * Process stage-specific automation when deal moves
   */
  async processStageChange(
    deal: Deal, 
    fromStage: PipelineStage | null, 
    toStage: PipelineStage
  ): Promise<AutomationResult> {
    const lead = await this.getLead(deal.lead_id);
    
    if (!lead) {
      return {
        lead_id: deal.lead_id,
        rules_executed: [],
        actions_taken: []
      };
    }
    
    const results: AutomationResult = {
      lead_id: lead.id,
      rules_executed: [],
      actions_taken: []
    };
    
    // Process stage-specific automation rules from stage config
    const stageRules = toStage.automation_config || [];

    for (const ruleConfig of stageRules) {
      // Support flat format saved by triggers API: { action, config, enabled }
      if ('action' in ruleConfig && typeof (ruleConfig as any).action === 'string') {
        const flatConfig = ruleConfig as any;
        if (flatConfig.enabled === false) continue;
        try {
          const triggerService = getTriggerService();
          const actionResult = await triggerService.executeAction(
            flatConfig.action,
            flatConfig.config || {},
            {
              deal_id: deal.id,
              lead_id: deal.lead_id,
              stage_id: toStage.id,
              pipeline_id: toStage.pipeline_id,
            }
          );
          results.actions_taken.push({
            action: flatConfig.action,
            success: actionResult.success,
            ...actionResult.result as Record<string, unknown>,
          });
        } catch (error) {
          console.error(`[Automation Engine] Stage trigger ${flatConfig.action} error:`, error);
        }
        continue;
      }

      // Legacy nested format: { trigger: { type: 'stage_entered' }, action: { type: '...' } }
      if (ruleConfig.trigger?.type === 'stage_entered') {
        try {
          const actionResult = await this.executeStageAction(ruleConfig, lead, deal);
          results.actions_taken.push(actionResult);
        } catch (error) {
          console.error('[Automation Engine] Stage automation error:', error);
        }
      }
    }
    
    // Also check global automation rules with stage_change trigger
    for (const rule of this.rules) {
      if (rule.trigger_type === 'stage_change') {
        const config = rule.trigger_config as { to_stage?: string; pipeline_id?: string };
        
        // Check if rule applies to this stage change
        if (config.to_stage && config.to_stage !== toStage.slug) continue;
        if (config.pipeline_id && config.pipeline_id !== toStage.pipeline_id) continue;
        
        try {
          const actionResult = await this.executeAction(rule, lead, undefined, deal);
          results.rules_executed.push({
            rule_id: rule.id,
            rule_name: rule.name,
            action_type: rule.action_type,
            success: true,
            result: actionResult
          });
          results.actions_taken.push(actionResult);
          
          await db.execute(`
            UPDATE automation_rules 
            SET last_executed = NOW(), execution_count = execution_count + 1
            WHERE id = $1
          `, [rule.id]);
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.rules_executed.push({
            rule_id: rule.id,
            rule_name: rule.name,
            action_type: rule.action_type,
            success: false,
            error: errorMessage
          });
        }
      }
    }
    
    return results;
  }
  
  // ===========================================================================
  // Trigger Evaluation
  // ===========================================================================
  
  private async evaluateTrigger(
    rule: AutomationRule,
    lead: Lead,
    event: MarketingEvent,
    deal?: Deal
  ): Promise<boolean> {
    const config = rule.trigger_config as Record<string, unknown>;
    
    switch (rule.trigger_type) {
      case 'event':
        return this.evaluateEventTrigger(config, event);
        
      case 'score_threshold':
        return await this.evaluateScoreTrigger(config, lead, rule);
        
      case 'intent_detected':
        return this.evaluateIntentTrigger(config, lead);
        
      case 'time_in_stage':
        return this.evaluateTimeInStageTrigger(config, deal);
        
      case 'stage_change':
        // Stage change triggers are handled in processStageChange
        return false;
        
      default:
        return false;
    }
  }
  
  private evaluateEventTrigger(
    config: Record<string, unknown>, 
    event: MarketingEvent
  ): boolean {
    // Match event type
    if (config.event_type && event.event_type !== config.event_type) {
      return false;
    }
    
    // Match source
    if (config.source && event.source !== config.source) {
      return false;
    }
    
    // Match event metadata
    if (config.metadata && typeof config.metadata === 'object') {
      for (const [key, value] of Object.entries(config.metadata as Record<string, unknown>)) {
        if (event.metadata?.[key] !== value) return false;
      }
    }
    
    return true;
  }
  
  private async evaluateScoreTrigger(
    config: Record<string, unknown>, 
    lead: Lead,
    rule: AutomationRule
  ): Promise<boolean> {
    const scoreGte = config.score_gte as number | undefined;
    
    if (scoreGte && lead.total_score >= scoreGte) {
      // Ensure we haven't already triggered for this threshold
      const alreadyTriggered = await this.hasTriggeredForThreshold(
        rule.id, lead.id, scoreGte
      );
      return !alreadyTriggered;
    }
    
    return false;
  }
  
  private evaluateIntentTrigger(
    config: Record<string, unknown>, 
    lead: Lead
  ): boolean {
    const intent = config.intent as string | undefined;
    const confidenceGte = config.confidence_gte as number | undefined;
    
    if (intent && lead.primary_intent === intent) {
      if (confidenceGte) {
        return lead.intent_confidence >= confidenceGte;
      }
      return true;
    }
    
    return false;
  }
  
  private evaluateTimeInStageTrigger(
    config: Record<string, unknown>, 
    deal?: Deal
  ): boolean {
    if (!deal) return false;
    
    const days = config.days as number | undefined;
    
    if (days && deal.stage_entered_at) {
      const daysInStage = this.daysSince(deal.stage_entered_at);
      return daysInStage >= days;
    }
    
    return false;
  }
  
  // ===========================================================================
  // Action Execution
  // ===========================================================================
  
  private async executeAction(
    rule: AutomationRule,
    lead: Lead,
    event?: MarketingEvent,
    deal?: Deal
  ): Promise<ActionResult> {
    const config = rule.action_config as Record<string, unknown>;
    
    switch (rule.action_type) {
      case 'move_to_stage':
        return await this.actionMoveToStage(lead, deal, config);
        
      case 'assign_owner':
        return await this.actionAssignOwner(lead, deal, config);
        
      case 'send_notification':
        return await this.actionSendNotification(lead, deal, config);
        
      case 'create_task':
        return await this.actionCreateTask(lead, deal, config);
        
      case 'sync_moco':
        return await this.actionSyncMoco(lead, deal, config);
        
      case 'update_field':
        return await this.actionUpdateField(lead, config);
        
      case 'route_to_pipeline':
        return await this.actionRouteToPipeline(lead, config);
        
      default:
        throw new Error(`Unknown action type: ${rule.action_type}`);
    }
  }
  
  private async executeStageAction(
    ruleConfig: { trigger: Record<string, unknown>; action: Record<string, unknown> },
    lead: Lead,
    deal: Deal
  ): Promise<ActionResult> {
    const actionType = ruleConfig.action.type as string;
    const config = ruleConfig.action;
    
    switch (actionType) {
      case 'create_task':
        return await this.actionCreateTask(lead, deal, config as Record<string, unknown>);
        
      case 'send_notification':
        return await this.actionSendNotification(lead, deal, config as Record<string, unknown>);
        
      case 'assign_owner':
        return await this.actionAssignOwner(lead, deal, config as Record<string, unknown>);
        
      default:
        return { action: actionType, success: false, reason: 'unsupported_action' };
    }
  }
  
  // ===========================================================================
  // Action Implementations
  // ===========================================================================
  
  private async actionMoveToStage(
    lead: Lead,
    deal: Deal | undefined,
    config: Record<string, unknown>
  ): Promise<ActionResult> {
    if (!deal) {
      return { action: 'move_to_stage', success: false, reason: 'no_deal' };
    }
    
    const targetStageSlug = config.target_stage as string;
    
    const targetStage = await db.queryOne<PipelineStage>(`
      SELECT * FROM pipeline_stages 
      WHERE pipeline_id = $1 AND slug = $2
    `, [deal.pipeline_id, targetStageSlug]);
    
    if (!targetStage) {
      return { action: 'move_to_stage', success: false, reason: 'stage_not_found' };
    }
    
    await db.execute(`
      UPDATE deals 
      SET stage_id = $1, stage_entered_at = NOW(), updated_at = NOW()
      WHERE id = $2
    `, [targetStage.id, deal.id]);

    try {
      await pauseDealEnrollments(deal.id, deal.stage_id);
    } catch (pauseError) {
      console.error('[Automation Engine] Failed to pause email enrollments:', pauseError);
    }
    
    return { 
      action: 'move_to_stage', 
      success: true, 
      from_stage: deal.stage_id,
      to_stage: targetStage.id,
      to_stage_name: targetStage.name
    };
  }
  
  private async actionAssignOwner(
    lead: Lead,
    deal: Deal | undefined,
    config: Record<string, unknown>
  ): Promise<ActionResult> {
    const role = config.role as string;
    const strategy = config.strategy as string || 'round_robin';
    const region = config.region as string | undefined;
    
    let owner: { email: string; name: string } | null = null;
    
    switch (strategy) {
      case 'round_robin':
      case 'capacity_based':
        owner = await this.getNextAvailableOwner(role, region);
        break;
        
      case 'manual':
        // Don't auto-assign, just notify
        const notificationsQueue = getNotificationsQueue();
        await notificationsQueue.add('notify_assignment_needed', {
          lead_id: lead.id,
          deal_id: deal?.id,
          role
        });
        return { action: 'assign_owner', success: true, result: 'notification_sent' };
        
      default:
        owner = await this.getNextAvailableOwner(role, region);
    }
    
    if (!owner) {
      return { action: 'assign_owner', success: false, reason: 'no_available_owner' };
    }
    
    // Update deal assignment
    if (deal) {
      await db.execute(`
        UPDATE deals 
        SET assigned_to = $1, assigned_at = NOW(), updated_at = NOW()
        WHERE id = $2
      `, [owner.email, deal.id]);
    }
    
    // Increment owner's lead count
    await db.execute(`
      UPDATE team_members 
      SET current_leads = current_leads + 1
      WHERE email = $1
    `, [owner.email]);
    
    return { 
      action: 'assign_owner', 
      success: true, 
      assigned_to: owner.email,
      assigned_name: owner.name
    };
  }
  
  private async actionSendNotification(
    lead: Lead,
    deal: Deal | undefined,
    config: Record<string, unknown>
  ): Promise<ActionResult> {
    const channel = config.channel as string;
    const template = config.template as string | undefined;
    const customMessage = config.message as string | undefined;
    
    const message = customMessage || this.buildNotificationMessage(template, lead, deal);
    
    const notificationsQueue = getNotificationsQueue();
    await notificationsQueue.add('send_slack', {
      channel,
      message,
      lead_id: lead.id,
      deal_id: deal?.id
    });
    
    return { action: 'send_notification', success: true, channel };
  }
  
  private async actionCreateTask(
    lead: Lead,
    deal: Deal | undefined,
    config: Record<string, unknown>
  ): Promise<ActionResult> {
    const titleTemplate = config.title as string;
    const taskType = config.task_type as string || 'follow_up';
    const dueDays = config.due_days as number | undefined;
    const assignedTo = config.assigned_to as string | undefined;
    
    const title = this.interpolateTemplate(titleTemplate, { lead, deal });
    const dueDate = dueDays 
      ? new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000)
      : null;
    
    const finalAssignedTo = assignedTo || deal?.assigned_to || null;
    
    const task = await db.queryOne<Task>(`
      INSERT INTO tasks (lead_id, deal_id, title, task_type, assigned_to, due_date, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'open')
      RETURNING *
    `, [lead.id, deal?.id || null, title, taskType, finalAssignedTo, dueDate]);
    
    return { action: 'create_task', success: true, task_id: task?.id };
  }
  
  private async actionSyncMoco(
    lead: Lead,
    deal: Deal | undefined,
    config: Record<string, unknown>
  ): Promise<ActionResult> {
    const action = config.action as string;
    
    const syncQueue = getSyncQueue();
    
    const syncJob: SyncJob = {
      entity_type: deal ? 'deal' : 'lead',
      entity_id: deal?.id || lead.id,
      target: 'moco',
      action
    };
    
    await syncQueue.add('moco_sync', syncJob);
    
    return { action: 'sync_moco', success: true, queued: action };
  }
  
  private async actionUpdateField(
    lead: Lead,
    config: Record<string, unknown>
  ): Promise<ActionResult> {
    const field = config.field as string;
    const value = config.value;
    
    // Validate field is allowed to be updated
    const allowedFields = ['status', 'lifecycle_stage', 'primary_intent'];
    
    if (!allowedFields.includes(field)) {
      return { action: 'update_field', success: false, reason: 'field_not_allowed' };
    }
    
    await db.execute(`
      UPDATE leads SET ${field} = $1, updated_at = NOW()
      WHERE id = $2
    `, [value, lead.id]);
    
    return { action: 'update_field', success: true, field, value };
  }
  
  private async actionRouteToPipeline(
    lead: Lead,
    config: Record<string, unknown>
  ): Promise<ActionResult> {
    const pipelineSlug = config.pipeline_slug as string;
    const createDeal = config.create_deal as boolean || false;
    
    const pipeline = await db.queryOne<{ id: string; name: string }>(`
      SELECT id, name FROM pipelines WHERE slug = $1
    `, [pipelineSlug]);
    
    if (!pipeline) {
      return { action: 'route_to_pipeline', success: false, reason: 'pipeline_not_found' };
    }
    
    // Update lead's pipeline
    await db.execute(`
      UPDATE leads 
      SET pipeline_id = $1, routing_status = 'routed', routed_at = NOW(), updated_at = NOW()
      WHERE id = $2
    `, [pipeline.id, lead.id]);
    
    // Create deal if requested
    if (createDeal) {
      const firstStage = await db.queryOne<{ id: string }>(`
        SELECT id FROM pipeline_stages 
        WHERE pipeline_id = $1 
        ORDER BY position ASC LIMIT 1
      `, [pipeline.id]);
      
      if (firstStage) {
        await db.execute(`
          INSERT INTO deals (lead_id, pipeline_id, stage_id, name, status)
          VALUES ($1, $2, $3, $4, 'open')
          ON CONFLICT (lead_id, pipeline_id) DO NOTHING
        `, [
          lead.id, 
          pipeline.id, 
          firstStage.id, 
          `${lead.first_name || ''} ${lead.last_name || ''} - ${lead.email}`.trim()
        ]);
      }
    }
    
    return { 
      action: 'route_to_pipeline', 
      success: true, 
      pipeline_id: pipeline.id,
      pipeline_name: pipeline.name 
    };
  }
  
  // ===========================================================================
  // Helper Methods
  // ===========================================================================
  
  private async getLeadDeal(leadId: string): Promise<Deal | undefined> {
    const deal = await db.queryOne<Deal>(`
      SELECT * FROM deals 
      WHERE lead_id = $1 AND status = 'open'
      ORDER BY created_at DESC
      LIMIT 1
    `, [leadId]);
    
    return deal || undefined;
  }
  
  private async getLead(leadId: string): Promise<Lead | null> {
    return await db.queryOne<Lead>(`
      SELECT * FROM leads WHERE id = $1
    `, [leadId]);
  }
  
  private async getNextAvailableOwner(
    role: string, 
    region?: string
  ): Promise<{ email: string; name: string } | null> {
    let query: string;
    let params: unknown[];
    
    if (region) {
      query = `
        SELECT email, name FROM team_members 
        WHERE role = $1 AND region = $2 AND is_active = TRUE 
        AND current_leads < max_leads
        ORDER BY current_leads ASC LIMIT 1
      `;
      params = [role, region];
    } else {
      query = `
        SELECT email, name FROM team_members 
        WHERE role = $1 AND is_active = TRUE 
        AND current_leads < max_leads
        ORDER BY current_leads ASC LIMIT 1
      `;
      params = [role];
    }
    
    return await db.queryOne<{ email: string; name: string }>(query, params);
  }
  
  private interpolateTemplate(
    template: string, 
    context: { lead: Lead; deal?: Deal }
  ): string {
    return template
      .replace(/{lead\.first_name}/g, context.lead.first_name || '')
      .replace(/{lead\.last_name}/g, context.lead.last_name || '')
      .replace(/{lead\.email}/g, context.lead.email)
      .replace(/{lead\.score}/g, String(context.lead.total_score))
      .replace(/{deal\.name}/g, context.deal?.name || '')
      .replace(/{deal\.value}/g, String(context.deal?.value || 0));
  }
  
  private buildNotificationMessage(
    template: string | undefined,
    lead: Lead,
    deal?: Deal
  ): string {
    if (!template) {
      return `Lead update: ${lead.first_name || ''} ${lead.last_name || ''} (${lead.email})`;
    }
    
    return this.interpolateTemplate(template, { lead, deal });
  }
  
  private daysSince(date: Date): number {
    const dateObj = date instanceof Date ? date : new Date(date);
    const diff = Date.now() - dateObj.getTime();
    return Math.floor(diff / (24 * 60 * 60 * 1000));
  }
  
  private async hasTriggeredForThreshold(
    ruleId: string, 
    leadId: string, 
    threshold: number
  ): Promise<boolean> {
    // Check if we've already logged this trigger
    const existing = await db.queryOne<{ id: string }>(`
      SELECT id FROM automation_logs 
      WHERE rule_id = $1 AND lead_id = $2 
      AND trigger_data->>'threshold' = $3
    `, [ruleId, leadId, String(threshold)]);
    
    return !!existing;
  }
  
  private async logAutomationExecution(
    rule: AutomationRule,
    lead: Lead,
    event?: MarketingEvent,
    result?: ActionResult
  ): Promise<void> {
    try {
      await db.execute(`
        INSERT INTO automation_logs (rule_id, lead_id, event_id, trigger_data, action_result)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        rule.id,
        lead.id,
        event?.id || null,
        JSON.stringify(rule.trigger_config),
        JSON.stringify(result || {})
      ]);
    } catch (error) {
      // Log but don't fail the automation
      console.error('[Automation Engine] Failed to log execution:', error);
    }
  }
  
  // ===========================================================================
  // Public Methods for Rules Management
  // ===========================================================================
  
  getRulesCount(): number {
    return this.rules.length;
  }
  
  getLoadedRules(): AutomationRule[] {
    return [...this.rules];
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let automationEngineInstance: AutomationEngine | null = null;

export function getAutomationEngine(): AutomationEngine {
  if (!automationEngineInstance) {
    automationEngineInstance = new AutomationEngine();
  }
  return automationEngineInstance;
}

export const automationEngine = {
  get instance() {
    return getAutomationEngine();
  }
};

export default automationEngine;
