// =============================================================================
// src/services/organizationService.ts
// Organization Management Service
// =============================================================================

import { db } from '../db/index.js';
import { NotFoundError } from '../errors/index.js';
import type { Organization } from '../types/index.js';
import type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  OrganizationFiltersInput
} from '../api/schemas/organizations.js';

// =============================================================================
// Types
// =============================================================================

export interface OrganizationListResult {
  data: Organization[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// =============================================================================
// Organization Service Class
// =============================================================================

export class OrganizationService {
  // ===========================================================================
  // List Organizations
  // ===========================================================================

  async getOrganizations(filters: OrganizationFiltersInput): Promise<OrganizationListResult> {
    const {
      page,
      limit,
      sort_by,
      sort_order,
      search,
      domain,
      industry,
      company_size,
      country
    } = filters;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(name ILIKE $${paramIndex} OR domain ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex += 1;
    }

    if (domain) {
      conditions.push(`domain = $${paramIndex++}`);
      params.push(domain);
    }

    if (industry) {
      conditions.push(`industry = $${paramIndex++}`);
      params.push(industry);
    }

    if (company_size) {
      conditions.push(`company_size = $${paramIndex++}`);
      params.push(company_size);
    }

    if (country) {
      conditions.push(`country = $${paramIndex++}`);
      params.push(country);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const allowedSortFields = new Set([
      'created_at',
      'updated_at',
      'name',
      'domain',
      'industry',
      'company_size',
      'country'
    ]);
    const sortField = allowedSortFields.has(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order === 'asc' ? 'ASC' : 'DESC';

    const totalRow = await db.queryOne<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM organizations ${whereClause}`,
      params
    );
    const total = totalRow?.count ?? 0;
    const offset = (page - 1) * limit;

    const data = await db.query<Organization>(
      `SELECT * FROM organizations ${whereClause}
       ORDER BY ${sortField} ${sortDirection}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const totalPages = Math.max(1, Math.ceil(total / limit));

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
  // Get Organization by ID
  // ===========================================================================

  async getOrganizationById(id: string): Promise<Organization> {
    const organization = await db.queryOne<Organization>(
      'SELECT * FROM organizations WHERE id = $1',
      [id]
    );

    if (!organization) {
      throw new NotFoundError('Organization', id);
    }

    return organization;
  }

  // ===========================================================================
  // Create Organization
  // ===========================================================================

  async createOrganization(data: CreateOrganizationInput): Promise<Organization> {
    const sql = `
      INSERT INTO organizations (
        name, domain, industry, company_size, country,
        portal_id, moco_id, metadata, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, NOW(), NOW()
      )
      RETURNING *
    `;

    const params = [
      data.name,
      data.domain || null,
      data.industry || null,
      data.company_size || null,
      data.country || null,
      data.portal_id || null,
      data.moco_id || null,
      data.metadata || {}
    ];

    const rows = await db.query<Organization>(sql, params);
    return rows[0];
  }

  // ===========================================================================
  // Update Organization
  // ===========================================================================

  async updateOrganization(id: string, data: UpdateOrganizationInput): Promise<Organization> {
    await this.getOrganizationById(id);

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    const fields: (keyof UpdateOrganizationInput)[] = [
      'name',
      'domain',
      'industry',
      'company_size',
      'country',
      'portal_id',
      'moco_id',
      'metadata'
    ];

    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        updates.push(`${field} = $${paramIndex++}`);
        params.push(data[field] ?? null);
      }
    }

    if (updates.length === 0) {
      return this.getOrganizationById(id);
    }

    updates.push(`updated_at = NOW()`);

    const sql = `
      UPDATE organizations
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const rows = await db.query<Organization>(sql, [...params, id]);
    return rows[0];
  }

  // ===========================================================================
  // Delete Organization
  // ===========================================================================

  async deleteOrganization(id: string): Promise<void> {
    const result = await db.execute(
      'DELETE FROM organizations WHERE id = $1',
      [id]
    );

    if (!result) {
      throw new NotFoundError('Organization', id);
    }
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let organizationServiceInstance: OrganizationService | null = null;

export function getOrganizationService(): OrganizationService {
  if (!organizationServiceInstance) {
    organizationServiceInstance = new OrganizationService();
  }
  return organizationServiceInstance;
}

export const organizationService = {
  get instance() {
    return getOrganizationService();
  }
};

export default organizationService;
