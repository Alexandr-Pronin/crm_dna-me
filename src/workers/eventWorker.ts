// =============================================================================
// src/workers/eventWorker.ts
// BullMQ Worker for Processing Marketing Events
// =============================================================================

import { Worker, Job } from 'bullmq';
import { redisOptions } from '../config/redis.js';
import { QUEUE_NAMES, getRoutingQueue } from '../config/queues.js';
import { db } from '../db/index.js';
import { getScoringEngine, type ScoringEngine } from '../services/scoringEngine.js';
import { getIntentDetector, type IntentDetector } from '../services/intentDetector.js';
import { getAutomationEngine, type AutomationEngine } from '../services/automationEngine.js';
import { meetsRoutingThresholds } from '../config/routingConfig.js';
import type { EventProcessingJob, Lead, MarketingEvent, LeadIdentifier, RoutingJob } from '../types/index.js';

// =============================================================================
// Worker Factory
// =============================================================================

export function createEventWorker(
  scoringEngine?: ScoringEngine,
  intentDetector?: IntentDetector,
  automationEngine?: AutomationEngine
): Worker<EventProcessingJob> {
  // Use provided engines or get the singletons
  const engine = scoringEngine || getScoringEngine();
  const detector = intentDetector || getIntentDetector();
  const automation = automationEngine || getAutomationEngine();
  
  const worker = new Worker<EventProcessingJob>(
    QUEUE_NAMES.EVENTS,
    async (job: Job<EventProcessingJob>) => {
      const { event_id, event_type, source, lead_identifier, metadata, occurred_at } = job.data;
      
      console.log(`[Event Worker] Processing ${event_id}: ${event_type} from ${source}`);
      
      try {
        // 1. Find or create lead
        const lead = await findOrCreateLead(lead_identifier, source, metadata);
        console.log(`[Event Worker] Lead: ${lead.id} (${lead.email})`);
        
        // 2. Store event
        const event = await storeEvent({
          id: event_id,
          lead_id: lead.id,
          event_type,
          event_category: metadata.event_category as string,
          source,
          metadata,
          campaign_id: metadata.campaign_id as string,
          utm_source: metadata.utm_source as string,
          utm_medium: metadata.utm_medium as string,
          utm_campaign: metadata.utm_campaign as string,
          correlation_id: metadata.correlation_id as string,
          occurred_at: new Date(occurred_at)
        });
        console.log(`[Event Worker] Event stored: ${event.id}`);
        
        // 3. Update attribution
        await updateAttribution(lead, event);
        
        // 4. Update lead's last activity
        await db.execute(`
          UPDATE leads SET last_activity = NOW(), updated_at = NOW() WHERE id = $1
        `, [lead.id]);
        
        // 5. Mark event as processed
        await db.execute(`
          UPDATE events SET processed_at = NOW() WHERE id = $1
        `, [event_id]);
        
        // 6. Process scoring
        let scoringResult = null;
        try {
          scoringResult = await engine.processEvent(event, lead);
          console.log(`[Event Worker] Scoring: ${scoringResult.rules_matched.length} rules matched, +${scoringResult.points_added} points, total: ${scoringResult.new_scores.total} (${scoringResult.score_tier})`);
        } catch (scoringError) {
          console.error(`[Event Worker] Scoring error:`, scoringError);
          // Continue processing - scoring failure shouldn't stop event processing
        }
        
        // 7. Process intent detection
        let intentResult = null;
        try {
          // Reload lead to get updated scores
          const updatedLead = await db.queryOne<Lead>(`
            SELECT * FROM leads WHERE id = $1
          `, [lead.id]);
          
          if (updatedLead) {
            intentResult = await detector.processEvent(event, updatedLead);
            if (intentResult.signals_detected.length > 0) {
              console.log(`[Event Worker] Intent: ${intentResult.signals_detected.length} signals detected, primary=${intentResult.primary_intent}, confidence=${intentResult.intent_confidence}%, routable=${intentResult.is_routable}`);
            }
          }
        } catch (intentError) {
          console.error(`[Event Worker] Intent detection error:`, intentError);
          // Continue processing - intent failure shouldn't stop event processing
        }
        
        // 8. Process automation rules
        let automationResult = null;
        try {
          // Reload lead to get updated data for automation
          const leadForAutomation = await db.queryOne<Lead>(`
            SELECT * FROM leads WHERE id = $1
          `, [lead.id]);
          
          if (leadForAutomation) {
            automationResult = await automation.processEvent(leadForAutomation, event);
            if (automationResult.rules_executed.length > 0) {
              console.log(`[Event Worker] Automation: ${automationResult.rules_executed.length} rules executed`);
            }
          }
        } catch (automationError) {
          console.error(`[Event Worker] Automation error:`, automationError);
          // Continue processing - automation failure shouldn't stop event processing
        }
        
        // 9. Queue routing evaluation if thresholds are met
        let routingQueued = false;
        try {
          // Reload lead to get final scores
          const finalLead = await db.queryOne<Lead>(`
            SELECT * FROM leads WHERE id = $1
          `, [lead.id]);
          
          if (finalLead && 
              finalLead.routing_status === 'unrouted' &&
              meetsRoutingThresholds(finalLead.total_score, finalLead.intent_confidence)) {
            
            const routingQueue = getRoutingQueue();
            await routingQueue.add('evaluate', {
              lead_id: lead.id,
              trigger: 'score_change'
            } as RoutingJob, {
              jobId: `routing-${lead.id}-${Date.now()}`
            });
            
            routingQueued = true;
            console.log(`[Event Worker] Queued routing evaluation for lead ${lead.id}`);
          }
        } catch (routingError) {
          console.error(`[Event Worker] Failed to queue routing:`, routingError);
          // Continue - routing failure shouldn't stop event processing
        }
        
        return {
          success: true,
          lead_id: lead.id,
          event_id: event.id,
          event_type,
          source,
          scoring: scoringResult ? {
            rules_matched: scoringResult.rules_matched,
            points_added: scoringResult.points_added,
            new_total: scoringResult.new_scores.total,
            score_tier: scoringResult.score_tier
          } : null,
          intent: intentResult ? {
            signals_detected: intentResult.signals_detected,
            primary_intent: intentResult.primary_intent,
            intent_confidence: intentResult.intent_confidence,
            is_routable: intentResult.is_routable,
            conflict_detected: intentResult.conflict_detected
          } : null,
          automation: automationResult ? {
            rules_executed: automationResult.rules_executed.length,
            actions_taken: automationResult.actions_taken.length
          } : null,
          routing_queued: routingQueued
        };
        
      } catch (error) {
        console.error(`[Event Worker] Error processing ${event_id}:`, error);
        throw error;
      }
    },
    {
      connection: redisOptions,
      concurrency: 10,
      limiter: {
        max: 100,
        duration: 1000
      }
    }
  );
  
  // Event handlers
  worker.on('completed', (job) => {
    console.log(`[Event Worker] ✅ Job ${job.id} completed`);
  });
  
  worker.on('failed', (job, error) => {
    console.error(`[Event Worker] ❌ Job ${job?.id} failed:`, error.message);
  });
  
  worker.on('error', (error) => {
    console.error('[Event Worker] Worker error:', error);
  });
  
  return worker;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Finds an existing lead by identifier or creates a new one.
 * Priority: email > portal_id > waalaxy_id > linkedin_url > lemlist_id
 */
async function findOrCreateLead(
  identifier: LeadIdentifier,
  source: string,
  metadata: Record<string, unknown>
): Promise<Lead> {
  // Try to find by email first (most reliable)
  if (identifier.email) {
    const existing = await db.queryOne<Lead>(`
      SELECT * FROM leads WHERE email = $1
    `, [identifier.email]);
    
    if (existing) {
      await updateLeadIdentifiers(existing.id, identifier);
      await updateLeadFromMetadata(existing.id, metadata);
      return existing;
    }
  }
  
  // Try other identifiers
  const identifierFields = ['portal_id', 'waalaxy_id', 'linkedin_url', 'lemlist_id'] as const;
  
  for (const field of identifierFields) {
    const value = identifier[field];
    if (value) {
      const existing = await db.queryOne<Lead>(`
        SELECT * FROM leads WHERE ${field} = $1
      `, [value]);
      
      if (existing) {
        await updateLeadIdentifiers(existing.id, identifier);
        await updateLeadFromMetadata(existing.id, metadata);
        return existing;
      }
    }
  }
  
  // Create new lead
  const email = identifier.email || `unknown+${Date.now()}@temp.dna-me.com`;
  
  const newLead = await db.queryOne<Lead>(`
    INSERT INTO leads (
      email, 
      first_name,
      last_name,
      phone,
      job_title,
      portal_id, 
      waalaxy_id, 
      linkedin_url,
      lemlist_id,
      status, 
      lifecycle_stage, 
      routing_status,
      first_touch_source, 
      first_touch_date
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      'new', 'lead', 'unrouted',
      $10, NOW()
    )
    RETURNING *
  `, [
    email,
    metadata.first_name || null,
    metadata.last_name || null,
    metadata.phone || null,
    metadata.job_title || null,
    identifier.portal_id || null,
    identifier.waalaxy_id || null,
    identifier.linkedin_url || null,
    identifier.lemlist_id || null,
    source
  ]);
  
  if (!newLead) {
    throw new Error('Failed to create lead');
  }
  
  console.log(`[Event Worker] Created new lead: ${newLead.id} (${newLead.email})`);
  
  // Create organization if company info provided
  if (metadata.company_name || metadata.company_domain) {
    await createOrLinkOrganization(newLead.id, metadata);
  }
  
  return newLead;
}

/**
 * Updates lead's external identifiers if not already set.
 */
async function updateLeadIdentifiers(
  leadId: string, 
  identifiers: LeadIdentifier
): Promise<void> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;
  
  const fields = ['portal_id', 'waalaxy_id', 'linkedin_url', 'lemlist_id'] as const;
  
  for (const field of fields) {
    const value = identifiers[field];
    if (value) {
      updates.push(`${field} = COALESCE(${field}, $${paramIndex})`);
      values.push(value);
      paramIndex++;
    }
  }
  
  if (updates.length > 0) {
    values.push(leadId);
    await db.execute(`
      UPDATE leads SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
    `, values);
  }
}

