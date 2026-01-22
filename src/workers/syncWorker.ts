// =============================================================================
// src/workers/syncWorker.ts
// Sync Worker for Moco and Slack integrations
// =============================================================================

import { Worker, Job } from 'bullmq';
import { redisOptions } from '../config/redis.js';
import { db } from '../db/index.js';
import { MocoService, MocoError } from '../integrations/moco.js';
import { SlackService } from '../integrations/slack.js';
import { config } from '../config/index.js';
import type { SyncJob, Lead, Deal } from '../types/index.js';

// =============================================================================
// Types
// =============================================================================

interface LeadWithOrganization extends Lead {
  org_name?: string;
  org_domain?: string;
  vat_id?: string;
}

interface DealWithRelations extends Deal {
  lead_email?: string;
  customer_moco_id?: string;
  lead_first_name?: string;
  lead_last_name?: string;
  org_name?: string;
}

interface SyncResult {
  success: boolean;
  action: string;
  entity_id: string;
  target: string;
  result?: Record<string, unknown>;
  error?: string;
}

// =============================================================================
// Moco Sync Processing
// =============================================================================

async function processMocoSync(
  mocoService: MocoService,
  _entityType: string,
  entityId: string,
  action: string
): Promise<SyncResult> {
  switch (action) {
    case 'create_customer':
      return await createMocoCustomer(mocoService, entityId);
    
    case 'create_offer':
      return await createMocoOffer(mocoService, entityId);
    
    case 'create_invoice':
      return await createMocoInvoice(mocoService, entityId);
    
    default:
      throw new Error(`Unknown Moco action: ${action}`);
  }
}

// =============================================================================
// Create Moco Customer
// =============================================================================

async function createMocoCustomer(
  mocoService: MocoService,
  leadId: string
): Promise<SyncResult> {
  // Get lead with organization data
  const lead = await db.queryOne<LeadWithOrganization>(`
    SELECT 
      l.*,
      o.name as org_name,
      o.domain as org_domain,
      o.vat_id,
      o.moco_id as existing_moco_id
    FROM leads l
    LEFT JOIN organizations o ON l.organization_id = o.id
    WHERE l.id = $1
  `, [leadId]);

  if (!lead) {
    return {
      success: false,
      action: 'create_customer',
      entity_id: leadId,
      target: 'moco',
      error: 'Lead not found'
    };
  }

  // Check if customer already exists in Moco
  const existingCustomer = await mocoService.findCustomerByEmail(lead.email);
  if (existingCustomer) {
    // Update organization with existing Moco ID
    if (lead.organization_id) {
      await db.execute(`
        UPDATE organizations SET moco_id = $1, updated_at = NOW() WHERE id = $2
      `, [existingCustomer.id, lead.organization_id]);
    }
    
    console.log(`[SyncWorker] Customer already exists in Moco: ${existingCustomer.id}`);
    return {
      success: true,
      action: 'create_customer',
      entity_id: leadId,
      target: 'moco',
      result: { moco_id: existingCustomer.id, existing: true }
    };
  }

  // Determine customer name
  const customerName = lead.org_name || 
    `${lead.first_name || ''} ${lead.last_name || ''}`.trim() ||
    lead.email.split('@')[0];

  // Create customer in Moco
  const mocoId = await mocoService.createCustomer({
    name: customerName,
    email: lead.email,
    vat_id: lead.vat_id,
    website: lead.org_domain ? `https://${lead.org_domain}` : undefined
  });

  // Update organization with Moco ID
  if (lead.organization_id) {
    await db.execute(`
      UPDATE organizations SET moco_id = $1, updated_at = NOW() WHERE id = $2
    `, [mocoId, lead.organization_id]);
  }

  console.log(`[SyncWorker] Created Moco customer: ${mocoId} for lead ${leadId}`);

  return {
    success: true,
    action: 'create_customer',
    entity_id: leadId,
    target: 'moco',
    result: { moco_id: mocoId }
  };
}

// =============================================================================
// Create Moco Offer
// =============================================================================

