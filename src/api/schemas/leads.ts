// =============================================================================
// src/api/schemas/leads.ts
// Zod Validation Schemas for Lead Management
// =============================================================================

import { z } from 'zod';

// =============================================================================
// Enum Schemas
// =============================================================================

export const leadStatusSchema = z.enum([
  'new',
  'contacted',
  'qualified',
  'nurturing',
  'customer',
  'churned'
]);

export const lifecycleStageSchema = z.enum([
  'lead',
  'mql',
  'sql',
  'opportunity',
  'customer'
]);

export const routingStatusSchema = z.enum([
  'unrouted',
  'pending',
  'routed',
  'manual_review'
]);

export const intentTypeSchema = z.enum([
  'research',
  'b2b',
  'co_creation'
]);

// =============================================================================
// Create Lead Schema
// =============================================================================

export const createLeadSchema = z.object({
  email: z.string().email('Invalid email format'),
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  job_title: z.string().max(150).optional(),
  organization_id: z.string().uuid().optional(),
  status: leadStatusSchema.optional().default('new'),
  lifecycle_stage: lifecycleStageSchema.optional().default('lead'),
  portal_id: z.string().max(100).optional(),
  waalaxy_id: z.string().max(100).optional(),
  linkedin_url: z.string().url().max(255).optional().or(z.literal('')),
  lemlist_id: z.string().max(100).optional(),
  consent_date: z.string().datetime().optional(),
  consent_source: z.string().max(100).optional(),
  first_touch_source: z.string().max(100).optional(),
  first_touch_campaign: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional()
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

// =============================================================================
// Update Lead Schema
// =============================================================================

export const updateLeadSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  first_name: z.string().max(100).optional().nullable(),
  last_name: z.string().max(100).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  job_title: z.string().max(150).optional().nullable(),
  organization_id: z.string().uuid().optional().nullable(),
  status: leadStatusSchema.optional(),
  lifecycle_stage: lifecycleStageSchema.optional(),
  portal_id: z.string().max(100).optional().nullable(),
  waalaxy_id: z.string().max(100).optional().nullable(),
  linkedin_url: z.string().url().max(255).optional().nullable().or(z.literal('')),
  lemlist_id: z.string().max(100).optional().nullable(),
  consent_date: z.string().datetime().optional().nullable(),
  consent_source: z.string().max(100).optional().nullable(),
  gdpr_delete_requested: z.string().datetime().optional().nullable()
}).partial();

export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

// =============================================================================
// Lead Filters Schema
// =============================================================================

export const leadFiltersSchema = z.object({
  // Search
  search: z.string().optional(),
  
  // Filters
  status: leadStatusSchema.optional(),
  lifecycle_stage: lifecycleStageSchema.optional(),
  routing_status: routingStatusSchema.optional(),
  primary_intent: intentTypeSchema.optional(),
  pipeline_id: z.string().uuid().optional(),
  organization_id: z.string().uuid().optional(),
  
  // Score filters
  min_score: z.coerce.number().int().min(0).optional(),
  max_score: z.coerce.number().int().optional(),
  min_intent_confidence: z.coerce.number().int().min(0).max(100).optional(),
  
  // Date filters
  created_after: z.string().datetime().optional(),
  created_before: z.string().datetime().optional(),
  last_activity_after: z.string().datetime().optional(),
  last_activity_before: z.string().datetime().optional(),
  
  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  
  // Sorting
  sort_by: z.enum([
    'created_at',
    'updated_at',
    'total_score',
    'intent_confidence',
    'last_activity',
    'email',
    'first_name',
    'last_name'
  ]).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type LeadFiltersInput = z.infer<typeof leadFiltersSchema>;

// =============================================================================
// Manual Route Schema
// =============================================================================

export const manualRouteSchema = z.object({
  pipeline_id: z.string().uuid('Invalid pipeline ID'),
  stage_id: z.string().uuid('Invalid stage ID').optional(),
  assigned_to: z.string().uuid('Invalid team member ID').optional(),
  reason: z.string().max(500).optional()
});

export type ManualRouteInput = z.infer<typeof manualRouteSchema>;

// =============================================================================
// Lead ID Param Schema
// =============================================================================

export const leadIdParamSchema = z.object({
  id: z.string().uuid('Invalid lead ID')
});

export type LeadIdParam = z.infer<typeof leadIdParamSchema>;

// =============================================================================
// Lead Response Types
// =============================================================================

export interface LeadResponse {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  job_title: string | null;
  organization_id: string | null;
  organization_name?: string | null;
  status: string;
  lifecycle_stage: string;
  demographic_score: number;
  engagement_score: number;
  behavior_score: number;
  total_score: number;
  pipeline_id: string | null;
  routing_status: string;
  routed_at: string | null;
  primary_intent: string | null;
  intent_confidence: number;
  intent_summary: {
    research: number;
    b2b: number;
    co_creation: number;
  };
  first_touch_source: string | null;
  first_touch_campaign: string | null;
  first_touch_date: string | null;
  last_touch_source: string | null;
  last_touch_campaign: string | null;
  last_touch_date: string | null;
  portal_id: string | null;
  waalaxy_id: string | null;
  linkedin_url: string | null;
  lemlist_id: string | null;
  consent_date: string | null;
  consent_source: string | null;
  gdpr_delete_requested: string | null;
  created_at: string;
  updated_at: string;
  last_activity: string | null;
}

export interface LeadListResponse {
  data: LeadResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}