/**
 * Updates lead fields from event metadata if not already set.
 */
async function updateLeadFromMetadata(
  leadId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;
  
  const fieldMap = {
    first_name: 'first_name',
    last_name: 'last_name',
    phone: 'phone',
    job_title: 'job_title'
  } as const;
  
  for (const [metaKey, dbField] of Object.entries(fieldMap)) {
    const value = metadata[metaKey];
    if (value && typeof value === 'string') {
      updates.push(`${dbField} = COALESCE(${dbField}, $${paramIndex})`);
      values.push(value);
      paramIndex++;
    }
  }
  
  if (updates.length > 0) {
    values.push(leadId);
    await db.execute(`
      UPDATE leads SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
    `, values);
  }
}

/**
 * Creates or links an organization to a lead.
 */
async function createOrLinkOrganization(
  leadId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const companyName = metadata.company_name as string;
  const companyDomain = metadata.company_domain as string;
  
  if (!companyName && !companyDomain) return;
  
  // Try to find existing organization by domain
  let org = null;
  if (companyDomain) {
    org = await db.queryOne<{ id: string }>(`
      SELECT id FROM organizations WHERE domain = $1
    `, [companyDomain]);
  }
  
  // Create organization if not found
  if (!org && companyName) {
    org = await db.queryOne<{ id: string }>(`
      INSERT INTO organizations (name, domain)
      VALUES ($1, $2)
      ON CONFLICT (portal_id) DO NOTHING
      RETURNING id
    `, [companyName, companyDomain || null]);
  }
  
  // Link to lead
  if (org) {
    await db.execute(`
      UPDATE leads SET organization_id = $1, updated_at = NOW()
      WHERE id = $2 AND organization_id IS NULL
    `, [org.id, leadId]);
  }
}

