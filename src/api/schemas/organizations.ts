// =============================================================================
// src/api/schemas/organizations.ts
// Zod Validation Schemas for Organization Management
// =============================================================================

import { z } from 'zod';

// =============================================================================
// Create Organization Schema
// =============================================================================

export const createOrganizationSchema = z.object({
  name: z.string().max(255),
  domain: z.string().max(255).optional(),
  industry: z.string().max(100).optional(),
  company_size: z.string().max(50).optional(),
  country: z.string().max(2).optional(),
  portal_id: z.string().max(100).optional(),
  moco_id: z.string().max(50).optional(),
  metadata: z.record(z.unknown()).optional()
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

// =============================================================================
// Update Organization Schema
// =============================================================================

export const updateOrganizationSchema = z.object({
  name: z.string().max(255).optional().nullable(),
  domain: z.string().max(255).optional().nullable(),
  industry: z.string().max(100).optional().nullable(),
  company_size: z.string().max(50).optional().nullable(),
  country: z.string().max(2).optional().nullable(),
  portal_id: z.string().max(100).optional().nullable(),
  moco_id: z.string().max(50).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable()
}).partial();

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

// =============================================================================
// Organization Filters Schema
// =============================================================================

export const organizationFiltersSchema = z.object({
  search: z.string().optional(),
  domain: z.string().optional(),
  industry: z.string().optional(),
  company_size: z.string().optional(),
  country: z.string().optional(),

  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),

  sort_by: z.enum([
    'created_at',
    'updated_at',
    'name',
    'domain',
    'industry',
    'company_size',
    'country'
  ]).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type OrganizationFiltersInput = z.infer<typeof organizationFiltersSchema>;

// =============================================================================
// Organization ID Param Schema
// =============================================================================

export const organizationIdParamSchema = z.object({
  id: z.string().uuid('Invalid organization ID')
});

export type OrganizationIdParam = z.infer<typeof organizationIdParamSchema>;

// =============================================================================
// Response Types
// =============================================================================

export interface OrganizationResponse {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  company_size: string | null;
  country: string | null;
  portal_id: string | null;
  moco_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrganizationListResponse {
  data: OrganizationResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}
