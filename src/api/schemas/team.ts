// =============================================================================
// src/api/schemas/team.ts
// Zod Validation Schemas for Team Member Management
// =============================================================================

import { z } from 'zod';

// =============================================================================
// Enum Schemas
// =============================================================================

export const teamRoleSchema = z.enum([
  'bdr',
  'ae',
  'partnership_manager',
  'marketing_manager',
  'admin'
]);

// =============================================================================
// Create Team Member Schema
// =============================================================================

export const createTeamMemberSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse').max(255),
  name: z.string().min(1, 'Name ist erforderlich').max(255),
  role: teamRoleSchema,
  region: z.string().max(50).optional(),
  is_active: z.boolean().optional().default(true),
  max_leads: z.number().int().min(0).max(1000).optional().default(50)
});

export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>;

// =============================================================================
// Update Team Member Schema
// =============================================================================

export const updateTeamMemberSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse').max(255).optional(),
  name: z.string().min(1).max(255).optional(),
  role: teamRoleSchema.optional(),
  region: z.string().max(50).optional().nullable(),
  is_active: z.boolean().optional(),
  max_leads: z.number().int().min(0).max(1000).optional()
}).partial();

export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;

// =============================================================================
// Team Member Filters Schema
// =============================================================================

export const teamMemberFiltersSchema = z.object({
  // Filters
  role: teamRoleSchema.optional(),
  region: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
  
  // Search
  search: z.string().optional(),
  
  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  
  // Sorting
  sort_by: z.enum([
    'created_at',
    'name',
    'email',
    'role',
    'region',
    'current_leads'
  ]).default('name'),
  sort_order: z.enum(['asc', 'desc']).default('asc')
});

export type TeamMemberFiltersInput = z.infer<typeof teamMemberFiltersSchema>;

// =============================================================================
// Team Member ID Param Schema
// =============================================================================

export const teamMemberIdParamSchema = z.object({
  id: z.string().uuid('Ungültige Team Member ID')
});

export type TeamMemberIdParam = z.infer<typeof teamMemberIdParamSchema>;

// =============================================================================
// Team Member Response Types
// =============================================================================

export interface TeamMemberResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  region: string | null;
  is_active: boolean;
  max_leads: number;
  current_leads: number;
  created_at: string;
}

export interface TeamMemberListResponse {
  data: TeamMemberResponse[];
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
// Team Member Stats Response
// =============================================================================

export interface TeamMemberStatsResponse {
  total_members: number;
  active_members: number;
  by_role: Record<string, number>;
  by_region: Record<string, number>;
  total_capacity: number;
  total_assigned: number;
  utilization_percentage: number;
}
