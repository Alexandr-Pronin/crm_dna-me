// =============================================================================
// src/api/routes/integrations.ts
// Integrations API Routes (Moco, Slack)
// =============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getMocoService } from '../../integrations/moco.js';
import { getSyncQueue } from '../../config/queues.js';
import { db } from '../../db/index.js';
import { NotFoundError, ValidationError, BusinessLogicError } from '../../errors/index.js';
import { config } from '../../config/index.js';
import type { SyncJob, Lead, Deal } from '../../types/index.js';

// =============================================================================
// Schemas
// =============================================================================

const manualMocoSyncSchema = z.object({
  action: z.enum(['create_customer', 'create_offer', 'create_invoice']),
  force: z.boolean().optional().default(false)
});

const mocoWebhookSchema = z.object({
  event: z.string(),
  entity_type: z.string(),
  entity_id: z.string(),
  data: z.record(z.unknown()).optional()
});

// =============================================================================
// Routes Plugin
// =============================================================================

export async function integrationsRoutes(fastify: FastifyInstance): Promise<void> {
  const mocoService = getMocoService();
  const syncQueue = getSyncQueue();

  // ===========================================================================
  // GET /integrations/moco/status - Check Moco connection status
  // ===========================================================================

  fastify.get('/integrations/moco/status', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const isConfigured = mocoService.isConfigured();
    
    if (!isConfigured) {
      return {
        status: 'not_configured',
        message: 'Moco API key or subdomain not configured',
        enabled: config.features.mocoSync
      };
    }

    const connectionTest = await mocoService.testConnection();
    
    return {
      status: connectionTest.connected ? 'connected' : 'disconnected',
      message: connectionTest.error || 'Connection successful',
      enabled: config.features.mocoSync,
      subdomain: config.moco.subdomain
    };
  });

  // ===========================================================================
  // POST /integrations/moco/sync/:leadId - Manually trigger Moco sync for lead
  // ===========================================================================

  fastify.post('/integrations/moco/sync/lead/:leadId', async (
    request: FastifyRequest<{ 
      Params: { leadId: string };
      Body: z.infer<typeof manualMocoSyncSchema>;
    }>, 
    _reply: FastifyReply
  ) => {
    const { leadId } = request.params;
    const body = manualMocoSyncSchema.parse(request.body || { action: 'create_customer' });
    
    // Check if Moco is configured
    if (!mocoService.isConfigured()) {
      throw new BusinessLogicError('Moco is not configured');
    }

    // Verify lead exists
    const lead = await db.queryOne<Lead>(
      'SELECT * FROM leads WHERE id = $1',
      [leadId]
    );

    if (!lead) {
      throw new NotFoundError('Lead', leadId);
    }

    // Validate action for lead
    if (body.action !== 'create_customer') {
      throw new ValidationError('Only create_customer action is valid for leads');
    }

    // Queue sync job
    const job: SyncJob = {
      entity_type: 'lead',
      entity_id: leadId,
      target: 'moco',
      action: body.action
    };

    await syncQueue.add(`moco-manual-${body.action}`, job, {
      priority: 1 // High priority for manual syncs
    });

    return {
      message: `Moco sync job queued: ${body.action}`,
      lead_id: leadId,
      job_type: body.action
    };
  });

  // ===========================================================================
  // POST /integrations/moco/sync/deal/:dealId - Manually trigger Moco sync for deal
  // ===========================================================================

  fastify.post('/integrations/moco/sync/deal/:dealId', async (
    request: FastifyRequest<{ 
      Params: { dealId: string };
      Body: z.infer<typeof manualMocoSyncSchema>;
    }>, 
    _reply: FastifyReply
  ) => {
    const { dealId } = request.params;
    const body = manualMocoSyncSchema.parse(request.body || { action: 'create_offer' });
    
    // Check if Moco is configured
    if (!mocoService.isConfigured()) {
      throw new BusinessLogicError('Moco is not configured');
    }

    // Verify deal exists
    const deal = await db.queryOne<Deal>(
      'SELECT * FROM deals WHERE id = $1',
      [dealId]
    );

    if (!deal) {
      throw new NotFoundError('Deal', dealId);
    }

    // Validate action for deal
    if (!['create_offer', 'create_invoice'].includes(body.action)) {
      throw new ValidationError('Only create_offer or create_invoice actions are valid for deals');
    }

    // Queue sync job
    const job: SyncJob = {
      entity_type: 'deal',
      entity_id: dealId,
      target: 'moco',
      action: body.action
    };

    await syncQueue.add(`moco-manual-${body.action}`, job, {
      priority: 1
    });

    return {
      message: `Moco sync job queued: ${body.action}`,
      deal_id: dealId,
      job_type: body.action
    };
  });

  // ===========================================================================
  // POST /integrations/moco/webhook - Receive Moco webhooks (payment status, etc.)
  // ===========================================================================

  fastify.post('/integrations/moco/webhook', async (
    request: FastifyRequest<{ Body: z.infer<typeof mocoWebhookSchema> }>,
    _reply: FastifyReply
  ) => {
    try {
      const body = mocoWebhookSchema.parse(request.body);
      
      request.log.info({
        event: body.event,
        entity_type: body.entity_type,
        entity_id: body.entity_id
      }, 'Received Moco webhook');

      // Handle different webhook events
      switch (body.event) {
        case 'invoice.paid':
          await handleInvoicePaid(body.entity_id, body.data);
          break;
        
        case 'invoice.cancelled':
          await handleInvoiceCancelled(body.entity_id, body.data);
          break;
        
        default:
          request.log.info(`Unhandled Moco webhook event: ${body.event}`);
      }

      return { received: true, event: body.event };
    } catch (error) {
      request.log.error(error, 'Error processing Moco webhook');
      throw error;
    }
  });

  // ===========================================================================
  // GET /integrations/moco/customer/:email - Find Moco customer by email
  // ===========================================================================

  fastify.get('/integrations/moco/customer/:email', async (
    request: FastifyRequest<{ Params: { email: string } }>,
    _reply: FastifyReply
  ) => {
    const { email } = request.params;

    if (!mocoService.isConfigured()) {
      throw new BusinessLogicError('Moco is not configured');
    }

    const customer = await mocoService.findCustomerByEmail(email);

    if (!customer) {
      throw new NotFoundError('Moco Customer', email);
    }

    return customer;
  });

  // ===========================================================================
  // GET /integrations/status - Get status of all integrations
  // ===========================================================================

  fastify.get('/integrations/status', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const mocoConfigured = mocoService.isConfigured();
    let mocoConnected = false;

    if (mocoConfigured) {
      const connectionTest = await mocoService.testConnection();
      mocoConnected = connectionTest.connected;
    }

    return {
      moco: {
        configured: mocoConfigured,
        connected: mocoConnected,
        enabled: config.features.mocoSync
      },
      slack: {
        configured: !!config.slack.webhookUrl,
        connected: false, // Will be implemented in Etappe 12
        enabled: config.features.slackAlerts
      }
    };
  });
}

// =============================================================================
// Webhook Handlers
// =============================================================================

async function handleInvoicePaid(invoiceId: string, _data?: Record<string, unknown>): Promise<void> {
  console.log(`[Moco Webhook] Invoice paid: ${invoiceId}`);
  
  // Find deal by moco_offer_id (if we stored it)
  // Note: We might need to track invoice IDs separately
  // For now, just log the event
  
  // Future: Update deal status, notify team, etc.
}

async function handleInvoiceCancelled(invoiceId: string, _data?: Record<string, unknown>): Promise<void> {
  console.log(`[Moco Webhook] Invoice cancelled: ${invoiceId}`);
  
  // Future: Handle invoice cancellation
}

export default integrationsRoutes;
