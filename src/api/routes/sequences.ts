// =============================================================================
// src/api/routes/sequences.ts
// E-Mail Sequence API Routes
// =============================================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { validateApiKey } from '../middleware/apiKey.js';
import { db } from '../../db/index.js';
import { getEmailService } from '../../services/emailService.js';
import { enrollLeadInSequence, pauseEnrollment, resumeEnrollment, triggerImmediateSend } from '../../workers/emailSequenceWorker.js';
import { ValidationError, NotFoundError } from '../../errors/index.js';
import type { EmailSequence, EmailSequenceStep, EmailSequenceEnrollment } from '../../types/index.js';

// =============================================================================
// Zod Schemas
// =============================================================================

const createSequenceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  trigger_event: z.string().max(50).optional(),
  trigger_config: z.record(z.unknown()).optional(),
  is_active: z.boolean().default(true)
});

const updateSequenceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  trigger_event: z.string().max(50).optional(),
  trigger_config: z.record(z.unknown()).optional(),
  is_active: z.boolean().optional()
});

const createStepSchema = z.object({
  position: z.number().int().min(1),
  delay_days: z.number().int().min(0).default(0),
  delay_hours: z.number().int().min(0).max(23).default(0),
  subject: z.string().min(1).max(255),
  body_html: z.string().min(1),
  body_text: z.string().optional()
});

const updateStepSchema = z.object({
  position: z.number().int().min(1).optional(),
  delay_days: z.number().int().min(0).optional(),
  delay_hours: z.number().int().min(0).max(23).optional(),
  subject: z.string().min(1).max(255).optional(),
  body_html: z.string().min(1).optional(),
  body_text: z.string().optional()
});

const enrollLeadSchema = z.object({
  lead_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  stage_id: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional()
}).refine((data) => data.lead_id || data.deal_id, {
  message: 'lead_id oder deal_id erforderlich',
  path: ['lead_id']
});

const idParamSchema = z.object({
  id: z.string().uuid()
});

const sequenceStepParamSchema = z.object({
  sequenceId: z.string().uuid(),
  stepId: z.string().uuid()
});

// =============================================================================
// Type Definitions
// =============================================================================

interface IdParams {
  id: string;
}

interface SequenceStepParams {
  sequenceId: string;
  stepId: string;
}

// =============================================================================
// Route Registration
// =============================================================================

