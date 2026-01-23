// =============================================================================
// src/services/leadService.ts
// Lead Management Service
// =============================================================================

import { db } from '../db/index.js';
import { NotFoundError, ConflictError, ValidationError } from '../errors/index.js';
import type {
  Lead,
  MarketingEvent,
  ScoreHistory,
  IntentSignal,
  PaginatedResponse
} from '../types/index.js';
import type {
  CreateLeadInput,
  UpdateLeadInput,
  LeadFiltersInput,
  ManualRouteInput
} from '../api/schemas/leads.js';

// =============================================================================
// Lead Service Class
// =============================================================================

export class LeadService {
  // ===========================================================================
  // Organization Helpers
  // ===========================================================================

  private extractDomainFromEmail(email?: string | null): string | null {
    if (!email) return null;
    const atIndex = email.indexOf('@');
    if (atIndex === -1) return null;
    const domain = email.slice(atIndex + 1).trim().toLowerCase();
    return domain || null;
  }

  private async getOrganizationIdByDomain(domain: string): Promise<string | null> {
    const org = await db.queryOne<{ id: string }>(
      'SELECT id FROM organizations WHERE domain = $1 ORDER BY created_at ASC LIMIT 1',
      [domain]
    );
    return org?.id ?? null;
  }

  private async createOrganizationForDomain(domain: string): Promise<string> {
    const name = domain;
    const rows = await db.query<{ id: string }>(
      `INSERT INTO organizations (name, domain, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING id`,
      [name, domain]
    );
    return rows[0].id;
  }

  // ===========================================================================
  // Find or Create Lead
  // ===========================================================================
  
  /**
   * Find existing lead by identifier or create new one.
   * Priority: email > portal_id > waalaxy_id > linkedin_url > lemlist_id
   */
  async findOrCreateLead(
    identifier: {
      email?: string;
      portal_id?: string;
      waalaxy_id?: string;
      linkedin_url?: string;
      lemlist_id?: string;
    },
    defaults?: Partial<CreateLeadInput>
  ): Promise<{ lead: Lead; created: boolean }> {
    // Try to find existing lead
    let lead = await this.findByIdentifier(identifier);
    
    if (lead) {
      return { lead, created: false };
    }
    
    // Create new lead
    if (!identifier.email) {
      throw new ValidationError('Email is required to create a new lead');
    }
    
    const newLead = await this.createLead({
      email: identifier.email,
      portal_id: identifier.portal_id,
      waalaxy_id: identifier.waalaxy_id,
      linkedin_url: identifier.linkedin_url,
      lemlist_id: identifier.lemlist_id,
      ...defaults
    });
    
    return { lead: newLead, created: true };
  }

  // ===========================================================================
  // Find by Identifier
  // ===========================================================================
  
  /**
   * Find lead by any identifier
   */
  async findByIdentifier(identifier: {
    email?: string;
    portal_id?: string;
    waalaxy_id?: string;
    linkedin_url?: string;
    lemlist_id?: string;
  }): Promise<Lead | null> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;
    
    if (identifier.email) {
      conditions.push(`email = $${paramIndex++}`);
      params.push(identifier.email.toLowerCase());
    }
    if (identifier.portal_id) {
      conditions.push(`portal_id = $${paramIndex++}`);
      params.push(identifier.portal_id);
    }
    if (identifier.waalaxy_id) {
      conditions.push(`waalaxy_id = $${paramIndex++}`);
      params.push(identifier.waalaxy_id);
    }
    if (identifier.linkedin_url) {
      conditions.push(`linkedin_url = $${paramIndex++}`);
      params.push(identifier.linkedin_url);
    }
    if (identifier.lemlist_id) {
      conditions.push(`lemlist_id = $${paramIndex++}`);
      params.push(identifier.lemlist_id);
    }
    
    if (conditions.length === 0) {
      return null;
    }
    
    const sql = `
      SELECT * FROM leads 
      WHERE ${conditions.join(' OR ')}
      LIMIT 1
    `;
    
