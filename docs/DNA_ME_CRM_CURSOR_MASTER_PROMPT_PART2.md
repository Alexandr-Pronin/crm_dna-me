# 🧬 DNA ME - CURSOR MASTER PROMPT (PART 2)
## Продолжение: Automation Engine, Workers, Integrations, Project Structure

---

# 8. AUTOMATION RULES ENGINE (продолжение)

```typescript
// ============================================================================
// src/services/automationEngine.ts
// ============================================================================

import { db } from '../db';
import { Queue } from 'bullmq';
import { 
  AutomationRule, 
  Lead, 
  Deal, 
  MarketingEvent,
  AutomationActionType,
  PipelineStage
} from '../types';

export class AutomationEngine {
  private rules: AutomationRule[] = [];
  private syncQueue: Queue;
  private notificationQueue: Queue;
  
  constructor(syncQueue: Queue, notificationQueue: Queue) {
    this.syncQueue = syncQueue;
    this.notificationQueue = notificationQueue;
  }
  
  async loadRules(): Promise<void> {
    this.rules = await db.query(`
      SELECT * FROM automation_rules 
      WHERE is_active = TRUE 
      ORDER BY priority ASC
    `);
  }
  
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
          await db.query(`
            UPDATE automation_rules 
            SET last_executed = NOW(), execution_count = execution_count + 1
            WHERE id = $1
          `, [rule.id]);
          
        } catch (error) {
          results.rules_executed.push({
            rule_id: rule.id,
            rule_name: rule.name,
            action_type: rule.action_type,
            success: false,
            error: error.message
          });
        }
      }
    }
    
    return results;
  }
  
  /**
   * Process stage-specific automation when deal moves
   */
  async processStageChange(
    deal: Deal, 
    fromStage: PipelineStage, 
    toStage: PipelineStage
  ): Promise<AutomationResult> {
    const lead = await this.getLead(deal.lead_id);
    const results: AutomationResult = {
      lead_id: lead.id,
      rules_executed: [],
      actions_taken: []
    };
    
    // Get stage-specific automation rules
    const stageRules = toStage.automation_config || [];
    
    for (const ruleConfig of stageRules) {
      if (ruleConfig.trigger.type === 'stage_entered') {
        try {
          const actionResult = await this.executeStageAction(ruleConfig, lead, deal);
          results.actions_taken.push(actionResult);
        } catch (error) {
          console.error('Stage automation error:', error);
        }
      }
    }
    
    return results;
  }
  
  private async evaluateTrigger(
    rule: AutomationRule,
    lead: Lead,
    event: MarketingEvent,
    deal?: Deal
  ): Promise<boolean> {
    const config = rule.trigger_config;
    
    switch (rule.trigger_type) {
      case 'event':
        // Match event type
        if (config.event_type && event.event_type !== config.event_type) {
          return false;
        }
        // Match event metadata
        if (config.metadata) {
          for (const [key, value] of Object.entries(config.metadata)) {
            if (event.metadata?.[key] !== value) return false;
          }
        }
        return true;
        
      case 'score_threshold':
        // Check if score crosses threshold
        if (config.score_gte && lead.total_score >= config.score_gte) {
          // Ensure we haven't already triggered for this threshold
          const alreadyTriggered = await this.hasTriggeredForThreshold(
            rule.id, lead.id, config.score_gte
          );
          return !alreadyTriggered;
        }
        return false;
        
      case 'intent_detected':
        // Check intent matches
        if (config.intent && lead.primary_intent === config.intent) {
          if (config.confidence_gte && lead.intent_confidence >= config.confidence_gte) {
            return true;
          }
        }
        return false;
        
      case 'time_in_stage':
        // Check if deal has been in current stage too long
        if (deal && config.days) {
          const daysInStage = this.daysSince(deal.stage_entered_at);
          return daysInStage >= config.days;
        }
        return false;
        
      default:
        return false;
    }
  }
  
  private async executeAction(
    rule: AutomationRule,
    lead: Lead,
    event: MarketingEvent,
    deal?: Deal
  ): Promise<ActionResult> {
    const config = rule.action_config;
    
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
  
  // ═══════════════════════════════════════════════════════════════════════
  // ACTION IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════════════════
  
  private async actionMoveToStage(
    lead: Lead,
    deal: Deal | undefined,
    config: { target_stage: string; pipeline_id?: string }
  ): Promise<ActionResult> {
    if (!deal) {
      return { action: 'move_to_stage', success: false, reason: 'no_deal' };
    }
    
    const targetStage = await db.queryOne<PipelineStage>(`
      SELECT * FROM pipeline_stages 
      WHERE pipeline_id = $1 AND slug = $2
    `, [deal.pipeline_id, config.target_stage]);
    
    if (!targetStage) {
      return { action: 'move_to_stage', success: false, reason: 'stage_not_found' };
    }
    
    await db.query(`
      UPDATE deals 
      SET stage_id = $1, stage_entered_at = NOW(), updated_at = NOW()
      WHERE id = $2
    `, [targetStage.id, deal.id]);
    
    return { 
      action: 'move_to_stage', 
      success: true, 
      from_stage: deal.stage_id,
      to_stage: targetStage.id 
    };
  }
  
  private async actionAssignOwner(
    lead: Lead,
    deal: Deal | undefined,
    config: { role: string; strategy: string; region?: string }
  ): Promise<ActionResult> {
    let owner: { email: string; name: string } | null = null;
    
    switch (config.strategy) {
      case 'round_robin':
        owner = await this.getNextAvailableOwner(config.role, config.region);
        break;
        
      case 'capacity_based':
        owner = await this.getLeastLoadedOwner(config.role, config.region);
        break;
        
      case 'manual':
        // Don't auto-assign, just notify
        await this.notificationQueue.add('notify_assignment_needed', {
          lead_id: lead.id,
          deal_id: deal?.id,
          role: config.role
        });
        return { action: 'assign_owner', success: true, result: 'notification_sent' };
    }
    
    if (!owner) {
      return { action: 'assign_owner', success: false, reason: 'no_available_owner' };
    }
    
    // Update deal assignment
    if (deal) {
      await db.query(`
        UPDATE deals 
        SET assigned_to = $1, assigned_at = NOW(), updated_at = NOW()
        WHERE id = $2
      `, [owner.email, deal.id]);
    }
    
    // Increment owner's lead count
    await db.query(`
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
    config: { channel: string; template?: string; message?: string }
  ): Promise<ActionResult> {
    const message = config.message || this.buildNotificationMessage(config.template, lead, deal);
    
    await this.notificationQueue.add('send_slack', {
      channel: config.channel,
      message,
      lead_id: lead.id,
      deal_id: deal?.id
    });
    
    return { action: 'send_notification', success: true, channel: config.channel };
  }
  
  private async actionCreateTask(
    lead: Lead,
    deal: Deal | undefined,
    config: { title: string; task_type: string; due_days?: number; assigned_to?: string }
  ): Promise<ActionResult> {
    const title = this.interpolateTemplate(config.title, { lead, deal });
    const dueDate = config.due_days 
      ? new Date(Date.now() + config.due_days * 24 * 60 * 60 * 1000)
      : null;
    
    const assignedTo = config.assigned_to || deal?.assigned_to;
    
    const task = await db.queryOne(`
      INSERT INTO tasks (lead_id, deal_id, title, task_type, assigned_to, due_date)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [lead.id, deal?.id, title, config.task_type, assignedTo, dueDate]);
    
    return { action: 'create_task', success: true, task_id: task.id };
  }
  
  private async actionSyncMoco(
    lead: Lead,
    deal: Deal | undefined,
    config: { action: 'create_customer' | 'create_offer' | 'create_invoice' }
  ): Promise<ActionResult> {
    await this.syncQueue.add('moco_sync', {
      action: config.action,
      lead_id: lead.id,
      deal_id: deal?.id
    });
    
    return { action: 'sync_moco', success: true, queued: config.action };
  }
  
  private async actionUpdateField(
    lead: Lead,
    config: { field: string; value: any }
  ): Promise<ActionResult> {
    // Validate field is allowed to be updated
    const allowedFields = ['status', 'lifecycle_stage', 'primary_intent'];
    
    if (!allowedFields.includes(config.field)) {
      return { action: 'update_field', success: false, reason: 'field_not_allowed' };
    }
    
    await db.query(`
      UPDATE leads SET ${config.field} = $1, updated_at = NOW()
      WHERE id = $2
    `, [config.value, lead.id]);
    
    return { action: 'update_field', success: true, field: config.field, value: config.value };
  }
  
  private async actionRouteToPipeline(
    lead: Lead,
    config: { pipeline_slug: string; create_deal: boolean }
  ): Promise<ActionResult> {
    const pipeline = await db.queryOne(`
      SELECT * FROM pipelines WHERE slug = $1
    `, [config.pipeline_slug]);
    
    if (!pipeline) {
      return { action: 'route_to_pipeline', success: false, reason: 'pipeline_not_found' };
    }
    
    // Update lead's pipeline
    await db.query(`
      UPDATE leads 
      SET pipeline_id = $1, routing_status = 'routed', routed_at = NOW()
      WHERE id = $2
    `, [pipeline.id, lead.id]);
    
    // Create deal if requested
    if (config.create_deal) {
      const firstStage = await db.queryOne(`
        SELECT * FROM pipeline_stages 
        WHERE pipeline_id = $1 
        ORDER BY position ASC LIMIT 1
      `, [pipeline.id]);
      
      await db.query(`
        INSERT INTO deals (lead_id, pipeline_id, stage_id, name, status)
        VALUES ($1, $2, $3, $4, 'open')
        ON CONFLICT (lead_id, pipeline_id) DO NOTHING
      `, [lead.id, pipeline.id, firstStage.id, `${lead.first_name} ${lead.last_name}`]);
    }
    
    return { 
      action: 'route_to_pipeline', 
      success: true, 
      pipeline_id: pipeline.id,
      pipeline_name: pipeline.name 
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════
  
  private async getNextAvailableOwner(role: string, region?: string): Promise<{ email: string; name: string } | null> {
    const query = region
      ? `SELECT email, name FROM team_members 
         WHERE role = $1 AND region = $2 AND is_active = TRUE 
         AND current_leads < max_leads
         ORDER BY current_leads ASC LIMIT 1`
      : `SELECT email, name FROM team_members 
         WHERE role = $1 AND is_active = TRUE 
         AND current_leads < max_leads
         ORDER BY current_leads ASC LIMIT 1`;
    
    const params = region ? [role, region] : [role];
    return await db.queryOne(query, params);
  }
  
  private async getLeastLoadedOwner(role: string, region?: string): Promise<{ email: string; name: string } | null> {
    return this.getNextAvailableOwner(role, region); // Same logic for now
  }
  
  private interpolateTemplate(template: string, context: { lead: Lead; deal?: Deal }): string {
    return template
      .replace('{lead.first_name}', context.lead.first_name || '')
      .replace('{lead.last_name}', context.lead.last_name || '')
      .replace('{lead.email}', context.lead.email)
      .replace('{lead.score}', String(context.lead.total_score))
      .replace('{deal.name}', context.deal?.name || '')
      .replace('{deal.value}', String(context.deal?.value || 0));
  }
  
  private daysSince(date: Date): number {
    const diff = Date.now() - new Date(date).getTime();
    return Math.floor(diff / (24 * 60 * 60 * 1000));
  }
  
  private async hasTriggeredForThreshold(ruleId: string, leadId: string, threshold: number): Promise<boolean> {
    // Check if we've already logged this trigger
    const existing = await db.queryOne(`
      SELECT 1 FROM automation_logs 
      WHERE rule_id = $1 AND lead_id = $2 AND trigger_data->>'threshold' = $3
    `, [ruleId, leadId, String(threshold)]);
    
    return !!existing;
  }
}

// Types
interface AutomationResult {
  lead_id: string;
  rules_executed: {
    rule_id: string;
    rule_name: string;
    action_type: string;
    success: boolean;
    result?: any;
    error?: string;
  }[];
  actions_taken: ActionResult[];
}

interface ActionResult {
  action: string;
  success: boolean;
  [key: string]: any;
}
```

---

# 9. WORKERS & BACKGROUND JOBS

## 9.1 Event Processing Worker

```typescript
// ============================================================================
// src/workers/eventWorker.ts
// ============================================================================

import { Worker, Job } from 'bullmq';
import { db } from '../db';
import { ScoringEngine } from '../services/scoringEngine';
import { IntentDetector } from '../services/intentDetector';
import { AutomationEngine } from '../services/automationEngine';
import { EventProcessingJob, Lead, MarketingEvent } from '../types';
import { redisConnection } from '../config/redis';

export function createEventWorker(
  scoringEngine: ScoringEngine,
  intentDetector: IntentDetector,
  automationEngine: AutomationEngine
): Worker {
  
  const worker = new Worker<EventProcessingJob>(
    'events',
    async (job: Job<EventProcessingJob>) => {
      const { event_id, event_type, source, lead_identifier, metadata, occurred_at } = job.data;
      
      console.log(`Processing event ${event_id}: ${event_type} from ${source}`);
      
      try {
        // 1. Find or create lead
        const lead = await findOrCreateLead(lead_identifier, source);
        
        // 2. Store event
        const event = await storeEvent({
          id: event_id,
          lead_id: lead.id,
          event_type,
          source,
          metadata,
          occurred_at: new Date(occurred_at)
        });
        
        // 3. Update attribution
        await updateAttribution(lead, event);
        
        // 4. Process scoring
        const scoringResult = await scoringEngine.processEvent(event, lead);
        console.log(`Scoring: +${scoringResult.points_added} points, total: ${scoringResult.new_scores.total}`);
        
        // 5. Detect intent
        const intentResult = await intentDetector.processEvent(event, lead);
        if (intentResult.signals_detected.length > 0) {
          console.log(`Intent signals: ${intentResult.signals_detected.join(', ')}`);
        }
        
        // 6. Process automation rules
        const automationResult = await automationEngine.processEvent(lead, event);
        console.log(`Automation: ${automationResult.rules_executed.length} rules executed`);
        
        // 7. Mark event as processed
        await db.query(`
          UPDATE events SET processed_at = NOW() WHERE id = $1
        `, [event_id]);
        
        // 8. Update lead's last activity
        await db.query(`
          UPDATE leads SET last_activity = NOW(), updated_at = NOW() WHERE id = $1
        `, [lead.id]);
        
        return {
          success: true,
          lead_id: lead.id,
          scoring: scoringResult,
          intent: intentResult,
          automation: automationResult
        };
        
      } catch (error) {
        console.error(`Error processing event ${event_id}:`, error);
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 10,  // Process 10 events concurrently
      limiter: {
        max: 100,       // Max 100 jobs
        duration: 1000  // Per second
      }
    }
  );
  
  worker.on('completed', (job) => {
    console.log(`Event ${job.id} processed successfully`);
  });
  
  worker.on('failed', (job, error) => {
    console.error(`Event ${job?.id} failed:`, error);
  });
  
  return worker;
}

// ═══════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

async function findOrCreateLead(
  identifier: Record<string, string>,
  source: string
): Promise<Lead> {
  // Try to find by email first (most reliable)
  if (identifier.email) {
    const existing = await db.queryOne<Lead>(`
      SELECT * FROM leads WHERE email = $1
    `, [identifier.email]);
    
    if (existing) {
      // Update external IDs if provided
      await updateLeadIdentifiers(existing.id, identifier);
      return existing;
    }
  }
  
  // Try other identifiers
  for (const [key, value] of Object.entries(identifier)) {
    if (key !== 'email' && value) {
      const field = `${key}`;  // portal_id, waalaxy_id, etc.
      const existing = await db.queryOne<Lead>(`
        SELECT * FROM leads WHERE ${field} = $1
      `, [value]);
      
      if (existing) {
        await updateLeadIdentifiers(existing.id, identifier);
        return existing;
      }
    }
  }
  
  // Create new lead
  const newLead = await db.queryOne<Lead>(`
    INSERT INTO leads (
      email, portal_id, waalaxy_id, linkedin_url,
      status, lifecycle_stage, routing_status,
      first_touch_source, first_touch_date
    ) VALUES (
      $1, $2, $3, $4,
      'new', 'lead', 'unrouted',
      $5, NOW()
    )
    RETURNING *
  `, [
    identifier.email || `unknown+${Date.now()}@temp.dna-me.com`,
    identifier.portal_id,
    identifier.waalaxy_id,
    identifier.linkedin_url,
    source
  ]);
  
  console.log(`Created new lead: ${newLead.id}`);
  return newLead;
}

async function updateLeadIdentifiers(leadId: string, identifiers: Record<string, string>): Promise<void> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  for (const [key, value] of Object.entries(identifiers)) {
    if (value && ['portal_id', 'waalaxy_id', 'linkedin_url', 'lemlist_id'].includes(key)) {
      updates.push(`${key} = COALESCE(${key}, $${paramIndex})`);
      values.push(value);
      paramIndex++;
    }
  }
  
  if (updates.length > 0) {
    values.push(leadId);
    await db.query(`
      UPDATE leads SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
    `, values);
  }
}

async function storeEvent(event: Partial<MarketingEvent>): Promise<MarketingEvent> {
  return await db.queryOne<MarketingEvent>(`
    INSERT INTO events (id, lead_id, event_type, source, metadata, occurred_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [event.id, event.lead_id, event.event_type, event.source, event.metadata, event.occurred_at]);
}

async function updateAttribution(lead: Lead, event: MarketingEvent): Promise<void> {
  // Always update last touch
  await db.query(`
    UPDATE leads SET
      last_touch_source = $1,
      last_touch_campaign = $2,
      last_touch_date = $3
    WHERE id = $4
  `, [event.source, event.utm_campaign, event.occurred_at, lead.id]);
  
  // First touch only if not set
  if (!lead.first_touch_source) {
    await db.query(`
      UPDATE leads SET
        first_touch_source = $1,
        first_touch_campaign = $2,
        first_touch_date = $3
      WHERE id = $4 AND first_touch_source IS NULL
    `, [event.source, event.utm_campaign, event.occurred_at, lead.id]);
  }
}
```

## 9.2 Routing Worker

```typescript
// ============================================================================
// src/workers/routingWorker.ts
// ============================================================================

import { Worker, Job } from 'bullmq';
import { PipelineRouter } from '../services/pipelineRouter';
import { RoutingJob } from '../types';
import { redisConnection } from '../config/redis';

export function createRoutingWorker(router: PipelineRouter): Worker {
  
  const worker = new Worker<RoutingJob>(
    'routing',
    async (job: Job<RoutingJob>) => {
      const { lead_id, trigger } = job.data;
      
      console.log(`Evaluating routing for lead ${lead_id} (trigger: ${trigger})`);
      
      const lead = await router.getLead(lead_id);
      
      if (!lead) {
        console.warn(`Lead ${lead_id} not found`);
        return { success: false, reason: 'lead_not_found' };
      }
      
      const result = await router.evaluateAndRoute(lead);
      
      console.log(`Routing result for ${lead_id}: ${result.action} - ${result.reason}`);
      
      return result;
    },
    {
      connection: redisConnection,
      concurrency: 5
    }
  );
  
  return worker;
}
```

## 9.3 Score Decay Worker (Scheduled)

```typescript
// ============================================================================
// src/workers/decayWorker.ts
// ============================================================================

import { Queue, Worker } from 'bullmq';
import { db } from '../db';
import { redisConnection } from '../config/redis';

export function setupDecayJob(queue: Queue): void {
  // Schedule daily at 2 AM
  queue.add(
    'score_decay',
    {},
    {
      repeat: {
        pattern: '0 2 * * *'  // Cron: 2:00 AM daily
      }
    }
  );
}

export function createDecayWorker(): Worker {
  const worker = new Worker(
    'scheduled',
    async (job) => {
      if (job.name === 'score_decay') {
        console.log('Running daily score decay job...');
        
        const result = await db.queryOne<{ expired_count: number; leads_updated: number }>(`
          SELECT * FROM expire_old_scores()
        `);
        
        console.log(`Score decay complete: ${result.expired_count} scores expired, ${result.leads_updated} leads updated`);
        
        return result;
      }
    },
    { connection: redisConnection }
  );
  
  return worker;
}
```

## 9.4 Sync Worker (Moco, Slack)

```typescript
// ============================================================================
// src/workers/syncWorker.ts
// ============================================================================

import { Worker, Job } from 'bullmq';
import { MocoService } from '../integrations/moco';
import { SlackService } from '../integrations/slack';
import { SyncJob } from '../types';
import { redisConnection } from '../config/redis';
import { db } from '../db';

export function createSyncWorker(
  mocoService: MocoService,
  slackService: SlackService
): Worker {
  
  const worker = new Worker<SyncJob>(
    'sync',
    async (job: Job<SyncJob>) => {
      const { entity_type, entity_id, target, action } = job.data;
      
      console.log(`Sync job: ${action} ${entity_type} ${entity_id} to ${target}`);
      
      try {
        switch (target) {
          case 'moco':
            return await processMocoSync(mocoService, entity_type, entity_id, action);
            
          case 'slack':
            return await processSlackSync(slackService, job.data);
            
          default:
            throw new Error(`Unknown sync target: ${target}`);
        }
      } catch (error) {
        console.error(`Sync error:`, error);
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 3,
      limiter: {
        max: 10,
        duration: 1000
      }
    }
  );
  
  return worker;
}

async function processMocoSync(
  moco: MocoService,
  entityType: string,
  entityId: string,
  action: string
): Promise<any> {
  switch (action) {
    case 'create_customer': {
      const lead = await db.queryOne(`
        SELECT l.*, o.name as org_name, o.vat_id 
        FROM leads l
        LEFT JOIN organizations o ON l.organization_id = o.id
        WHERE l.id = $1
      `, [entityId]);
      
      const mocoId = await moco.createCustomer({
        name: lead.org_name || `${lead.first_name} ${lead.last_name}`,
        email: lead.email,
        vat_id: lead.vat_id
      });
      
      await db.query(`
        UPDATE organizations SET moco_id = $1 WHERE id = $2
      `, [mocoId, lead.organization_id]);
      
      return { moco_id: mocoId };
    }
    
    case 'create_offer': {
      const deal = await db.queryOne(`
        SELECT d.*, l.email, o.moco_id as customer_moco_id
        FROM deals d
        JOIN leads l ON d.lead_id = l.id
        LEFT JOIN organizations o ON l.organization_id = o.id
        WHERE d.id = $1
      `, [entityId]);
      
      const offerId = await moco.createOffer({
        customer_id: deal.customer_moco_id,
        title: deal.name,
        value: deal.value
      });
      
      await db.query(`
        UPDATE deals SET moco_offer_id = $1 WHERE id = $2
      `, [offerId, entityId]);
      
      return { moco_offer_id: offerId };
    }
    
    default:
      throw new Error(`Unknown Moco action: ${action}`);
  }
}

async function processSlackSync(slack: SlackService, data: any): Promise<any> {
  // Handle various Slack notifications
  if (data.channel && data.message) {
    await slack.sendMessage(data.channel, data.message);
    return { sent: true };
  }
  
  return { sent: false };
}
```

---

# 10. INTEGRATIONS (MOCO, SLACK)

## 10.1 Moco Integration

```typescript
// ============================================================================
// src/integrations/moco.ts
// German Finance System Integration
// ============================================================================

import axios, { AxiosInstance } from 'axios';

export class MocoService {
  private client: AxiosInstance;
  
  constructor(apiKey: string, subdomain: string) {
    this.client = axios.create({
      baseURL: `https://${subdomain}.mocoapp.com/api/v1`,
      headers: {
        'Authorization': `Token token=${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }
  
  /**
   * Create a customer in Moco
   */
  async createCustomer(data: {
    name: string;
    email?: string;
    vat_id?: string;
    address?: string;
    country?: string;
  }): Promise<string> {
    const response = await this.client.post('/customers', {
      name: data.name,
      email: data.email,
      vat_identifier: data.vat_id,
      address: data.address,
      country_code: data.country || 'DE'
    });
    
    return response.data.id;
  }
  
  /**
   * Create an offer/quote in Moco
   */
  async createOffer(data: {
    customer_id: string;
    title: string;
    value: number;
    items?: Array<{ title: string; quantity: number; unit_price: number }>;
  }): Promise<string> {
    const response = await this.client.post('/offers', {
      customer_id: data.customer_id,
      title: data.title,
      date: new Date().toISOString().split('T')[0],
      items: data.items || [{
        title: data.title,
        quantity: 1,
        unit_price: data.value,
        net_total: data.value
      }]
    });
    
    return response.data.id;
  }
  
  /**
   * Create an invoice from an offer
   */
  async createInvoiceFromOffer(offerId: string): Promise<string> {
    const response = await this.client.post(`/offers/${offerId}/create_invoice`);
    return response.data.id;
  }
  
  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string): Promise<any> {
    const response = await this.client.get(`/customers/${customerId}`);
    return response.data;
  }
  
  /**
   * Search customers by email
   */
  async findCustomerByEmail(email: string): Promise<any | null> {
    const response = await this.client.get('/customers', {
      params: { email }
    });
    
    return response.data.length > 0 ? response.data[0] : null;
  }
}
```

## 10.2 Slack Integration

```typescript
// ============================================================================
// src/integrations/slack.ts
// ============================================================================

import axios from 'axios';

export class SlackService {
  private webhookUrl: string;
  private botToken?: string;
  
  constructor(webhookUrl: string, botToken?: string) {
    this.webhookUrl = webhookUrl;
    this.botToken = botToken;
  }
  
  /**
   * Send message via webhook (simple)
   */
  async sendMessage(channel: string, text: string): Promise<void> {
    await axios.post(this.webhookUrl, {
      channel,
      text,
      unfurl_links: false
    });
  }
  
  /**
   * Send rich message with blocks
   */
  async sendRichMessage(channel: string, blocks: any[], text?: string): Promise<void> {
    await axios.post(this.webhookUrl, {
      channel,
      text: text || 'New notification',
      blocks
    });
  }
  
  /**
   * Send hot lead alert
   */
  async sendHotLeadAlert(lead: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    job_title?: string;
    total_score: number;
    primary_intent?: string;
    intent_confidence: number;
  }): Promise<void> {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔥 New Hot Lead!',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Name:*\n${lead.first_name || ''} ${lead.last_name || ''}`
          },
          {
            type: 'mrkdwn',
            text: `*Score:*\n${lead.total_score} points`
          },
          {
            type: 'mrkdwn',
            text: `*Email:*\n${lead.email}`
          },
          {
            type: 'mrkdwn',
            text: `*Intent:*\n${lead.primary_intent || 'Unknown'} (${lead.intent_confidence}%)`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Title:* ${lead.job_title || 'N/A'}`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '👤 View Lead' },
            url: `https://crm.dna-me.com/leads/${lead.id}`,
            style: 'primary'
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '📞 Call Now' },
            action_id: 'call_lead'
          }
        ]
      }
    ];
    
    await this.sendRichMessage('#hot-leads', blocks, `Hot Lead: ${lead.email}`);
  }
  
  /**
   * Send routing conflict notification
   */
  async sendRoutingConflict(lead: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    total_score: number;
    intent_summary: { research: number; b2b: number; co_creation: number };
  }): Promise<void> {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚠️ Routing Decision Required',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Lead *${lead.first_name} ${lead.last_name}* (${lead.email}) has ambiguous intent.\n\n` +
                `*Intent Signals:*\n` +
                `• 🔬 Research: ${lead.intent_summary.research} pts\n` +
                `• 🏢 B2B: ${lead.intent_summary.b2b} pts\n` +
                `• 🤝 Co-Creation: ${lead.intent_summary.co_creation} pts`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '🔬 Research' },
            action_id: `route_${lead.id}_research`,
            value: 'research'
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '🏢 B2B' },
            action_id: `route_${lead.id}_b2b`,
            value: 'b2b'
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '🤝 Co-Creation' },
            action_id: `route_${lead.id}_cocreation`,
            value: 'co_creation'
          }
        ]
      }
    ];
    
    await this.sendRichMessage('#lead-routing', blocks, `Routing needed: ${lead.email}`);
  }
  
  /**
   * Send daily digest
   */
  async sendDailyDigest(stats: {
    new_leads: number;
    hot_leads: number;
    deals_created: number;
    deals_won: number;
    total_value: number;
    top_sources: Array<{ source: string; count: number }>;
  }): Promise<void> {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 Daily Marketing Digest',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*New Leads:*\n${stats.new_leads}` },
          { type: 'mrkdwn', text: `*Hot Leads:*\n${stats.hot_leads}` },
          { type: 'mrkdwn', text: `*Deals Created:*\n${stats.deals_created}` },
          { type: 'mrkdwn', text: `*Deals Won:*\n${stats.deals_won}` }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Total Pipeline Value:* €${stats.total_value.toLocaleString()}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Top Lead Sources:*\n` +
                stats.top_sources.map((s, i) => `${i + 1}. ${s.source}: ${s.count}`).join('\n')
        }
      }
    ];
    
    await this.sendRichMessage('#marketing-daily', blocks, 'Daily Marketing Digest');
  }
}
```

---

# 11. PROJECT STRUCTURE

```
dna-marketing-engine/
│
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── events.ts           # POST /events/ingest, /leads/bulk
│   │   │   ├── leads.ts            # CRUD leads, search, filters
│   │   │   ├── pipelines.ts        # Pipeline & stage management
│   │   │   ├── deals.ts            # Deal CRUD, move, close
│   │   │   ├── scoring.ts          # Scoring rules admin
│   │   │   ├── routing.ts          # Routing config & manual routing
│   │   │   ├── automation.ts       # Automation rules admin
│   │   │   ├── tasks.ts            # Task management
│   │   │   ├── team.ts             # Team member management
│   │   │   ├── reports.ts          # Analytics & reports
│   │   │   ├── integrations.ts     # Moco webhooks, status
│   │   │   └── gdpr.ts             # Export, delete
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.ts             # JWT verification
│   │   │   ├── hmac.ts             # Webhook signature validation
│   │   │   ├── rateLimit.ts        # Per-source rate limiting
│   │   │   └── errorHandler.ts     # Global error handling
│   │   │
│   │   └── index.ts                # Fastify app setup
│   │
│   ├── services/
│   │   ├── leadService.ts          # Lead CRUD, deduplication
│   │   ├── scoringEngine.ts        # Score calculation
│   │   ├── intentDetector.ts       # Intent signal detection
│   │   ├── pipelineRouter.ts       # Smart routing logic
│   │   ├── automationEngine.ts     # Automation rule execution
│   │   ├── dealService.ts          # Deal management
│   │   └── reportService.ts        # Analytics calculations
│   │
│   ├── workers/
│   │   ├── eventWorker.ts          # Event processing
│   │   ├── routingWorker.ts        # Pipeline routing
│   │   ├── syncWorker.ts           # Moco/Slack sync
│   │   ├── decayWorker.ts          # Daily score decay
│   │   └── index.ts                # Worker setup
│   │
│   ├── integrations/
│   │   ├── moco.ts                 # Moco API client
│   │   ├── slack.ts                # Slack notifications
│   │   └── index.ts
│   │
│   ├── db/
│   │   ├── index.ts                # Database connection pool
│   │   ├── migrations/
│   │   │   ├── 001_initial.sql
│   │   │   ├── 002_intent_signals.sql
│   │   │   └── ...
│   │   └── seeds/
│   │       ├── pipelines.sql
│   │       ├── scoring_rules.sql
│   │       └── team_members.sql
│   │
│   ├── config/
│   │   ├── index.ts                # Environment config
│   │   ├── redis.ts                # Redis connection
│   │   ├── intentRules.ts          # Intent detection rules
│   │   ├── scoringRules.ts         # Default scoring rules
│   │   └── routingConfig.ts        # Routing thresholds
│   │
│   ├── types/
│   │   ├── index.ts                # All TypeScript types
│   │   ├── events.ts
│   │   ├── leads.ts
│   │   └── pipelines.ts
│   │
│   └── index.ts                    # Main entry point
│
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── tests/
│   ├── unit/
│   │   ├── scoringEngine.test.ts
│   │   ├── intentDetector.test.ts
│   │   └── pipelineRouter.test.ts
│   └── integration/
│       ├── eventProcessing.test.ts
│       └── routing.test.ts
│
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

# 12. IMPLEMENTATION ORDER

## Phase 1: Core Foundation (Week 1-2)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ WEEK 1-2: FOUNDATION                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Day 1-2: Project Setup                                                      │
│ ├── Initialize Node.js project with TypeScript                              │
│ ├── Configure Fastify with plugins (CORS, JWT)                              │
│ ├── Set up PostgreSQL with docker-compose                                   │
│ ├── Set up Redis with docker-compose                                        │
│ └── Create database schema (run migrations)                                 │
│                                                                             │
│ Day 3-4: Core Data Layer                                                    │
│ ├── Database connection pool (pg)                                           │
│ ├── Lead service (CRUD, findByEmail, deduplication)                         │
│ ├── Organization service (CRUD)                                             │
│ └── Basic API routes: GET/POST /leads                                       │
│                                                                             │
│ Day 5-7: Event Ingestion                                                    │
│ ├── POST /events/ingest endpoint                                            │
│ ├── HMAC signature validation middleware                                    │
│ ├── BullMQ queue setup                                                      │
│ ├── Event worker (basic: store event, update last_activity)                 │
│ └── POST /leads/bulk for CSV import                                         │
│                                                                             │
│ Day 8-10: Pipeline & Deals                                                  │
│ ├── Pipeline service (list, get with stages)                                │
│ ├── Deal service (create, move stage, close)                                │
│ ├── Seed data for 3 pipelines + Discovery                                   │
│ └── API routes: /pipelines, /deals                                          │
│                                                                             │
│ ✓ MILESTONE: Can ingest events, create leads, manage deals                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Phase 2: Scoring & Intent (Week 3-4)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ WEEK 3-4: SCORING & INTENT DETECTION                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Day 11-13: Scoring Engine                                                   │
│ ├── Scoring rules configuration (JSON → DB)                                 │
│ ├── ScoringEngine class (processEvent, matchConditions)                     │
│ ├── Score history table management                                          │
│ ├── Denormalized score updates on leads                                     │
│ └── Rate limiting (maxPerDay, maxPerLead)                                   │
│                                                                             │
│ Day 14-16: Intent Detection                                                 │
│ ├── Intent rules configuration                                              │
│ ├── IntentDetector class (detectSignals)                                    │
│ ├── Intent signals table storage                                            │
│ ├── Confidence calculation algorithm                                        │
│ └── Update lead.primary_intent, intent_confidence                           │
│                                                                             │
│ Day 17-19: Smart Routing                                                    │
│ ├── PipelineRouter class                                                    │
│ ├── Global Lead Pool logic (pipeline_id = NULL)                             │
│ ├── Routing rules (score + intent → pipeline)                               │
│ ├── Owner assignment (round robin, capacity)                                │
│ └── Routing worker (evaluate on score change)                               │
│                                                                             │
│ Day 20-21: Score Decay                                                      │
│ ├── expire_old_scores() function                                            │
│ ├── Decay worker (daily cron)                                               │
│ └── Recalculate affected leads                                              │
│                                                                             │
│ ✓ MILESTONE: Full scoring, intent detection, smart routing                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Phase 3: Automation & Integrations (Week 5-6)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ WEEK 5-6: AUTOMATION & INTEGRATIONS                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Day 22-24: Automation Engine                                                │
│ ├── AutomationEngine class                                                  │
│ ├── Trigger evaluation (event, score_threshold, intent_detected)            │
│ ├── Action execution (move_stage, assign_owner, create_task)                │
│ ├── Stage-specific automation                                               │
│ └── Automation rules admin API                                              │
│                                                                             │
│ Day 25-27: Slack Integration                                                │
│ ├── SlackService class                                                      │
│ ├── Hot lead alerts                                                         │
│ ├── Routing conflict notifications                                          │
│ ├── Daily digest                                                            │
│ └── Interactive buttons (route actions)                                     │
│                                                                             │
│ Day 28-30: Moco Integration                                                 │
│ ├── MocoService class                                                       │
│ ├── Create customer on deal won                                             │
│ ├── Create offer/invoice                                                    │
│ ├── Sync worker for Moco jobs                                               │
│ └── Moco webhook receiver (payment status)                                  │
│                                                                             │
│ ✓ MILESTONE: Full automation, Slack alerts, Moco sync                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Phase 4: Polish & Deploy (Week 7-8)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ WEEK 7-8: POLISH & DEPLOY                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Day 31-33: Reports & Analytics                                              │
│ ├── Leads by score tier                                                     │
│ ├── Leads by intent                                                         │
│ ├── Pipeline funnel metrics                                                 │
│ ├── Campaign attribution                                                    │
│ └── Routing effectiveness report                                            │
│                                                                             │
│ Day 34-36: GDPR & Tasks                                                     │
│ ├── GDPR export (all lead data as JSON)                                     │
│ ├── GDPR delete (cascade + anonymize)                                       │
│ ├── Task management API                                                     │
│ └── Team member management                                                  │
│                                                                             │
│ Day 37-39: Testing & Documentation                                          │
│ ├── Unit tests for scoring, intent, routing                                 │
│ ├── Integration tests for event flow                                        │
│ ├── API documentation (OpenAPI)                                             │
│ └── README with setup instructions                                          │
│                                                                             │
│ Day 40-42: Deployment                                                       │
│ ├── Dockerfile optimization                                                 │
│ ├── Production docker-compose                                               │
│ ├── Environment configuration                                               │
│ ├── Health checks & monitoring                                              │
│ └── Deploy to server                                                        │
│                                                                             │
│ ✓ MILESTONE: Production-ready CRM deployed                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 13. DOCKER SETUP

## docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: dna_postgres
    environment:
      POSTGRES_DB: dna_marketing
      POSTGRES_USER: dna
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-devpassword}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./src/db/migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dna -d dna_marketing"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: dna_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: docker/Dockerfile
    container_name: dna_api
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgres://dna:${POSTGRES_PASSWORD:-devpassword}@postgres:5432/dna_marketing
      REDIS_URL: redis://redis:6379
      MOCO_API_KEY: ${MOCO_API_KEY}
      MOCO_SUBDOMAIN: ${MOCO_SUBDOMAIN}
      SLACK_WEBHOOK_URL: ${SLACK_WEBHOOK_URL}
      WEBHOOK_SECRET: ${WEBHOOK_SECRET}
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  workers:
    build:
      context: .
      dockerfile: docker/Dockerfile
    container_name: dna_workers
    command: ["npm", "run", "workers"]
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://dna:${POSTGRES_PASSWORD:-devpassword}@postgres:5432/dna_marketing
      REDIS_URL: redis://redis:6379
      MOCO_API_KEY: ${MOCO_API_KEY}
      MOCO_SUBDOMAIN: ${MOCO_SUBDOMAIN}
      SLACK_WEBHOOK_URL: ${SLACK_WEBHOOK_URL}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

## Dockerfile

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

---

# 14. ENVIRONMENT VARIABLES

```bash
# .env.example

# Database
DATABASE_URL=postgres://dna:password@localhost:5432/dna_marketing
POSTGRES_PASSWORD=your_secure_password

# Redis
REDIS_URL=redis://localhost:6379

# API
PORT=3000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_min_32_chars
WEBHOOK_SECRET=your_webhook_hmac_secret

# Moco (German Finance)
MOCO_API_KEY=your_moco_api_key
MOCO_SUBDOMAIN=your_company

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz
SLACK_BOT_TOKEN=xoxb-xxx  # Optional, for advanced features

# Feature Flags
ENABLE_MOCO_SYNC=true
ENABLE_SLACK_ALERTS=true
ENABLE_SCORE_DECAY=true
```

---

# 15. QUICK START FOR CURSOR

## Шаг 1: Создай проект

```bash
mkdir dna-marketing-engine && cd dna-marketing-engine
npm init -y
```

## Шаг 2: Установи зависимости

```bash
# Core
npm install fastify @fastify/cors @fastify/jwt
npm install bullmq ioredis pg
npm install zod dayjs uuid axios

# Dev
npm install -D typescript @types/node @types/pg tsx vitest
npm install -D drizzle-orm drizzle-kit  # Optional: for ORM
```

## Шаг 3: Создай tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Шаг 4: Добавь scripts в package.json

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "workers": "tsx src/workers/index.ts",
    "migrate": "tsx src/db/migrate.ts",
    "seed": "tsx src/db/seed.ts",
    "test": "vitest"
  }
}
```

## Шаг 5: Запусти Docker

```bash
docker-compose up -d postgres redis
```

## Шаг 6: Примени миграции

```bash
psql $DATABASE_URL < src/db/migrations/001_initial.sql
npm run seed
```

## Шаг 7: Запусти разработку

```bash
# Terminal 1: API
npm run dev

# Terminal 2: Workers
npm run workers
```

---

# 16. КЛЮЧЕВЫЕ КОМАНДЫ ДЛЯ CURSOR

Когда просишь Cursor реализовать что-то, используй эти промпты:

### Создать Event Ingestion:
```
Create POST /api/v1/events/ingest endpoint that:
1. Validates HMAC signature from X-Webhook-Signature header
2. Validates event schema with Zod
3. Adds event to BullMQ 'events' queue
4. Returns 202 Accepted with event_id

Use Fastify, see types in src/types/index.ts
```

### Создать Scoring Engine:
```
Implement ScoringEngine class in src/services/scoringEngine.ts:
1. Load scoring rules from DB
2. processEvent(event, lead) - match rules, apply points
3. canApplyRule(rule, leadId) - check rate limits
4. applyScore() - insert score_history, update lead
5. checkTriggers() - fire hot_lead_alert if score >= 80

Use PostgreSQL queries, see schema in Part 1 document
```

### Создать Intent Detector:
```
Implement IntentDetector class:
1. Load intent rules from config
2. processEvent(event, lead) - detect signals
3. Store signals in intent_signals table
4. Calculate confidence with calculateIntentConfidence()
5. Update lead.primary_intent, intent_confidence

See intent rules in section 3.3 of Part 1
```

### Создать Pipeline Router:
```
Implement PipelineRouter class:
1. evaluateAndRoute(lead) - main routing logic
2. Check: score >= 40 AND intent_confidence >= 60%
3. Route to pipeline based on primary_intent
4. Handle conflicts - notify Slack
5. Assign owner based on role/region

See routing logic in section 3.5 of Part 1
```

---

**END OF PART 2**

Теперь у тебя есть полная спецификация для разработки CRM в Cursor!
