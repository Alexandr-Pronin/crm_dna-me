// =============================================================================
// src/api/routes/team.ts
// Team Member Management API Routes
// =============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { validateApiKey } from '../middleware/apiKey.js';
import {
  createTeamMemberSchema,
  updateTeamMemberSchema,
  teamMemberFiltersSchema,
  teamMemberIdParamSchema,
  type CreateTeamMemberInput,
  type UpdateTeamMemberInput,
  type TeamMemberFiltersInput,
  type TeamMemberResponse,
  type TeamMemberListResponse,
  type TeamMemberStatsResponse
} from '../schemas/team.js';
import { db } from '../../db/index.js';
import { ValidationError, NotFoundError, ConflictError } from '../../errors/index.js';
import type { TeamMember } from '../../types/index.js';

// =============================================================================
// Type Extensions
// =============================================================================

interface IdParams {
  id: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Transform TeamMember entity to API response format
 */
function transformTeamMemberResponse(member: TeamMember): TeamMemberResponse {
  return {
    id: member.id,
    email: member.email,
    name: member.name,
    role: member.role,
    region: member.region ?? null,
    is_active: member.is_active,
    max_leads: member.max_leads,
    current_leads: member.current_leads,
    created_at: member.created_at?.toISOString?.() ?? (member.created_at as unknown as string)
  };
}

// =============================================================================
// Route Registration
// =============================================================================

export async function teamRoutes(fastify: FastifyInstance): Promise<void> {

  // ===========================================================================
  // GET /api/v1/team
  // ===========================================================================
  /**
   * List team members with filtering, searching, and pagination.
   */
  fastify.get<{
    Querystring: TeamMemberFiltersInput;
    Reply: TeamMemberListResponse;
  }>(
    '/team',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'List team members with filtering and pagination',
        tags: ['Team'],
        querystring: {
          type: 'object',
          properties: {
            search: { type: 'string', description: 'Search in email and name' },
            role: { type: 'string', enum: ['bdr', 'ae', 'partnership_manager', 'marketing_manager', 'admin'] },
            region: { type: 'string' },
            is_active: { type: 'boolean' },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sort_by: { type: 'string', enum: ['created_at', 'name', 'email', 'role', 'region', 'current_leads'], default: 'name' },
            sort_order: { type: 'string', enum: ['asc', 'desc'], default: 'asc' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { type: 'object' } },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  total: { type: 'integer' },
                  total_pages: { type: 'integer' },
                  has_next: { type: 'boolean' },
                  has_prev: { type: 'boolean' }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const parseResult = teamMemberFiltersSchema.safeParse(request.query);
      
      if (!parseResult.success) {
        throw new ValidationError('Ungültige Query-Parameter', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const filters = parseResult.data;
      const offset = (filters.page - 1) * filters.limit;
      
      // Build WHERE clause
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;
      
      if (filters.search) {
        conditions.push(`(email ILIKE $${paramIndex} OR name ILIKE $${paramIndex})`);
        params.push(`%${filters.search}%`);
        paramIndex++;
      }
      
      if (filters.role) {
        conditions.push(`role = $${paramIndex}`);
        params.push(filters.role);
        paramIndex++;
      }
      
      if (filters.region) {
        conditions.push(`region = $${paramIndex}`);
        params.push(filters.region);
        paramIndex++;
      }
      
      if (filters.is_active !== undefined) {
        conditions.push(`is_active = $${paramIndex}`);
        params.push(filters.is_active);
        paramIndex++;
      }
      
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      // Get total count
      const countSql = `SELECT COUNT(*) as count FROM team_members ${whereClause}`;
      const countResult = await db.queryOne<{ count: string }>(countSql, params);
      const total = parseInt(countResult?.count || '0', 10);
      
      // Get paginated results
      const allowedSortColumns = ['created_at', 'name', 'email', 'role', 'region', 'current_leads'];
      const sortColumn = allowedSortColumns.includes(filters.sort_by) ? filters.sort_by : 'name';
      const sortOrder = filters.sort_order === 'desc' ? 'DESC' : 'ASC';
      
      const dataSql = `
        SELECT * FROM team_members 
        ${whereClause}
        ORDER BY ${sortColumn} ${sortOrder}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      const members = await db.query<TeamMember>(dataSql, [...params, filters.limit, offset]);
      
      const totalPages = Math.ceil(total / filters.limit);
      
      return {
        data: members.map(transformTeamMemberResponse),
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          total_pages: totalPages,
          has_next: filters.page < totalPages,
          has_prev: filters.page > 1
        }
      };
    }
  );

  // ===========================================================================
  // GET /api/v1/team/stats
  // ===========================================================================
  /**
   * Get team statistics.
   */
  fastify.get<{
    Reply: TeamMemberStatsResponse;
  }>(
    '/team/stats',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Get team member statistics',
        tags: ['Team'],
        response: {
          200: {
            type: 'object',
            properties: {
              total_members: { type: 'integer' },
              active_members: { type: 'integer' },
              by_role: { type: 'object' },
              by_region: { type: 'object' },
              total_capacity: { type: 'integer' },
              total_assigned: { type: 'integer' },
              utilization_percentage: { type: 'number' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      // Get counts by role
      const byRoleSql = `
        SELECT role, COUNT(*) as count 
        FROM team_members 
        WHERE is_active = true 
        GROUP BY role
      `;
      const roleResults = await db.query<{ role: string; count: string }>(byRoleSql);
      const byRole: Record<string, number> = {};
      for (const row of roleResults) {
        byRole[row.role] = parseInt(row.count, 10);
      }
      
      // Get counts by region
      const byRegionSql = `
        SELECT COALESCE(region, 'unassigned') as region, COUNT(*) as count 
        FROM team_members 
        WHERE is_active = true 
        GROUP BY region
      `;
      const regionResults = await db.query<{ region: string; count: string }>(byRegionSql);
      const byRegion: Record<string, number> = {};
      for (const row of regionResults) {
        byRegion[row.region] = parseInt(row.count, 10);
      }
      
      // Get totals
      const totalsSql = `
        SELECT 
          COUNT(*) as total_members,
          COUNT(*) FILTER (WHERE is_active = true) as active_members,
          COALESCE(SUM(max_leads) FILTER (WHERE is_active = true), 0) as total_capacity,
          COALESCE(SUM(current_leads) FILTER (WHERE is_active = true), 0) as total_assigned
        FROM team_members
      `;
      const totals = await db.queryOne<{
        total_members: string;
        active_members: string;
        total_capacity: string;
        total_assigned: string;
      }>(totalsSql);
      
      const totalCapacity = parseInt(totals?.total_capacity || '0', 10);
      const totalAssigned = parseInt(totals?.total_assigned || '0', 10);
      
      return {
        total_members: parseInt(totals?.total_members || '0', 10),
        active_members: parseInt(totals?.active_members || '0', 10),
        by_role: byRole,
        by_region: byRegion,
        total_capacity: totalCapacity,
        total_assigned: totalAssigned,
        utilization_percentage: totalCapacity > 0 
          ? Math.round((totalAssigned / totalCapacity) * 100 * 100) / 100 
          : 0
      };
    }
  );

  // ===========================================================================
  // GET /api/v1/team/:id
  // ===========================================================================
  /**
   * Get a single team member by ID.
   */
  fastify.get<{
    Params: IdParams;
    Reply: TeamMemberResponse;
  }>(
    '/team/:id',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Get a team member by ID',
        tags: ['Team'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: { type: 'object' },
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
      const parseResult = teamMemberIdParamSchema.safeParse(request.params);
      
      if (!parseResult.success) {
        throw new ValidationError('Ungültige Team Member ID', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const member = await db.queryOne<TeamMember>(
        'SELECT * FROM team_members WHERE id = $1',
        [parseResult.data.id]
      );
      
      if (!member) {
        throw new NotFoundError('Team Member', parseResult.data.id);
      }
      
      return transformTeamMemberResponse(member);
    }
  );

  // ===========================================================================
  // POST /api/v1/team
  // ===========================================================================
  /**
   * Create a new team member.
   */
  fastify.post<{
    Body: CreateTeamMemberInput;
    Reply: TeamMemberResponse;
  }>(
    '/team',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Create a new team member',
        tags: ['Team'],
        body: {
          type: 'object',
          required: ['email', 'name', 'role'],
          properties: {
            email: { type: 'string', format: 'email', maxLength: 255 },
            name: { type: 'string', minLength: 1, maxLength: 255 },
            role: { type: 'string', enum: ['bdr', 'ae', 'partnership_manager', 'marketing_manager', 'admin'] },
            region: { type: 'string', maxLength: 50 },
            is_active: { type: 'boolean', default: true },
            max_leads: { type: 'integer', minimum: 0, maximum: 1000, default: 50 }
          }
        },
        response: {
          201: { type: 'object' },
          409: {
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
      const parseResult = createTeamMemberSchema.safeParse(request.body);
      
      if (!parseResult.success) {
        throw new ValidationError('Ungültige Team Member Daten', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const data = parseResult.data;
      
      // Check if email already exists
      const existing = await db.queryOne<{ id: string }>(
        'SELECT id FROM team_members WHERE email = $1',
        [data.email]
      );
      
      if (existing) {
        throw new ConflictError('Ein Team Member mit dieser E-Mail existiert bereits', {
          email: data.email
        });
      }
      
      const sql = `
        INSERT INTO team_members (email, name, role, region, is_active, max_leads)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      const member = await db.queryOne<TeamMember>(sql, [
        data.email,
        data.name,
        data.role,
        data.region ?? null,
        data.is_active ?? true,
        data.max_leads ?? 50
      ]);
      
      if (!member) {
        throw new Error('Team Member konnte nicht erstellt werden');
      }
      
      request.log.info({
        teamMemberId: member.id,
        email: member.email,
        role: member.role
      }, 'Team Member erstellt');
      
      return reply.code(201).send(transformTeamMemberResponse(member));
    }
  );

  // ===========================================================================
  // PATCH /api/v1/team/:id
  // ===========================================================================
  /**
   * Update an existing team member.
   */
  fastify.patch<{
    Params: IdParams;
    Body: UpdateTeamMemberInput;
    Reply: TeamMemberResponse;
  }>(
    '/team/:id',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Update a team member',
        tags: ['Team'],
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
            email: { type: 'string', format: 'email', maxLength: 255 },
            name: { type: 'string', minLength: 1, maxLength: 255 },
            role: { type: 'string', enum: ['bdr', 'ae', 'partnership_manager', 'marketing_manager', 'admin'] },
            region: { type: ['string', 'null'], maxLength: 50 },
            is_active: { type: 'boolean' },
            max_leads: { type: 'integer', minimum: 0, maximum: 1000 }
          }
        },
        response: {
          200: { type: 'object' },
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
      const paramResult = teamMemberIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Ungültige Team Member ID', {
          validationErrors: paramResult.error.errors
        });
      }
      
      const bodyResult = updateTeamMemberSchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw new ValidationError('Ungültige Team Member Daten', {
          validationErrors: bodyResult.error.errors
        });
      }
      
