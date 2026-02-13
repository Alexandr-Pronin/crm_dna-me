// =============================================================================
// src/api/routes/gdpr.ts
// GDPR Compliance API Routes (Export & Delete)
// =============================================================================

import type { FastifyInstance } from 'fastify';
import { validateApiKey } from '../middleware/apiKey.js';
import { db } from '../../db/index.js';
import { NotFoundError, ValidationError } from '../../errors/index.js';
import type { Lead, Organization, MarketingEvent, ScoreHistory, IntentSignal, Deal, Task } from '../../types/index.js';
import { z } from 'zod';

// =============================================================================
// Types
// =============================================================================

interface LeadIdParams {
  leadId: string;
}

interface GdprExportResponse {
  lead: Lead;
  organization: Organization | null;
  events: MarketingEvent[];
  score_history: ScoreHistory[];
  intent_signals: IntentSignal[];
  deals: Deal[];
  tasks: Task[];
  export_date: string;
  export_format_version: string;
}

interface GdprDeleteResponse {
  success: boolean;
  message: string;
  lead_id: string;
  anonymized_email: string;
  deleted_records: {
    events: number;
    score_history: number;
    intent_signals: number;
    deals: number;
    tasks: number;
  };
  deleted_at: string;
}

// =============================================================================
// Validation Schema
// =============================================================================