export async function sequencesRoutes(fastify: FastifyInstance): Promise<void> {
  const emailService = getEmailService();

  // ===========================================================================
  // GET /api/v1/sequences
  // ===========================================================================
  /**
   * Liste aller E-Mail-Sequenzen
   */
  fastify.get(
    '/sequences',
    {
      preHandler: validateApiKey,
      schema: {
        tags: ['Email Sequences'],
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string', nullable: true },
                    trigger_event: { type: 'string', nullable: true },
                    is_active: { type: 'boolean' },
                    steps_count: { type: 'integer' },
                    enrollments_count: { type: 'integer' },
                    created_at: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    async () => {
      const sequences = await db.query<EmailSequence & { 
        steps_count: string; 
        enrollments_count: string;
      }>(
        `SELECT 
           es.*,
           (SELECT COUNT(*)::text FROM email_sequence_steps WHERE sequence_id = es.id) as steps_count,
           (SELECT COUNT(*)::text FROM email_sequence_enrollments WHERE sequence_id = es.id AND status = 'active') as enrollments_count
         FROM email_sequences es
         ORDER BY es.created_at DESC`
      );

      return {
        data: sequences.map(s => ({
          ...s,
          steps_count: parseInt(s.steps_count, 10),
          enrollments_count: parseInt(s.enrollments_count, 10)
        }))
      };
    }
  );

  // ===========================================================================
  // GET /api/v1/sequences/:id
  // ===========================================================================
  /**
   * Einzelne Sequenz mit allen Schritten
   */
  fastify.get<{
    Params: IdParams;
  }>(
    '/sequences/:id',
    {
      preHandler: validateApiKey,
      schema: {
        tags: ['Email Sequences'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const { id } = request.params;

      const sequence = await db.queryOne<EmailSequence>(
        'SELECT * FROM email_sequences WHERE id = $1',
        [id]
      );

      if (!sequence) {
        throw new NotFoundError('Sequenz', id);
      }

      const steps = await db.query<EmailSequenceStep>(
        `SELECT * FROM email_sequence_steps 
         WHERE sequence_id = $1 
         ORDER BY position ASC`,
        [id]
      );

      const stats = await emailService.getSequenceStats(id);

      return {
        ...sequence,
        steps,
        stats
      };
    }
  );

  // ===========================================================================
  // POST /api/v1/sequences
  // ===========================================================================
  /**
   * Neue Sequenz erstellen
   */
  fastify.post(
    '/sequences',
    {
      preHandler: validateApiKey,
      schema: {
        tags: ['Email Sequences'],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', maxLength: 255 },
            description: { type: 'string' },
            trigger_event: { type: 'string', maxLength: 50 },
            trigger_config: { type: 'object' },
            is_active: { type: 'boolean', default: true }
          }
        }
      }
    },
    async (request) => {
      const parseResult = createSequenceSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ValidationError('Ungültige Sequenz-Daten', {
          validationErrors: parseResult.error.errors
        });
      }

      const { name, description, trigger_event, trigger_config, is_active } = parseResult.data;

      const sequence = await db.queryOne<EmailSequence>(
        `INSERT INTO email_sequences (name, description, trigger_event, trigger_config, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [name, description, trigger_event, JSON.stringify(trigger_config || {}), is_active]
      );

      request.log.info({ sequenceId: sequence?.id }, 'E-Mail-Sequenz erstellt');

      return sequence;
    }
  );

  // ===========================================================================
  // PATCH /api/v1/sequences/:id
  // ===========================================================================
  /**
   * Sequenz aktualisieren
   */
  fastify.patch<{
    Params: IdParams;
  }>(
    '/sequences/:id',
    {
      preHandler: validateApiKey,
      schema: {
        tags: ['Email Sequences'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const { id } = request.params;
      const parseResult = updateSequenceSchema.safeParse(request.body);
      
      if (!parseResult.success) {
        throw new ValidationError('Ungültige Sequenz-Daten', {
          validationErrors: parseResult.error.errors
        });
      }

      const existing = await db.queryOne<EmailSequence>(
        'SELECT * FROM email_sequences WHERE id = $1',
        [id]
      );

      if (!existing) {
        throw new NotFoundError('Sequenz', id);
      }

      const updates = parseResult.data;
      const setClauses: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        setClauses.push(`name = $${paramIndex++}`);
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        setClauses.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }
      if (updates.trigger_event !== undefined) {
        setClauses.push(`trigger_event = $${paramIndex++}`);
        values.push(updates.trigger_event);
      }
      if (updates.trigger_config !== undefined) {
        setClauses.push(`trigger_config = $${paramIndex++}`);
        values.push(JSON.stringify(updates.trigger_config));
      }
      if (updates.is_active !== undefined) {
        setClauses.push(`is_active = $${paramIndex++}`);
        values.push(updates.is_active);
      }

      if (setClauses.length === 0) {
        return existing;
      }

      values.push(id);
      const sequence = await db.queryOne<EmailSequence>(
        `UPDATE email_sequences 
         SET ${setClauses.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );

      return sequence;
    }
  );

  // ===========================================================================
  // DELETE /api/v1/sequences/:id
  // ===========================================================================
  /**
   * Sequenz löschen
   */
  fastify.delete<{
    Params: IdParams;
  }>(
    '/sequences/:id',
    {
      preHandler: validateApiKey,
      schema: {
        tags: ['Email Sequences'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;

      const result = await db.execute(
        'DELETE FROM email_sequences WHERE id = $1',
        [id]
      );

      if (result === 0) {
        throw new NotFoundError('Sequenz', id);
      }

      request.log.info({ sequenceId: id }, 'E-Mail-Sequenz gelöscht');

      return reply.code(204).send();
    }
  );

  // ===========================================================================
  // POST /api/v1/sequences/:id/steps
  // ===========================================================================
  /**
   * Neuen Schritt zur Sequenz hinzufügen
   */
  fastify.post<{
    Params: IdParams;
  }>(
    '/sequences/:id/steps',
    {
      preHandler: validateApiKey,
      schema: {
        tags: ['Email Sequences'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const { id: sequenceId } = request.params;
      const parseResult = createStepSchema.safeParse(request.body);
      
      if (!parseResult.success) {
        throw new ValidationError('Ungültige Schritt-Daten', {
          validationErrors: parseResult.error.errors
        });
      }

      // Check sequence exists
      const sequence = await db.queryOne<EmailSequence>(
        'SELECT * FROM email_sequences WHERE id = $1',
        [sequenceId]
      );

      if (!sequence) {
        throw new NotFoundError('Sequenz', sequenceId);
      }

      const { position, delay_days, delay_hours, subject, body_html, body_text } = parseResult.data;

      const step = await db.queryOne<EmailSequenceStep>(
        `INSERT INTO email_sequence_steps 
         (sequence_id, position, delay_days, delay_hours, subject, body_html, body_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [sequenceId, position, delay_days, delay_hours, subject, body_html, body_text]
      );

      request.log.info({ sequenceId, stepId: step?.id }, 'Sequenz-Schritt erstellt');

      return step;
    }
  );

  // ===========================================================================
  // PATCH /api/v1/sequences/:sequenceId/steps/:stepId
  // ===========================================================================
  /**
   * Schritt aktualisieren
   */
  fastify.patch<{
    Params: SequenceStepParams;
  }>(
    '/sequences/:sequenceId/steps/:stepId',
    {
      preHandler: validateApiKey,
      schema: {
        tags: ['Email Sequences'],
        params: {
          type: 'object',
          required: ['sequenceId', 'stepId'],
          properties: {
            sequenceId: { type: 'string', format: 'uuid' },
            stepId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const { sequenceId, stepId } = request.params;
      const parseResult = updateStepSchema.safeParse(request.body);
      
      if (!parseResult.success) {
        throw new ValidationError('Ungültige Schritt-Daten', {
          validationErrors: parseResult.error.errors
        });
      }

      const existing = await db.queryOne<EmailSequenceStep>(
        'SELECT * FROM email_sequence_steps WHERE id = $1 AND sequence_id = $2',
        [stepId, sequenceId]
      );

      if (!existing) {
        throw new NotFoundError('Sequenz-Schritt', stepId);
      }

      const updates = parseResult.data;
      const setClauses: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (updates.position !== undefined) {
        setClauses.push(`position = $${paramIndex++}`);
        values.push(updates.position);
      }
      if (updates.delay_days !== undefined) {
        setClauses.push(`delay_days = $${paramIndex++}`);
        values.push(updates.delay_days);
      }
      if (updates.delay_hours !== undefined) {
        setClauses.push(`delay_hours = $${paramIndex++}`);
        values.push(updates.delay_hours);
      }
      if (updates.subject !== undefined) {
        setClauses.push(`subject = $${paramIndex++}`);
        values.push(updates.subject);
      }
      if (updates.body_html !== undefined) {
        setClauses.push(`body_html = $${paramIndex++}`);
        values.push(updates.body_html);
      }
      if (updates.body_text !== undefined) {
        setClauses.push(`body_text = $${paramIndex++}`);
        values.push(updates.body_text);
      }

      if (setClauses.length === 0) {
        return existing;
      }

      values.push(stepId);
      const step = await db.queryOne<EmailSequenceStep>(
        `UPDATE email_sequence_steps 
         SET ${setClauses.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );

      return step;
    }
  );

  // ===========================================================================
  // DELETE /api/v1/sequences/:sequenceId/steps/:stepId
  // ===========================================================================
  /**
   * Schritt löschen
   */
  fastify.delete<{
    Params: SequenceStepParams;
  }>(
    '/sequences/:sequenceId/steps/:stepId',
    {
      preHandler: validateApiKey,
      schema: {
        tags: ['Email Sequences'],
        params: {
          type: 'object',
          required: ['sequenceId', 'stepId'],
          properties: {
            sequenceId: { type: 'string', format: 'uuid' },
            stepId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request, reply) => {
      const { sequenceId, stepId } = request.params;

      const result = await db.execute(
        'DELETE FROM email_sequence_steps WHERE id = $1 AND sequence_id = $2',
        [stepId, sequenceId]
      );

      if (result === 0) {
        throw new NotFoundError('Sequenz-Schritt', stepId);
      }

      request.log.info({ sequenceId, stepId }, 'Sequenz-Schritt gelöscht');

      return reply.code(204).send();
    }
  );

  // ===========================================================================
  // POST /api/v1/sequences/:id/enroll
  // ===========================================================================
  /**
   * Lead in Sequenz einschreiben
   */
  fastify.post<{
    Params: IdParams;
  }>(
    '/sequences/:id/enroll',
    {
      preHandler: validateApiKey,
      schema: {
        tags: ['Email Sequences'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          properties: {
            lead_id: { type: 'string', format: 'uuid' },
            deal_id: { type: 'string', format: 'uuid' },
            stage_id: { type: 'string', format: 'uuid' },
            metadata: { type: 'object' }
          },
          anyOf: [
            { required: ['lead_id'] },
            { required: ['deal_id'] }
          ]
        }
      }
    },
    async (request) => {
      const { id: sequenceId } = request.params;
      const parseResult = enrollLeadSchema.safeParse(request.body);
      
      if (!parseResult.success) {
        throw new ValidationError('Ungültige Einschreibungs-Daten', {
          validationErrors: parseResult.error.errors
        });
      }

      const { lead_id, deal_id, stage_id, metadata } = parseResult.data;

      // Check sequence exists and is active
      const sequence = await db.queryOne<EmailSequence>(
        'SELECT * FROM email_sequences WHERE id = $1',
        [sequenceId]
      );

      if (!sequence) {
        throw new NotFoundError('Sequenz', sequenceId);
      }

      if (!sequence.is_active) {
        throw new ValidationError('Sequenz ist nicht aktiv');
      }

      let resolvedLeadId = lead_id;
      let resolvedStageId = stage_id;

      if (!resolvedLeadId && deal_id) {
        const deal = await db.queryOne<{ lead_id: string; stage_id: string }>(
          'SELECT lead_id, stage_id FROM deals WHERE id = $1',
          [deal_id]
        );
        resolvedLeadId = deal?.lead_id;
        if (!resolvedStageId) {
          resolvedStageId = deal?.stage_id;
        }
      }

      if (!resolvedLeadId) {
        throw new ValidationError('lead_id konnte nicht ermittelt werden');
      }

      const enrollmentId = await enrollLeadInSequence(resolvedLeadId, sequenceId, metadata, {
        dealId: deal_id,
        stageId: resolvedStageId
      });

      if (!enrollmentId) {
        throw new ValidationError('Lead konnte nicht eingeschrieben werden (möglicherweise abgemeldet)');
      }

      const enrollment = await db.queryOne<EmailSequenceEnrollment>(
        'SELECT * FROM email_sequence_enrollments WHERE id = $1',
        [enrollmentId]
      );

      request.log.info({ sequenceId, leadId: lead_id, enrollmentId }, 'Lead in Sequenz eingeschrieben');

      return enrollment;
    }
  );

  // ===========================================================================
  // GET /api/v1/sequences/:id/enrollments
  // ===========================================================================
  /**
   * Liste aller Einschreibungen für eine Sequenz
   */
  fastify.get<{
    Params: IdParams;
  }>(
    '/sequences/:id/enrollments',
    {
      preHandler: validateApiKey,
      schema: {
        tags: ['Email Sequences'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const { id: sequenceId } = request.params;

      const enrollments = await db.query<EmailSequenceEnrollment & {
        lead_email: string;
        lead_first_name?: string;
        lead_last_name?: string;
      }>(
        `SELECT ese.*, l.email as lead_email, l.first_name as lead_first_name, l.last_name as lead_last_name
         FROM email_sequence_enrollments ese
         JOIN leads l ON ese.lead_id = l.id
         WHERE ese.sequence_id = $1
         ORDER BY ese.enrolled_at DESC`,
        [sequenceId]
      );

      return { data: enrollments };
    }
  );

  // ===========================================================================
  // POST /api/v1/enrollments/:id/pause
  // ===========================================================================
  /**
   * Einschreibung pausieren
   */
  fastify.post<{
    Params: IdParams;
  }>(
    '/enrollments/:id/pause',
    {
      preHandler: validateApiKey,
      schema: {
        tags: ['Email Sequences'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const { id } = request.params;

      const success = await pauseEnrollment(id);

      if (!success) {
        throw new ValidationError('Einschreibung konnte nicht pausiert werden');
      }

      const enrollment = await db.queryOne<EmailSequenceEnrollment>(
        'SELECT * FROM email_sequence_enrollments WHERE id = $1',
        [id]
      );

      return enrollment;
    }
  );

  // ===========================================================================
  // POST /api/v1/enrollments/:id/resume
  // ===========================================================================
  /**
   * Einschreibung fortsetzen
   */
  fastify.post<{
    Params: IdParams;
  }>(
    '/enrollments/:id/resume',
    {
      preHandler: validateApiKey,
      schema: {
        tags: ['Email Sequences'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const { id } = request.params;

      const success = await resumeEnrollment(id);

      if (!success) {
        throw new ValidationError('Einschreibung konnte nicht fortgesetzt werden');
      }

      const enrollment = await db.queryOne<EmailSequenceEnrollment>(
        'SELECT * FROM email_sequence_enrollments WHERE id = $1',
        [id]
      );

      return enrollment;
    }
  );

  // ===========================================================================
  // POST /api/v1/enrollments/:id/send-now
  // ===========================================================================
  /**
   * Nächste E-Mail sofort senden
   */
  fastify.post<{
    Params: IdParams;
  }>(
    '/enrollments/:id/send-now',
    {
      preHandler: validateApiKey,
      schema: {
        tags: ['Email Sequences'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const { id } = request.params;

      const enrollment = await db.queryOne<EmailSequenceEnrollment>(
        'SELECT * FROM email_sequence_enrollments WHERE id = $1',
        [id]
      );

      if (!enrollment) {
        throw new NotFoundError('Einschreibung', id);
      }

      if (enrollment.status !== 'active') {
        throw new ValidationError('Einschreibung ist nicht aktiv');
      }

      await triggerImmediateSend(id);

      return { 
        success: true, 
        message: 'E-Mail-Versand wurde in die Warteschlange gestellt' 
      };
    }
  );

  // ===========================================================================
  // GET /api/v1/sequences/:id/stats
  // ===========================================================================
  /**
   * Statistiken für eine Sequenz
   */
  fastify.get<{
    Params: IdParams;
  }>(
    '/sequences/:id/stats',
    {
      preHandler: validateApiKey,
      schema: {
        tags: ['Email Sequences'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const { id } = request.params;

      const sequence = await db.queryOne<EmailSequence>(
        'SELECT * FROM email_sequences WHERE id = $1',
        [id]
      );

      if (!sequence) {
        throw new NotFoundError('Sequenz', id);
      }

      const overallStats = await emailService.getSequenceStats(id);

      // Get per-step stats
      const steps = await db.query<EmailSequenceStep>(
        'SELECT * FROM email_sequence_steps WHERE sequence_id = $1 ORDER BY position',
        [id]
      );

      const stepStats = await Promise.all(
        steps.map(async (step) => ({
          step_id: step.id,
          position: step.position,
          subject: step.subject,
          stats: await emailService.getStepStats(step.id)
        }))
      );

      // Enrollment stats
      const enrollmentStats = await db.queryOne<{
        total: string;
        active: string;
        completed: string;
        paused: string;
        unsubscribed: string;
      }>(
        `SELECT 
           COUNT(*)::text as total,
           COUNT(*) FILTER (WHERE status = 'active')::text as active,
           COUNT(*) FILTER (WHERE status = 'completed')::text as completed,
           COUNT(*) FILTER (WHERE status = 'paused')::text as paused,
           COUNT(*) FILTER (WHERE status = 'unsubscribed')::text as unsubscribed
         FROM email_sequence_enrollments
         WHERE sequence_id = $1`,
        [id]
      );

      return {
        sequence_id: id,
        sequence_name: sequence.name,
        overall: overallStats,
        steps: stepStats,
        enrollments: {
          total: parseInt(enrollmentStats?.total || '0', 10),
          active: parseInt(enrollmentStats?.active || '0', 10),
          completed: parseInt(enrollmentStats?.completed || '0', 10),
          paused: parseInt(enrollmentStats?.paused || '0', 10),
          unsubscribed: parseInt(enrollmentStats?.unsubscribed || '0', 10)
        }
      };
    }
  );

  // ===========================================================================
  // POST /api/v1/sequences/:id/test-email
  // ===========================================================================
  /**
   * Test-E-Mail an eigene Adresse senden
   */
  fastify.post<{
    Params: IdParams;
  }>(
    '/sequences/:id/test-email',
    {
      preHandler: validateApiKey,
      schema: {
        tags: ['Email Sequences'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        body: {
          type: 'object',
          required: ['email', 'step_position'],
          properties: {
            email: { type: 'string', format: 'email' },
            step_position: { type: 'integer', minimum: 1 }
          }
        }
      }
    },
    async (request) => {
      const { id: sequenceId } = request.params;
      const { email, step_position } = request.body as { email: string; step_position: number };

      const step = await db.queryOne<EmailSequenceStep>(
        'SELECT * FROM email_sequence_steps WHERE sequence_id = $1 AND position = $2',
        [sequenceId, step_position]
      );

      if (!step) {
        throw new NotFoundError('Sequenz-Schritt', `Position ${step_position}`);
      }

      // Replace template variables with test data
      const testVariables: Record<string, string> = {
        first_name: 'Max',
        last_name: 'Mustermann',
        email: email,
        company: 'Test GmbH',
        full_name: 'Max Mustermann'
      };

      const replaceVariables = (text: string): string => {
        let result = text;
        for (const [key, value] of Object.entries(testVariables)) {
          const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
          result = result.replace(regex, value);
        }
        return result;
      };

      const result = await emailService.sendEmail({
        to: email,
        subject: `[TEST] ${replaceVariables(step.subject)}`,
        html: replaceVariables(step.body_html),
        text: step.body_text ? replaceVariables(step.body_text) : undefined
      });

      if (result.success) {
        request.log.info({ sequenceId, stepPosition: step_position, email }, 'Test-E-Mail gesendet');
      }

      return {
        success: result.success,
        message: result.success 
          ? `Test-E-Mail wurde an ${email} gesendet` 
          : `Fehler beim Senden: ${result.error}`,
        message_id: result.messageId
      };
    }
  );
}

export default sequencesRoutes;
