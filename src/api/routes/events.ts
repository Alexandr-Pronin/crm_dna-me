// =============================================================================
// src/api/routes/events.ts
// Event Ingestion API Routes
// =============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { validateApiKey } from '../middleware/apiKey.js';
import { validateHmacSignature } from '../middleware/hmac.js';
import {
  ingestEventSchema,
  bulkImportSchema,
  type IngestEventInput,
  type IngestEventResponse,
  type BulkImportInput,
  type BulkImportResponse
} from '../schemas/events.js';
import { getEventsQueue } from '../../config/queues.js';
import { ValidationError } from '../../errors/index.js';
import type { EventProcessingJob } from '../../types/index.js';

// =============================================================================
// Route Registration
// =============================================================================

export async function eventsRoutes(fastify: FastifyInstance): Promise<void> {
  
  // ===========================================================================
  // POST /api/v1/events/ingest
  // ===========================================================================
  /**
   * Ingest a single event from external sources.
   * Validates the event and queues it for async processing.
   * 
   * Authentication: X-API-Key header required
   * Response: 202 Accepted (event queued for processing)
   */
  fastify.post<{
    Body: IngestEventInput;
    Reply: IngestEventResponse;
  }>(
    '/events/ingest',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Ingest a marketing event for processing',
        tags: ['Events'],
        body: {
          type: 'object',
          required: ['event_type', 'source', 'occurred_at', 'lead_identifier'],
          properties: {
            event_type: { type: 'string' },
            event_category: { type: 'string' },
            source: { type: 'string', enum: ['waalaxy', 'portal', 'lemlist', 'ads', 'conference', 'website', 'linkedin', 'manual', 'api', 'import'] },
            occurred_at: { type: 'string', format: 'date-time' },
            lead_identifier: {
              type: 'object',
              properties: {
                email: { type: 'string', format: 'email' },
                portal_id: { type: 'string' },
                waalaxy_id: { type: 'string' },
                linkedin_url: { type: 'string', format: 'uri' },
                lemlist_id: { type: 'string' }
              }
            },
            metadata: { type: 'object', additionalProperties: true },
            campaign_id: { type: 'string' },
            utm_source: { type: 'string' },
            utm_medium: { type: 'string' },
            utm_campaign: { type: 'string' },
            correlation_id: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          202: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              event_id: { type: 'string', format: 'uuid' },
              message: { type: 'string' },
              queued_at: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      // Validate request body with Zod
      const parseResult = ingestEventSchema.safeParse(request.body);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid event data', {
          validationErrors: parseResult.error.errors
        });
      }

      const eventData = parseResult.data;
      const eventId = uuidv4();
      const queuedAt = new Date().toISOString();

      // Build job data
      const job: EventProcessingJob = {
        event_id: eventId,
        event_type: eventData.event_type,
        source: eventData.source,
        lead_identifier: eventData.lead_identifier,
        metadata: {
          ...eventData.metadata,
          event_category: eventData.event_category,
          campaign_id: eventData.campaign_id,
          utm_source: eventData.utm_source,
          utm_medium: eventData.utm_medium,
          utm_campaign: eventData.utm_campaign,
          correlation_id: eventData.correlation_id,
          api_key_source: request.apiKeySource
        },
        occurred_at: eventData.occurred_at
      };

      // Queue the event for processing
      const queue = getEventsQueue();
      await queue.add('process_event', job, {
        jobId: eventId,
        priority: getPriorityForEventType(eventData.event_type),
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      });

      request.log.info({
        eventId,
        eventType: eventData.event_type,
        source: eventData.source,
        leadEmail: eventData.lead_identifier.email
      }, 'Event queued for processing');

      return reply.code(202).send({
        success: true,
        event_id: eventId,
        message: 'Event queued for processing',
        queued_at: queuedAt
      });
    }
  );

  // ===========================================================================
  // POST /api/v1/events/webhook
  // ===========================================================================
  /**
   * Generic webhook endpoint for external services.
   * Uses HMAC signature validation.
   */
  fastify.post<{
    Body: IngestEventInput;
    Reply: IngestEventResponse;
  }>(
    '/events/webhook',
    {
      preHandler: validateHmacSignature,
      schema: {
        description: 'Receive events via webhook (HMAC validated)',
        tags: ['Events']
      }
    },
    async (request, reply) => {
      // Same processing as /events/ingest
      const parseResult = ingestEventSchema.safeParse(request.body);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid webhook payload', {
          validationErrors: parseResult.error.errors
        });
      }

      const eventData = parseResult.data;
      const eventId = uuidv4();
      const queuedAt = new Date().toISOString();

      const job: EventProcessingJob = {
        event_id: eventId,
        event_type: eventData.event_type,
        source: eventData.source,
        lead_identifier: eventData.lead_identifier,
        metadata: {
          ...eventData.metadata,
          event_category: eventData.event_category,
          campaign_id: eventData.campaign_id,
          utm_source: eventData.utm_source,
          utm_medium: eventData.utm_medium,
          utm_campaign: eventData.utm_campaign,
          correlation_id: eventData.correlation_id,
          webhook: true
        },
        occurred_at: eventData.occurred_at
      };

      const queue = getEventsQueue();
      await queue.add('process_event', job, {
        jobId: eventId,
        priority: getPriorityForEventType(eventData.event_type)
      });

      request.log.info({
        eventId,
        eventType: eventData.event_type,
        source: eventData.source
      }, 'Webhook event queued');

      return reply.code(202).send({
        success: true,
        event_id: eventId,
        message: 'Webhook event queued for processing',
        queued_at: queuedAt
      });
    }
  );

  // ===========================================================================
  // POST /api/v1/leads/bulk
  // ===========================================================================
  /**
   * Bulk import leads from CSV or external systems.
   * Creates events for each lead.
   */
  fastify.post<{
    Body: BulkImportInput;
    Reply: BulkImportResponse;
  }>(
    '/leads/bulk',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Bulk import leads',
        tags: ['Leads', 'Events'],
        body: {
          type: 'object',
          required: ['leads', 'source'],
          properties: {
            leads: {
              type: 'array',
              items: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  first_name: { type: 'string' },
                  last_name: { type: 'string' },
                  phone: { type: 'string' },
                  job_title: { type: 'string' },
                  company_name: { type: 'string' },
                  company_domain: { type: 'string' },
                  linkedin_url: { type: 'string', format: 'uri' },
                  source: { type: 'string' },
                  campaign_id: { type: 'string' },
                  metadata: { type: 'object', additionalProperties: true }
                }
              },
              minItems: 1,
              maxItems: 1000
            },
            source: { type: 'string' },
            campaign_id: { type: 'string' },
            skip_duplicates: { type: 'boolean', default: true },
            notify_on_complete: { type: 'boolean', default: false }
          }
        },
        response: {
          202: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              batch_id: { type: 'string', format: 'uuid' },
              total_leads: { type: 'number' },
              queued_at: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      // Validate request body
      const parseResult = bulkImportSchema.safeParse(request.body);
      
      if (!parseResult.success) {
        throw new ValidationError('Invalid bulk import data', {
          validationErrors: parseResult.error.errors
        });
      }

      const bulkData = parseResult.data;
      const batchId = uuidv4();
      const queuedAt = new Date().toISOString();
      const queue = getEventsQueue();

      // Queue individual events for each lead
      const jobs = bulkData.leads.map((lead, index) => {
        const eventId = uuidv4();
        
        const job: EventProcessingJob = {
          event_id: eventId,
          event_type: 'lead_imported',
          source: bulkData.source as 'import',
          lead_identifier: {
            email: lead.email,
            linkedin_url: lead.linkedin_url
          },
          metadata: {
            ...lead.metadata,
            first_name: lead.first_name,
            last_name: lead.last_name,
            phone: lead.phone,
            job_title: lead.job_title,
            company_name: lead.company_name,
            company_domain: lead.company_domain,
            campaign_id: bulkData.campaign_id || lead.campaign_id,
            batch_id: batchId,
            batch_index: index,
            batch_total: bulkData.leads.length,
            skip_duplicates: bulkData.skip_duplicates,
            api_key_source: request.apiKeySource
          },
          occurred_at: queuedAt
        };

        return {
          name: 'process_event',
          data: job,
          opts: {
            jobId: eventId,
            priority: 10 // Lower priority for bulk imports
          }
        };
      });

      // Bulk add jobs to queue
      await queue.addBulk(jobs);

      request.log.info({
        batchId,
        totalLeads: bulkData.leads.length,
        source: bulkData.source
      }, 'Bulk import queued');

      return reply.code(202).send({
        success: true,
        message: `${bulkData.leads.length} leads queued for import`,
        batch_id: batchId,
        total_leads: bulkData.leads.length,
        queued_at: queuedAt
      });
    }
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Determines job priority based on event type.
 * Lower number = higher priority.
 */
function getPriorityForEventType(eventType: string): number {
  // High priority events (immediate response expected)
  const highPriority = [
    'demo_requested',
    'form_submitted',
    'meeting_scheduled',
    'order_placed',
    'deal_won'
  ];

  // Medium priority events
  const mediumPriority = [
    'email_replied',
    'linkedin_message_replied',
    'pricing_viewed',
    'roi_calculator_submitted'
  ];

  if (highPriority.includes(eventType)) {
    return 1;
  }
  
  if (mediumPriority.includes(eventType)) {
    return 5;
  }

  // Default priority
  return 10;
}

export default eventsRoutes;
