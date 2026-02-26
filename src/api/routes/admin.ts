// =============================================================================
// src/api/routes/admin.ts
// Admin-only endpoints (e.g. clear databases with schema and cascade info)
// =============================================================================

import type { FastifyInstance } from 'fastify';
import { authenticateOrApiKey } from '../middleware/auth.js';
import { db } from '../../db/index.js';
import { ValidationError } from '../../errors/index.js';
import { getClearDbSchema } from '../clearDbSchema.js';

// =============================================================================
// Route Registration
// =============================================================================

/** All tables we can truncate (for "clear all"). Order: leafs first for CASCADE. */
const ALL_CLEARABLE_TABLES = [
  'automation_logs',
  'tasks',
  'messages',
  'conversations',
  'email_tracking',
  'email_sequence_enrollments',
  'email_sequence_steps',
  'email_sequences',
  'automation_rules',
  'deals',
  'score_history',
  'intent_signals',
  'events',
  'leads',
  'campaigns',
  'organizations',
];

const SCHEMA_GROUPS = getClearDbSchema().groups;
const TABLE_BY_GROUP_ID = new Map(SCHEMA_GROUPS.map((g) => [g.id, g.tableName]));

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /admin/clear-databases/schema
   * Returns clearable groups, FK edges, and labels for interactive UI.
   * Admin only.
   */
  fastify.get(
    '/admin/clear-databases/schema',
    { preHandler: [authenticateOrApiKey] },
    async (request, reply) => {
      const user = request.user as { id: string; role: string } | undefined;
      if (!user?.role || user.role !== 'admin') {
        throw new ValidationError('Only administrators can view the schema.');
      }
      return reply.send(getClearDbSchema());
    }
  );

  /**
   * POST /admin/clear-databases
   * Body: { groupIds?: string[] } — if provided, only these groups are cleared; otherwise all.
   * Each group maps to one table; TRUNCATE ... CASCADE is used so dependent tables are removed.
   * Admin only.
   */
  fastify.post<{ Body: { groupIds?: string[] } }>(
    '/admin/clear-databases',
    { preHandler: [authenticateOrApiKey] },
    async (request, reply) => {
      const user = request.user as { id: string; role: string } | undefined;
      if (!user?.role || user.role !== 'admin') {
        throw new ValidationError('Only administrators can clear databases.');
      }

      const groupIds = request.body?.groupIds;
      const tablesToTruncate: string[] =
        Array.isArray(groupIds) && groupIds.length > 0
          ? groupIds
              .map((id) => TABLE_BY_GROUP_ID.get(id))
              .filter((t): t is string => Boolean(t))
          : ALL_CLEARABLE_TABLES;

      if (tablesToTruncate.length === 0) {
        return reply.code(200).send({
          success: true,
          message: 'No tables selected.',
          cleared_tables: [],
        });
      }

      await db.transaction(async (client) => {
        await client.query(
          `TRUNCATE TABLE ${tablesToTruncate.join(', ')} RESTART IDENTITY CASCADE`
        );
      });

      return reply.code(200).send({
        success: true,
        message: 'Selected databases cleared successfully.',
        cleared_tables: tablesToTruncate,
      });
    }
  );
}