const leadIdParamSchema = z.object({
  leadId: z.string().uuid('Lead ID must be a valid UUID')
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate anonymized email from lead ID
 */
function generateAnonymizedEmail(leadId: string): string {
  const hash = leadId.replace(/-/g, '').substring(0, 12);
  return `deleted_${hash}@anonymized.local`;
}

/**
 * Generate anonymized value for text fields
 */
function generateAnonymizedText(prefix: string): string {
  return `[GDPR_DELETED_${prefix.toUpperCase()}]`;
}

// =============================================================================
// Route Registration
// =============================================================================

export async function gdprRoutes(fastify: FastifyInstance): Promise<void> {
  // ===========================================================================
  // GET /api/v1/gdpr/export/:leadId
  // ===========================================================================
  /**
   * Export all data associated with a lead for GDPR compliance.
   * Returns a comprehensive JSON document containing all lead-related data.
   */
  fastify.get<{
    Params: LeadIdParams;
    Reply: GdprExportResponse;
  }>(
    '/gdpr/export/:leadId',
    {
      preHandler: validateApiKey,
      schema: {
        params: {
          type: 'object',
          required: ['leadId'],
          properties: {
            leadId: { type: 'string', format: 'uuid', description: 'Lead ID to export data for' }
          }
        },
        response: {
          200: {
            type: 'object',
            description: 'Complete export of all lead data',
            properties: {
              lead: { type: 'object', additionalProperties: true },
              organization: { type: ['object', 'null'] },
              events: { type: 'array', items: { type: 'object', additionalProperties: true } },
              score_history: { type: 'array', items: { type: 'object', additionalProperties: true } },
              intent_signals: { type: 'array', items: { type: 'object', additionalProperties: true } },
              deals: { type: 'array', items: { type: 'object', additionalProperties: true } },
              tasks: { type: 'array', items: { type: 'object', additionalProperties: true } },
              export_date: { type: 'string', format: 'date-time' },
              export_format_version: { type: 'string' }
            }
          },
          404: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const parseResult = leadIdParamSchema.safeParse(request.params);

      if (!parseResult.success) {
        throw new ValidationError('Invalid lead ID', {
          validationErrors: parseResult.error.errors
        });
      }

      const { leadId } = parseResult.data;

      // Fetch lead
      const lead = await db.queryOne<Lead>(
        'SELECT * FROM leads WHERE id = $1',
        [leadId]
      );

      if (!lead) {
        throw new NotFoundError('Lead', leadId);
      }

      // Fetch all related data in parallel for better performance
      const [organization, events, scoreHistory, intentSignals, deals, tasks] = await Promise.all([
        // Organization (if linked)
        lead.organization_id
          ? db.queryOne<Organization>(
              'SELECT * FROM organizations WHERE id = $1',
              [lead.organization_id]
            )
          : Promise.resolve(null),

        // Events
        db.query<MarketingEvent>(
          'SELECT * FROM events WHERE lead_id = $1 ORDER BY occurred_at DESC',
          [leadId]
        ),

        // Score history
        db.query<ScoreHistory>(
          'SELECT * FROM score_history WHERE lead_id = $1 ORDER BY created_at DESC',
          [leadId]
        ),

        // Intent signals
        db.query<IntentSignal>(
          'SELECT * FROM intent_signals WHERE lead_id = $1 ORDER BY detected_at DESC',
          [leadId]
        ),

        // Deals
        db.query<Deal>(
          'SELECT * FROM deals WHERE lead_id = $1 ORDER BY created_at DESC',
          [leadId]
        ),

        // Tasks
        db.query<Task>(
          'SELECT * FROM tasks WHERE lead_id = $1 ORDER BY created_at DESC',
          [leadId]
        )
      ]);

      request.log.info({
        leadId,
        eventCount: events.length,
        scoreHistoryCount: scoreHistory.length,
        intentSignalsCount: intentSignals.length,
        dealsCount: deals.length,
        tasksCount: tasks.length
      }, 'GDPR data export completed');

      return {
        lead,
        organization,
        events,
        score_history: scoreHistory,
        intent_signals: intentSignals,
        deals,
        tasks,
        export_date: new Date().toISOString(),
        export_format_version: '1.0'
      };
    }
  );

  // ===========================================================================
  // DELETE /api/v1/gdpr/delete/:leadId
  // ===========================================================================
  /**
   * Delete a lead and all associated data for GDPR compliance.
   * This performs a cascading delete and anonymizes the lead record
   * to maintain referential integrity while removing personal data.
   */
  fastify.delete<{
    Params: LeadIdParams;
    Reply: GdprDeleteResponse;
  }>(
    '/gdpr/delete/:leadId',
    {
      preHandler: validateApiKey,
      schema: {
        params: {
          type: 'object',
          required: ['leadId'],
          properties: {
            leadId: { type: 'string', format: 'uuid', description: 'Lead ID to delete' }
          }
        },
        response: {
          200: {
            type: 'object',
            description: 'Deletion confirmation with statistics',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              lead_id: { type: 'string' },
              anonymized_email: { type: 'string' },
              deleted_records: {
                type: 'object',
                properties: {
                  events: { type: 'integer' },
                  score_history: { type: 'integer' },
                  intent_signals: { type: 'integer' },
                  deals: { type: 'integer' },
                  tasks: { type: 'integer' }
                }
              },
              deleted_at: { type: 'string', format: 'date-time' }
            }
          },
          404: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const parseResult = leadIdParamSchema.safeParse(request.params);

      if (!parseResult.success) {
        throw new ValidationError('Invalid lead ID', {
          validationErrors: parseResult.error.errors
        });
      }

      const { leadId } = parseResult.data;

      // Check if lead exists
      const lead = await db.queryOne<Lead>(
        'SELECT * FROM leads WHERE id = $1',
        [leadId]
      );

      if (!lead) {
        throw new NotFoundError('Lead', leadId);
      }

      const anonymizedEmail = generateAnonymizedEmail(leadId);
      const deletionTime = new Date();
      const deletedRecords = {
        events: 0,
        score_history: 0,
        intent_signals: 0,
        deals: 0,
        tasks: 0
      };

      // Execute deletion within a transaction
      await db.instance.transaction(async (client) => {
        // 1. Delete events (they have ON DELETE CASCADE, but we count them)
        const eventsResult = await client.query(
          'DELETE FROM events WHERE lead_id = $1',
          [leadId]
        );
        deletedRecords.events = eventsResult.rowCount ?? 0;

        // 2. Delete score history (ON DELETE CASCADE)
        const scoreResult = await client.query(
          'DELETE FROM score_history WHERE lead_id = $1',
          [leadId]
        );
        deletedRecords.score_history = scoreResult.rowCount ?? 0;

        // 3. Delete intent signals (ON DELETE CASCADE)
        const intentResult = await client.query(
          'DELETE FROM intent_signals WHERE lead_id = $1',
          [leadId]
        );
        deletedRecords.intent_signals = intentResult.rowCount ?? 0;

        // 4. Delete tasks associated with the lead
        const tasksResult = await client.query(
          'DELETE FROM tasks WHERE lead_id = $1',
          [leadId]
        );
        deletedRecords.tasks = tasksResult.rowCount ?? 0;

        // 5. Delete deals associated with the lead
        const dealsResult = await client.query(
          'DELETE FROM deals WHERE lead_id = $1',
          [leadId]
        );
        deletedRecords.deals = dealsResult.rowCount ?? 0;

        // 6. Anonymize the lead record instead of deleting it
        // This preserves referential integrity and audit trail
        await client.query(
          `UPDATE leads SET
            email = $2,
            first_name = $3,
            last_name = $4,
            phone = NULL,
            job_title = NULL,
            linkedin_url = NULL,
            portal_id = NULL,
            waalaxy_id = NULL,
            lemlist_id = NULL,
            consent_date = NULL,
            consent_source = NULL,
            gdpr_delete_requested = $5,
            status = 'churned',
            lifecycle_stage = 'lead',
            routing_status = 'unrouted',
            pipeline_id = NULL,
            updated_at = $5
          WHERE id = $1`,
          [
            leadId,
            anonymizedEmail,
            generateAnonymizedText('first_name'),
            generateAnonymizedText('last_name'),
            deletionTime
          ]
        );
      });

      request.log.info({
        leadId,
        originalEmail: lead.email,
        anonymizedEmail,
        deletedRecords
      }, 'GDPR deletion completed');

      return {
        success: true,
        message: 'Lead data has been deleted and anonymized in compliance with GDPR',
        lead_id: leadId,
        anonymized_email: anonymizedEmail,
        deleted_records: deletedRecords,
        deleted_at: deletionTime.toISOString()
      };
    }
  );
}

export default gdprRoutes;