async function createMocoOffer(
  mocoService: MocoService,
  dealId: string
): Promise<SyncResult> {
  // Get deal with related data
  const deal = await db.queryOne<DealWithRelations>(`
    SELECT 
      d.*,
      l.email as lead_email,
      l.first_name as lead_first_name,
      l.last_name as lead_last_name,
      o.moco_id as customer_moco_id,
      o.name as org_name
    FROM deals d
    JOIN leads l ON d.lead_id = l.id
    LEFT JOIN organizations o ON l.organization_id = o.id
    WHERE d.id = $1
  `, [dealId]);

  if (!deal) {
    return {
      success: false,
      action: 'create_offer',
      entity_id: dealId,
      target: 'moco',
      error: 'Deal not found'
    };
  }

  // Check if we have a Moco customer ID
  if (!deal.customer_moco_id) {
    // Try to find customer by email
    const customer = await mocoService.findCustomerByEmail(deal.lead_email || '');
    if (customer) {
      deal.customer_moco_id = customer.id;
    } else {
      return {
        success: false,
        action: 'create_offer',
        entity_id: dealId,
        target: 'moco',
        error: 'No Moco customer found. Create customer first.'
      };
    }
  }

  // Check if offer already exists
  if (deal.moco_offer_id) {
    console.log(`[SyncWorker] Offer already exists: ${deal.moco_offer_id}`);
    return {
      success: true,
      action: 'create_offer',
      entity_id: dealId,
      target: 'moco',
      result: { moco_offer_id: deal.moco_offer_id, existing: true }
    };
  }

  // Create offer title
  const offerTitle = deal.name || 
    `${deal.org_name || deal.lead_first_name || ''} - Deal`;

  // Create offer in Moco
  const offerId = await mocoService.createOffer({
    customer_id: deal.customer_moco_id,
    title: offerTitle,
    value: deal.value || 0
  });

  // Update deal with Moco offer ID
  await db.execute(`
    UPDATE deals SET moco_offer_id = $1, updated_at = NOW() WHERE id = $2
  `, [offerId, dealId]);

  console.log(`[SyncWorker] Created Moco offer: ${offerId} for deal ${dealId}`);

  return {
    success: true,
    action: 'create_offer',
    entity_id: dealId,
    target: 'moco',
    result: { moco_offer_id: offerId }
  };
}

// =============================================================================
// Create Moco Invoice
// =============================================================================

async function createMocoInvoice(
  mocoService: MocoService,
  offerId: string
): Promise<SyncResult> {
  // Check if this is a deal ID or offer ID
  const deal = await db.queryOne<Deal>(`
    SELECT * FROM deals WHERE id = $1 OR moco_offer_id = $1
  `, [offerId]);

  let mocoOfferId = offerId;
  
  if (deal && deal.moco_offer_id) {
    mocoOfferId = deal.moco_offer_id;
  }

  // Create invoice from offer
  const invoiceId = await mocoService.createInvoiceFromOffer(mocoOfferId);

  console.log(`[SyncWorker] Created Moco invoice: ${invoiceId} from offer ${mocoOfferId}`);

  return {
    success: true,
    action: 'create_invoice',
    entity_id: offerId,
    target: 'moco',
    result: { moco_invoice_id: invoiceId }
  };
}

// =============================================================================
// Slack Sync Processing
// =============================================================================