      const { id } = paramResult.data;
      const data = bodyResult.data;
      
      // Check if team member exists
      const existing = await db.queryOne<TeamMember>(
        'SELECT * FROM team_members WHERE id = $1',
        [id]
      );
      
      if (!existing) {
        throw new NotFoundError('Team Member', id);
      }
      
      // Check if email is being changed and if new email already exists
      if (data.email && data.email !== existing.email) {
        const emailExists = await db.queryOne<{ id: string }>(
          'SELECT id FROM team_members WHERE email = $1 AND id != $2',
          [data.email, id]
        );
        
        if (emailExists) {
          throw new ConflictError('Ein Team Member mit dieser E-Mail existiert bereits', {
            email: data.email
          });
        }
      }
      
      // Build update query dynamically
      const updates: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;
      
      if (data.email !== undefined) {
        updates.push(`email = $${paramIndex}`);
        params.push(data.email);
        paramIndex++;
      }
      
      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        params.push(data.name);
        paramIndex++;
      }
      
      if (data.role !== undefined) {
        updates.push(`role = $${paramIndex}`);
        params.push(data.role);
        paramIndex++;
      }
      
      if (data.region !== undefined) {
        updates.push(`region = $${paramIndex}`);
        params.push(data.region);
        paramIndex++;
      }
      
      if (data.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex}`);
        params.push(data.is_active);
        paramIndex++;
      }
      
      if (data.max_leads !== undefined) {
        updates.push(`max_leads = $${paramIndex}`);
        params.push(data.max_leads);
        paramIndex++;
      }
      
      if (updates.length === 0) {
        return transformTeamMemberResponse(existing);
      }
      
      params.push(id);
      
      const sql = `
        UPDATE team_members 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      
      const member = await db.queryOne<TeamMember>(sql, params);
      
      if (!member) {
        throw new Error('Team Member konnte nicht aktualisiert werden');
      }
      
      request.log.info({
        teamMemberId: member.id
      }, 'Team Member aktualisiert');
      
      return transformTeamMemberResponse(member);
    }
  );

  // ===========================================================================
  // DELETE /api/v1/team/:id
  // ===========================================================================
  /**
   * Delete a team member.
   */
  fastify.delete<{
    Params: IdParams;
    Reply: { success: boolean; message: string };
  }>(
    '/team/:id',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Delete a team member',
        tags: ['Team'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
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
      const parseResult = teamMemberIdParamSchema.safeParse(request.params);
      
      if (!parseResult.success) {
        throw new ValidationError('Ungültige Team Member ID', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const { id } = parseResult.data;
      
      // Check if team member exists
      const existing = await db.queryOne<{ id: string }>(
        'SELECT id FROM team_members WHERE id = $1',
        [id]
      );
      
      if (!existing) {
        throw new NotFoundError('Team Member', id);
      }
      
      // Check if member has assigned leads/deals
      const assignedDeals = await db.queryOne<{ count: string }>(
        'SELECT COUNT(*) as count FROM deals WHERE assigned_to = $1',
        [id]
      );
      
      const assignedTasks = await db.queryOne<{ count: string }>(
        'SELECT COUNT(*) as count FROM tasks WHERE assigned_to = $1 AND status = $2',
        [id, 'open']
      );
      
      const dealCount = parseInt(assignedDeals?.count || '0', 10);
      const taskCount = parseInt(assignedTasks?.count || '0', 10);
      
      if (dealCount > 0 || taskCount > 0) {
        throw new ConflictError(
          'Team Member kann nicht gelöscht werden, da noch Deals oder offene Tasks zugewiesen sind',
          {
            assigned_deals: dealCount,
            assigned_open_tasks: taskCount
          }
        );
      }
      
      await db.query('DELETE FROM team_members WHERE id = $1', [id]);
      
      request.log.info({
        teamMemberId: id
      }, 'Team Member gelöscht');
      
      return {
        success: true,
        message: 'Team Member erfolgreich gelöscht'
      };
    }
  );

  // ===========================================================================
  // POST /api/v1/team/:id/deactivate
  // ===========================================================================
  /**
   * Deactivate a team member (soft delete).
   */
  fastify.post<{
    Params: IdParams;
    Reply: TeamMemberResponse;
  }>(
    '/team/:id/deactivate',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Deactivate a team member',
        tags: ['Team'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: { type: 'object' },
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
      const parseResult = teamMemberIdParamSchema.safeParse(request.params);
      
      if (!parseResult.success) {
        throw new ValidationError('Ungültige Team Member ID', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const member = await db.queryOne<TeamMember>(
        'UPDATE team_members SET is_active = false WHERE id = $1 RETURNING *',
        [parseResult.data.id]
      );
      
      if (!member) {
        throw new NotFoundError('Team Member', parseResult.data.id);
      }
      
      request.log.info({
        teamMemberId: member.id
      }, 'Team Member deaktiviert');
      
      return transformTeamMemberResponse(member);
    }
  );

  // ===========================================================================
  // POST /api/v1/team/:id/activate
  // ===========================================================================
  /**
   * Activate a team member.
   */
  fastify.post<{
    Params: IdParams;
    Reply: TeamMemberResponse;
  }>(
    '/team/:id/activate',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Activate a team member',
        tags: ['Team'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: { type: 'object' },
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
      const parseResult = teamMemberIdParamSchema.safeParse(request.params);
      
      if (!parseResult.success) {
        throw new ValidationError('Ungültige Team Member ID', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const member = await db.queryOne<TeamMember>(
        'UPDATE team_members SET is_active = true WHERE id = $1 RETURNING *',
        [parseResult.data.id]
      );
      
      if (!member) {
        throw new NotFoundError('Team Member', parseResult.data.id);
      }
      
      request.log.info({
        teamMemberId: member.id
      }, 'Team Member aktiviert');
      
      return transformTeamMemberResponse(member);
    }
  );

  // ===========================================================================
  // GET /api/v1/team/:id/workload
  // ===========================================================================
  /**
   * Get workload information for a team member.
   */
  fastify.get<{
    Params: IdParams;
    Reply: {
      member: TeamMemberResponse;
      workload: {
        current_leads: number;
        max_leads: number;
        available_capacity: number;
        utilization_percentage: number;
        open_deals: number;
        open_tasks: number;
      };
    };
  }>(
    '/team/:id/workload',
    {
      preHandler: validateApiKey,
      schema: {
        description: 'Get workload information for a team member',
        tags: ['Team'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              member: { type: 'object' },
              workload: {
                type: 'object',
                properties: {
                  current_leads: { type: 'integer' },
                  max_leads: { type: 'integer' },
                  available_capacity: { type: 'integer' },
                  utilization_percentage: { type: 'number' },
                  open_deals: { type: 'integer' },
                  open_tasks: { type: 'integer' }
                }
              }
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
      const parseResult = teamMemberIdParamSchema.safeParse(request.params);
      
      if (!parseResult.success) {
        throw new ValidationError('Ungültige Team Member ID', {
          validationErrors: parseResult.error.errors
        });
      }
      
      const { id } = parseResult.data;
      
      const member = await db.queryOne<TeamMember>(
        'SELECT * FROM team_members WHERE id = $1',
        [id]
      );
      
      if (!member) {
        throw new NotFoundError('Team Member', id);
      }
      
      // Get open deals count
      const dealsResult = await db.queryOne<{ count: string }>(
        'SELECT COUNT(*) as count FROM deals WHERE assigned_to = $1 AND status = $2',
        [id, 'open']
      );
      
      // Get open tasks count
      const tasksResult = await db.queryOne<{ count: string }>(
        'SELECT COUNT(*) as count FROM tasks WHERE assigned_to = $1 AND status IN ($2, $3)',
        [id, 'open', 'in_progress']
      );
      
      const openDeals = parseInt(dealsResult?.count || '0', 10);
      const openTasks = parseInt(tasksResult?.count || '0', 10);
      
      return {
        member: transformTeamMemberResponse(member),
        workload: {
          current_leads: member.current_leads,
          max_leads: member.max_leads,
          available_capacity: Math.max(0, member.max_leads - member.current_leads),
          utilization_percentage: member.max_leads > 0 
            ? Math.round((member.current_leads / member.max_leads) * 100 * 100) / 100 
            : 0,
          open_deals: openDeals,
          open_tasks: openTasks
        }
      };
    }
  );
}

export default teamRoutes;
