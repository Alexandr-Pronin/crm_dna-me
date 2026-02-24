// =============================================================================
// src/services/activityService.ts
// Records activity events for "Letzte Aktivitäten" (dashboard and feeds).
// Used by MessageService, Lead API, Deal API, etc.
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';

export type ActivitySource =
  | 'waalaxy'
  | 'portal'
  | 'lemlist'
  | 'ads'
  | 'conference'
  | 'website'
  | 'linkedin'
  | 'manual'
  | 'api'
  | 'import'
  | 'imap'
  | 'trigger'
  | 'system';

export interface RecordActivityInput {
  lead_id: string;
  event_type: string;
  event_category?: string;
  source: ActivitySource;
  metadata?: Record<string, unknown>;
  /** Defaults to NOW() so the event lands in the current partition. */
  occurred_at?: Date;
  /** If true, also update lead.last_activity (default true). */
  update_lead_activity?: boolean;
}

/**
 * Inserts one row into `events` and optionally updates `leads.last_activity`.
 * Uses occurred_at = NOW() by default so the event is in the current month partition.
 */
export async function recordActivity(input: RecordActivityInput): Promise<void> {
  const occurredAt = input.occurred_at ?? new Date();
  const updateLead = input.update_lead_activity !== false;

  await db.execute(
    `INSERT INTO events (
      id, lead_id, event_type, event_category, source,
      metadata, occurred_at
    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
    [
      uuidv4(),
      input.lead_id,
      input.event_type,
      input.event_category ?? 'activity',
      input.source,
      JSON.stringify(input.metadata ?? {}),
      occurredAt,
    ],
  );

  if (updateLead) {
    await db.execute(
      `UPDATE leads SET last_activity = $1, updated_at = NOW() WHERE id = $2`,
      [occurredAt, input.lead_id],
    );
  }
}

export interface RecordSystemActivityInput {
  event_type: string;
  event_category?: string;
  source?: ActivitySource;
  metadata?: Record<string, unknown>;
  occurred_at?: Date;
}

/**
 * Inserts a system event (no lead_id) for "Letzte Aktivitäten", e.g. new team member registered.
 */
export async function recordSystemActivity(input: RecordSystemActivityInput): Promise<void> {
  const occurredAt = input.occurred_at ?? new Date();
  await db.execute(
    `INSERT INTO events (
      id, lead_id, event_type, event_category, source,
      metadata, occurred_at
    ) VALUES ($1, NULL, $2, $3, $4, $5::jsonb, $6)`,
    [
      uuidv4(),
      input.event_type,
      input.event_category ?? 'system',
      input.source ?? 'system',
      JSON.stringify(input.metadata ?? {}),
      occurredAt,
    ],
  );
}