    return await db.queryOne<Lead>(sql, params);
  }

  // ===========================================================================
  // Get Lead by ID
  // ===========================================================================
  
  async getLeadById(id: string): Promise<Lead> {
    const lead = await db.queryOne<Lead>(
      'SELECT * FROM leads WHERE id = $1',
      [id]
    );
    
    if (!lead) {
      throw new NotFoundError('Lead', id);
    }
    
    return lead;
  }

  // ===========================================================================
  // Get Lead by Email
  // ===========================================================================
  
  async getLeadByEmail(email: string): Promise<Lead | null> {
    return await db.queryOne<Lead>(
      'SELECT * FROM leads WHERE email = $1',
      [email.toLowerCase()]
    );
  }

  // ===========================================================================
  // Create Lead
  // ===========================================================================
  
  async createLead(data: CreateLeadInput): Promise<Lead> {
    // Check for duplicate email
    const existing = await this.getLeadByEmail(data.email);
    if (existing) {
      throw new ConflictError('Lead with this email already exists', {
        email: data.email,
        existing_lead_id: existing.id
      });
    }
    
    const now = new Date().toISOString();
    let organizationId = data.organization_id || null;

    if (!organizationId) {
      const domain = this.extractDomainFromEmail(data.email);
      if (domain) {
        const existingOrgId = await this.getOrganizationIdByDomain(domain);
        organizationId = existingOrgId || (await this.createOrganizationForDomain(domain));
      }
    }
    
    const sql = `
      INSERT INTO leads (
        email, first_name, last_name, phone, job_title,
        organization_id, status, lifecycle_stage,
        portal_id, waalaxy_id, linkedin_url, lemlist_id,
        consent_date, consent_source,
        first_touch_source, first_touch_campaign, first_touch_date,
        last_touch_source, last_touch_campaign, last_touch_date,
        created_at, updated_at, last_activity
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14,
        $15, $16, $17,
        $15, $16, $17,
        NOW(), NOW(), NOW()
      )
      RETURNING *
    `;
    
    const params = [
      data.email.toLowerCase(),
      data.first_name || null,
      data.last_name || null,
      data.phone || null,
      data.job_title || null,
      organizationId,
      data.status || 'new',
      data.lifecycle_stage || 'lead',
      data.portal_id || null,
      data.waalaxy_id || null,
      data.linkedin_url || null,
      data.lemlist_id || null,
      data.consent_date || null,
      data.consent_source || null,
      data.first_touch_source || null,
      data.first_touch_campaign || null,
      data.first_touch_source ? now : null
    ];
    
    const leads = await db.query<Lead>(sql, params);
    return leads[0];
  }

  // ===========================================================================
  // Update Lead
  // ===========================================================================
  
  async updateLead(id: string, data: UpdateLeadInput): Promise<Lead> {
    // Check if lead exists
    await this.getLeadById(id);
    
    // Check for email conflict
    if (data.email) {
      const existing = await this.getLeadByEmail(data.email);
      if (existing && existing.id !== id) {
        throw new ConflictError('Another lead with this email already exists', {
          email: data.email,
          existing_lead_id: existing.id
        });
      }
    }
    
    // Build dynamic update query
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;
    
    const fields: (keyof UpdateLeadInput)[] = [
      'email', 'first_name', 'last_name', 'phone', 'job_title',
      'organization_id', 'status', 'lifecycle_stage',
      'portal_id', 'waalaxy_id', 'linkedin_url', 'lemlist_id',
      'consent_date', 'consent_source', 'gdpr_delete_requested'
    ];
    
    for (const field of fields) {
      if (field in data) {
        updates.push(`${field} = $${paramIndex++}`);
        let value = data[field];
        // Normalize email to lowercase
        if (field === 'email' && typeof value === 'string') {
          value = value.toLowerCase();
        }
        params.push(value);
      }
    }
    
    if (updates.length === 0) {
      return this.getLeadById(id);
    }
    
    params.push(id);
    
    const sql = `
      UPDATE leads 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const leads = await db.query<Lead>(sql, params);
    return leads[0];
  }

  // ===========================================================================
  // Delete Lead
  // ===========================================================================
  
  async deleteLead(id: string): Promise<void> {
    // Check if lead exists
    await this.getLeadById(id);
    
    await db.execute('DELETE FROM leads WHERE id = $1', [id]);
  }

  // ===========================================================================
  // Search Leads
  // ===========================================================================
  
  async searchLeads(filters: LeadFiltersInput): Promise<PaginatedResponse<Lead>> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;
    
    // Full text search
    if (filters.search) {
      conditions.push(`(
        email ILIKE $${paramIndex} OR
        first_name ILIKE $${paramIndex} OR
        last_name ILIKE $${paramIndex} OR
        job_title ILIKE $${paramIndex}
      )`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }
    
    // Status filters
    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }
    
    if (filters.lifecycle_stage) {
      conditions.push(`lifecycle_stage = $${paramIndex++}`);
      params.push(filters.lifecycle_stage);
    }
    
    if (filters.routing_status) {
      conditions.push(`routing_status = $${paramIndex++}`);
      params.push(filters.routing_status);
    }
    
    if (filters.primary_intent) {
      conditions.push(`primary_intent = $${paramIndex++}`);
      params.push(filters.primary_intent);
    }
    
    if (filters.pipeline_id) {
      conditions.push(`pipeline_id = $${paramIndex++}`);
      params.push(filters.pipeline_id);
    }
    
    if (filters.organization_id) {
      conditions.push(`organization_id = $${paramIndex++}`);
      params.push(filters.organization_id);
    }
    
    // Score filters
    if (filters.min_score !== undefined) {
      conditions.push(`total_score >= $${paramIndex++}`);
      params.push(filters.min_score);
    }
    
    if (filters.max_score !== undefined) {
      conditions.push(`total_score <= $${paramIndex++}`);
      params.push(filters.max_score);
    }
    
    if (filters.min_intent_confidence !== undefined) {
      conditions.push(`intent_confidence >= $${paramIndex++}`);
      params.push(filters.min_intent_confidence);
    }
    
    // Date filters
    if (filters.created_after) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(filters.created_after);
    }
    
    if (filters.created_before) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(filters.created_before);
    }
    
    if (filters.last_activity_after) {
      conditions.push(`last_activity >= $${paramIndex++}`);
      params.push(filters.last_activity_after);
    }
    
    if (filters.last_activity_before) {
      conditions.push(`last_activity <= $${paramIndex++}`);
      params.push(filters.last_activity_before);
    }
    
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';
    
    // Count total
    const countSql = `SELECT COUNT(*) as count FROM leads ${whereClause}`;
    const countResult = await db.queryOne<{ count: string }>(countSql, params);
    const total = parseInt(countResult?.count || '0', 10);
    
    // Calculate pagination
    const page = filters.page;
    const limit = filters.limit;
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);
    
    // Build order clause
    const sortBy = filters.sort_by;
    const sortOrder = filters.sort_order.toUpperCase();
    const orderClause = `ORDER BY ${sortBy} ${sortOrder} NULLS LAST`;
    
    // Get data
    const dataSql = `
      SELECT * FROM leads 
      ${whereClause}
      ${orderClause}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    
    const dataParams = [...params, limit, offset];
    const data = await db.query<Lead>(dataSql, dataParams);
    
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    };
  }

  // ===========================================================================
  // Get Unrouted Leads
  // ===========================================================================
  
  async getUnroutedLeads(limit: number = 50): Promise<Lead[]> {
    return await db.query<Lead>(
      `SELECT * FROM leads 
       WHERE routing_status = 'unrouted' 
       ORDER BY total_score DESC, created_at ASC
       LIMIT $1`,
      [limit]
    );
  }

  // ===========================================================================
  // Get Lead Events
  // ===========================================================================
  
  async getLeadEvents(
    leadId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<MarketingEvent[]> {
    // Verify lead exists
    await this.getLeadById(leadId);
    
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    
    return await db.query<MarketingEvent>(
      `SELECT * FROM events 
       WHERE lead_id = $1 
       ORDER BY occurred_at DESC
       LIMIT $2 OFFSET $3`,
      [leadId, limit, offset]
    );
  }

  // ===========================================================================
  // Get Lead Score History
  // ===========================================================================
  
  async getLeadScoreHistory(
    leadId: string,
    options?: { limit?: number; offset?: number; category?: string }
  ): Promise<ScoreHistory[]> {
    // Verify lead exists
    await this.getLeadById(leadId);
    
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    
    let sql = `SELECT * FROM score_history WHERE lead_id = $1`;
    const params: unknown[] = [leadId];
    let paramIndex = 2;
    
    if (options?.category) {
      sql += ` AND category = $${paramIndex++}`;
      params.push(options.category);
    }
    
    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);
    
    return await db.query<ScoreHistory>(sql, params);
  }

  // ===========================================================================
  // Get Lead Intent Signals
  // ===========================================================================
  
  async getLeadIntentSignals(
    leadId: string,
    options?: { limit?: number; offset?: number; intent?: string }
  ): Promise<IntentSignal[]> {
    // Verify lead exists
    await this.getLeadById(leadId);
    
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    
    let sql = `SELECT * FROM intent_signals WHERE lead_id = $1`;
    const params: unknown[] = [leadId];
    let paramIndex = 2;
    
    if (options?.intent) {
      sql += ` AND intent = $${paramIndex++}`;
      params.push(options.intent);
    }
    
    sql += ` ORDER BY detected_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);
    
    return await db.query<IntentSignal>(sql, params);
  }

  // ===========================================================================
  // Manual Route Lead
  // ===========================================================================
  
  async manualRouteLead(leadId: string, data: ManualRouteInput): Promise<Lead> {
    const lead = await this.getLeadById(leadId);
    
    // Verify pipeline exists
    const pipeline = await db.queryOne(
      'SELECT id, slug FROM pipelines WHERE id = $1 AND is_active = TRUE',
      [data.pipeline_id]
    );
    
    if (!pipeline) {
      throw new NotFoundError('Pipeline', data.pipeline_id);
    }
    
    // Get first stage if not specified
    let stageId = data.stage_id;
    if (!stageId) {
      const firstStage = await db.queryOne<{ id: string }>(
        `SELECT id FROM pipeline_stages 
         WHERE pipeline_id = $1 
         ORDER BY position ASC LIMIT 1`,
        [data.pipeline_id]
      );
      if (!firstStage) {
        throw new ValidationError('Pipeline has no stages');
      }
      stageId = firstStage.id;
    }
    
    // Update lead routing status
    const updatedLead = await db.queryOne<Lead>(
      `UPDATE leads SET
        pipeline_id = $1,
        routing_status = 'routed',
        routed_at = NOW(),
        updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [data.pipeline_id, leadId]
    );
    
    // Create deal in pipeline
    await db.execute(
      `INSERT INTO deals (
        lead_id, pipeline_id, stage_id, name, 
        assigned_to, assigned_at, status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, 'open', NOW(), NOW()
      )
      ON CONFLICT (lead_id, pipeline_id) DO UPDATE SET
        stage_id = EXCLUDED.stage_id,
        assigned_to = EXCLUDED.assigned_to,
        assigned_at = EXCLUDED.assigned_at,
        updated_at = NOW()`,
      [
        leadId,
        data.pipeline_id,
        stageId,
        `${lead.first_name || ''} ${lead.last_name || ''} - ${lead.email}`.trim(),
        data.assigned_to || null,
        data.assigned_to ? new Date().toISOString() : null
      ]
    );
    
    return updatedLead!;
  }

  // ===========================================================================
  // Update Lead Activity
  // ===========================================================================
  
  async updateLastActivity(leadId: string): Promise<void> {
    await db.execute(
      'UPDATE leads SET last_activity = NOW() WHERE id = $1',
      [leadId]
    );
  }

  // ===========================================================================
  // Update Lead Attribution
  // ===========================================================================
  
  async updateAttribution(
    leadId: string,
    source: string,
    campaign?: string
  ): Promise<void> {
    const lead = await this.getLeadById(leadId);
    
    // Update last touch always
    await db.execute(
      `UPDATE leads SET
        last_touch_source = $1,
        last_touch_campaign = $2,
        last_touch_date = NOW()
       WHERE id = $3`,
      [source, campaign || null, leadId]
    );
    
    // Set first touch only if not set
    if (!lead.first_touch_source) {
      await db.execute(
        `UPDATE leads SET
          first_touch_source = $1,
          first_touch_campaign = $2,
          first_touch_date = NOW()
         WHERE id = $3 AND first_touch_source IS NULL`,
        [source, campaign || null, leadId]
      );
    }
  }

  // ===========================================================================
  // Get Leads Count by Status
  // ===========================================================================
  
  async getLeadCountsByStatus(): Promise<Record<string, number>> {
    const results = await db.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) as count FROM leads GROUP BY status`
    );
    
    return results.reduce((acc, row) => {
      acc[row.status] = parseInt(row.count, 10);
      return acc;
    }, {} as Record<string, number>);
  }

  // ===========================================================================
  // Get Leads Count by Routing Status
  // ===========================================================================
  
  async getLeadCountsByRoutingStatus(): Promise<Record<string, number>> {
    const results = await db.query<{ routing_status: string; count: string }>(
      `SELECT routing_status, COUNT(*) as count FROM leads GROUP BY routing_status`
    );
    
    return results.reduce((acc, row) => {
      acc[row.routing_status] = parseInt(row.count, 10);
      return acc;
    }, {} as Record<string, number>);
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let leadServiceInstance: LeadService | null = null;

export function getLeadService(): LeadService {
  if (!leadServiceInstance) {
    leadServiceInstance = new LeadService();
  }
  return leadServiceInstance;
}

export const leadService = {
  get instance() {
    return getLeadService();
  }
};

export default leadService;
