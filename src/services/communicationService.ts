// =============================================================================
// src/services/communicationService.ts
// Communication Management Service
// =============================================================================

import { db } from '../db/index.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import type { Communication, CommunicationType, CommunicationDirection } from '../types/index.js';

// =============================================================================
// Types
// =============================================================================

export interface CreateCommunicationInput {
  lead_id: string;
  deal_id?: string;
  comm_type: CommunicationType;
  subject?: string;
  body: string;
  direction?: CommunicationDirection;
  created_by?: string;
  metadata?: Record<string, unknown>;
}

export interface CommunicationWithRelations extends Communication {
  lead_email?: string;
  lead_name?: string;
  deal_name?: string;
}

// =============================================================================
// Communication Service Class
// =============================================================================

export class CommunicationService {

  async createCommunication(data: CreateCommunicationInput): Promise<Communication> {
    const lead = await db.queryOne<{ id: string }>(
      'SELECT id FROM leads WHERE id = $1',
      [data.lead_id]
    );
    if (!lead) {
      throw new NotFoundError('Lead', data.lead_id);
    }

    if (data.deal_id) {
      const deal = await db.queryOne<{ id: string }>(
        'SELECT id FROM deals WHERE id = $1',
        [data.deal_id]
      );
      if (!deal) {
        throw new NotFoundError('Deal', data.deal_id);
      }
    }

    const sql = `
      INSERT INTO communications (
        lead_id, deal_id, comm_type, subject, body,
        direction, created_by, metadata, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, NOW()
      )
      RETURNING *
    `;

    const params = [
      data.lead_id,
      data.deal_id || null,
      data.comm_type,
      data.subject || null,
      data.body,
      data.direction || 'outbound',
      data.created_by || null,
      JSON.stringify(data.metadata || {})
    ];

    const rows = await db.query<Communication>(sql, params);
    return rows[0];
  }

  async getCommunicationById(id: string): Promise<Communication> {
    const comm = await db.queryOne<Communication>(
      'SELECT * FROM communications WHERE id = $1',
      [id]
    );
    if (!comm) {
      throw new NotFoundError('Communication', id);
    }
    return comm;
  }

  async getCommunicationsByLead(
    leadId: string,
    options?: { comm_type?: CommunicationType; limit?: number; offset?: number }
  ): Promise<CommunicationWithRelations[]> {
    let sql = `
      SELECT 
        c.*,
        l.email as lead_email,
        CONCAT(l.first_name, ' ', l.last_name) as lead_name,
        d.name as deal_name
      FROM communications c
      LEFT JOIN leads l ON l.id = c.lead_id
      LEFT JOIN deals d ON d.id = c.deal_id
      WHERE c.lead_id = $1
    `;
    const params: unknown[] = [leadId];
    let paramIndex = 2;

    if (options?.comm_type) {
      sql += ` AND c.comm_type = $${paramIndex++}`;
      params.push(options.comm_type);
    }

    sql += ' ORDER BY c.created_at DESC';

    if (options?.limit) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }

    if (options?.offset) {
      sql += ` OFFSET $${paramIndex++}`;
      params.push(options.offset);
    }

    return await db.query<CommunicationWithRelations>(sql, params);
  }

  async deleteCommunication(id: string): Promise<void> {
    await this.getCommunicationById(id);
    await db.execute('DELETE FROM communications WHERE id = $1', [id]);
  }

  async getLeadTimeline(
    leadId: string
  ): Promise<Array<CommunicationWithRelations | { type: 'task'; [key: string]: unknown }>> {
    const comms = await this.getCommunicationsByLead(leadId);

    const tasks = await db.query<Record<string, unknown>>(`
      SELECT t.*, 'task' as timeline_type
      FROM tasks t
      WHERE t.lead_id = $1
      ORDER BY t.created_at DESC
    `, [leadId]);

    const timeline = [
      ...comms.map(c => ({ ...c, timeline_type: 'communication' as const })),
      ...tasks.map(t => ({ ...t, timeline_type: 'task' as const }))
    ];

    timeline.sort((a, b) => {
      const dateA = new Date(a.created_at as string | Date).getTime();
      const dateB = new Date(b.created_at as string | Date).getTime();
      return dateB - dateA;
    });

    return timeline as any;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let instance: CommunicationService | null = null;

export function getCommunicationService(): CommunicationService {
  if (!instance) {
    instance = new CommunicationService();
  }
  return instance;
}

export default { get instance() { return getCommunicationService(); } };