/**
 * Stores a marketing event in the database.
 */
async function storeEvent(event: {
  id: string;
  lead_id: string;
  event_type: string;
  event_category?: string;
  source: string;
  metadata: Record<string, unknown>;
  campaign_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  correlation_id?: string;
  occurred_at: Date;
}): Promise<MarketingEvent> {
  // Clean metadata to remove fields stored in dedicated columns
  const cleanMetadata = { ...event.metadata };
  delete cleanMetadata.event_category;
  delete cleanMetadata.campaign_id;
  delete cleanMetadata.utm_source;
  delete cleanMetadata.utm_medium;
  delete cleanMetadata.utm_campaign;
  delete cleanMetadata.correlation_id;
  delete cleanMetadata.api_key_source;
  delete cleanMetadata.first_name;
  delete cleanMetadata.last_name;
  delete cleanMetadata.phone;
  delete cleanMetadata.job_title;
  delete cleanMetadata.company_name;
  delete cleanMetadata.company_domain;
  
  const result = await db.queryOne<MarketingEvent>(`
    INSERT INTO events (
      id, lead_id, event_type, event_category, source, 
      metadata, campaign_id, utm_source, utm_medium, utm_campaign,
      correlation_id, occurred_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
  `, [
    event.id,
    event.lead_id,
    event.event_type,
    event.event_category || null,
    event.source,
    JSON.stringify(cleanMetadata),
    event.campaign_id || null,
    event.utm_source || null,
    event.utm_medium || null,
    event.utm_campaign || null,
    event.correlation_id || null,
    event.occurred_at
  ]);
  
  if (!result) {
    throw new Error('Failed to store event');
  }
  
  return result;
}

/**
 * Updates lead attribution (first touch / last touch).
 */
async function updateAttribution(lead: Lead, event: MarketingEvent): Promise<void> {
  // Always update last touch
  await db.execute(`
    UPDATE leads SET
      last_touch_source = $1,
      last_touch_campaign = $2,
      last_touch_date = $3
    WHERE id = $4
  `, [event.source, event.utm_campaign || null, event.occurred_at, lead.id]);
  
  // First touch only if not set
  if (!lead.first_touch_source) {
    await db.execute(`
      UPDATE leads SET
        first_touch_source = $1,
        first_touch_campaign = $2,
        first_touch_date = $3
      WHERE id = $4 AND first_touch_source IS NULL
    `, [event.source, event.utm_campaign || null, event.occurred_at, lead.id]);
  }
}

export default createEventWorker;