async function processSlackSync(
  slackService: SlackService,
  data: SyncJob
): Promise<SyncResult> {
  // Check if Slack is configured
  if (!slackService.isConfigured()) {
    console.log('[SyncWorker] Slack not configured, skipping');
    return {
      success: true,
      action: data.action,
      entity_id: data.entity_id,
      target: 'slack',
      result: { skipped: true, reason: 'Slack not configured' }
    };
  }

  const metadata = data.metadata || {};

  switch (data.action) {
    case 'hot_lead_alert': {
      // Get lead data
      const lead = await db.queryOne<Lead>(`
        SELECT * FROM leads WHERE id = $1
      `, [data.entity_id]);

      if (lead) {
        const sent = await slackService.sendHotLeadAlert({
          id: lead.id,
          email: lead.email,
          first_name: lead.first_name,
          last_name: lead.last_name,
          job_title: lead.job_title,
          total_score: lead.total_score,
          primary_intent: lead.primary_intent,
          intent_confidence: lead.intent_confidence
        });

        return {
          success: sent,
          action: data.action,
          entity_id: data.entity_id,
          target: 'slack',
          result: { sent }
        };
      }
      break;
    }

    case 'routing_conflict': {
      // Get lead data for routing conflict
      const lead = await db.queryOne<Lead>(`
        SELECT * FROM leads WHERE id = $1
      `, [data.entity_id]);

      if (lead) {
        const sent = await slackService.sendRoutingConflict({
          id: lead.id,
          email: lead.email,
          first_name: lead.first_name,
          last_name: lead.last_name,
          total_score: lead.total_score,
          intent_summary: lead.intent_summary || { research: 0, b2b: 0, co_creation: 0 }
        });

        return {
          success: sent,
          action: data.action,
          entity_id: data.entity_id,
          target: 'slack',
          result: { sent }
        };
      }
      break;
    }

    case 'deal_won': {
      // Get deal data
      const deal = await db.queryOne<DealWithRelations>(`
        SELECT d.*, l.email as lead_email
        FROM deals d
        JOIN leads l ON d.lead_id = l.id
        WHERE d.id = $1
      `, [data.entity_id]);

      if (deal) {
        const sent = await slackService.sendDealWonAlert({
          id: deal.id,
          name: deal.name || 'Unknown Deal',
          value: deal.value || 0,
          assigned_to: deal.assigned_to,
          lead_email: deal.lead_email || ''
        });

        return {
          success: sent,
          action: data.action,
          entity_id: data.entity_id,
          target: 'slack',
          result: { sent }
        };
      }
      break;
    }

    case 'send_message': {
      // Generic message sending
      const channel = metadata.channel as string || '#crm-notifications';
      const message = metadata.message as string || '';

      if (message) {
        const sent = await slackService.sendMessage(channel, message);
        return {
          success: sent,
          action: data.action,
          entity_id: data.entity_id,
          target: 'slack',
          result: { sent, channel }
        };
      }
      break;
    }

    case 'error_alert': {
      // Send error alert
      const sent = await slackService.sendErrorAlert({
        message: metadata.error_message as string || 'Unknown error',
        context: metadata.context as string,
        stack: metadata.stack as string
      });

      return {
        success: sent,
        action: data.action,
        entity_id: data.entity_id,
        target: 'slack',
        result: { sent }
      };
    }

    default:
      console.log(`[SyncWorker] Unknown Slack action: ${data.action}`);
  }

  return {
    success: false,
    action: data.action,
    entity_id: data.entity_id,
    target: 'slack',
    error: 'Action not handled or entity not found'
  };
}

// =============================================================================
// Create Sync Worker
// =============================================================================

export function createSyncWorker(
  mocoService: MocoService,
  slackService?: SlackService
): Worker<SyncJob> {
  const worker = new Worker<SyncJob>(
    'sync',
    async (job: Job<SyncJob>) => {
      const { entity_type, entity_id, target, action } = job.data;
      
      console.log(`[SyncWorker] Processing: ${action} ${entity_type} ${entity_id} to ${target}`);
      
      try {
        let result: SyncResult;
        
        switch (target) {
          case 'moco':
            // Check if Moco is enabled
            if (!config.features.mocoSync) {
              console.log('[SyncWorker] Moco sync is disabled');
              return {
                success: true,
                skipped: true,
                reason: 'Moco sync disabled'
              };
            }
            
            result = await processMocoSync(mocoService, entity_type, entity_id, action);
            break;
            
          case 'slack':
            // Check if Slack service is provided
            if (!slackService) {
              console.log('[SyncWorker] Slack service not provided');
              return {
                success: true,
                skipped: true,
                reason: 'Slack service not configured'
              };
            }
            
            result = await processSlackSync(slackService, job.data);
            break;
            
          default:
            throw new Error(`Unknown sync target: ${target}`);
        }
        
        console.log(`[SyncWorker] Completed: ${action} ${entity_type} ${entity_id} - Success: ${result.success}`);
        return result;
        
      } catch (error) {
        const errorMessage = error instanceof MocoError 
          ? `${error.message} (${error.statusCode}): ${error.mocoMessage}`
          : (error as Error).message;
        
        console.error(`[SyncWorker] Error processing ${action}:`, errorMessage);
        
        // Re-throw to trigger BullMQ retry
        throw error;
      }
    },
    {
      connection: redisOptions,
      concurrency: 3,
      limiter: {
        max: 10,
        duration: 1000 // Max 10 jobs per second
      }
    }
  );
  
  // Event handlers
  worker.on('completed', (job) => {
    console.log(`[SyncWorker] Job ${job.id} completed successfully`);
  });
  
  worker.on('failed', (job, error) => {
    console.error(`[SyncWorker] Job ${job?.id} failed:`, error.message);
  });
  
  worker.on('error', (error) => {
    console.error('[SyncWorker] Worker error:', error);
  });
  
  return worker;
}

export default createSyncWorker;
