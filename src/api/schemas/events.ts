// =============================================================================
// src/api/schemas/events.ts
// Zod Validation Schemas for Event Ingestion
// =============================================================================

import { z } from 'zod';

// =============================================================================
// Lead Identifier Schema
// =============================================================================

/**
 * At least one identifier is required to match or create a lead.
 * Priority: email > portal_id > waalaxy_id > linkedin_url > lemlist_id
 */
export const leadIdentifierSchema = z.object({
  email: z.string().email().optional(),
  portal_id: z.string().optional(),
  waalaxy_id: z.string().optional(),
  linkedin_url: z.string().url().optional(),
  lemlist_id: z.string().optional()
}).refine(
  (data) => data.email || data.portal_id || data.waalaxy_id || data.linkedin_url || data.lemlist_id,
  { message: 'At least one lead identifier is required (email, portal_id, waalaxy_id, linkedin_url, or lemlist_id)' }
);

export type LeadIdentifier = z.infer<typeof leadIdentifierSchema>;

// =============================================================================
// Event Metadata Schema
// =============================================================================

/**
 * Flexible metadata object for event-specific data.
 * Can contain any JSON-serializable value.
 */
export const eventMetadataSchema = z.record(z.unknown()).default({});

// =============================================================================
// Ingest Event Schema
// =============================================================================

/**
 * Schema for the POST /events/ingest endpoint.
 */
export const ingestEventSchema = z.object({
  // Event Type (required)
  event_type: z.string().min(1).max(100),
  
  // Event Category (optional, for grouping)
  event_category: z.string().max(50).optional(),
  
  // Source of the event (required)
  source: z.enum([
    'waalaxy',
    'portal', 
    'lemlist',
    'ads',
    'conference',
    'website',
    'linkedin',
    'manual',
    'api',
    'import'
  ]),
  
  // When the event occurred (required, ISO 8601)
  occurred_at: z.string().datetime({ message: 'occurred_at must be a valid ISO 8601 datetime' }),
  
  // Lead identifier (required)
  lead_identifier: leadIdentifierSchema,
  
  // Event metadata (optional)
  metadata: eventMetadataSchema,
  
  // Campaign tracking (optional)
  campaign_id: z.string().max(100).optional(),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
  
  // Correlation ID for tracking related events (optional)
  correlation_id: z.string().uuid().optional()
});

export type IngestEventInput = z.infer<typeof ingestEventSchema>;

// =============================================================================
// Ingest Response Schema
// =============================================================================

export const ingestEventResponseSchema = z.object({
  success: z.boolean(),
  event_id: z.string().uuid(),
  message: z.string(),
  queued_at: z.string().datetime()
});

export type IngestEventResponse = z.infer<typeof ingestEventResponseSchema>;

// =============================================================================
// Bulk Import Schema
// =============================================================================

/**
 * Schema for individual lead in bulk import.
 */
export const bulkLeadSchema = z.object({
  email: z.string().email(),
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  job_title: z.string().max(150).optional(),
  company_name: z.string().max(255).optional(),
  company_domain: z.string().max(255).optional(),
  linkedin_url: z.string().url().optional(),
  source: z.string().max(100).optional(),
  campaign_id: z.string().max(100).optional(),
  metadata: eventMetadataSchema
});

export type BulkLeadInput = z.infer<typeof bulkLeadSchema>;

/**
 * Schema for the POST /leads/bulk endpoint.
 */
export const bulkImportSchema = z.object({
  leads: z.array(bulkLeadSchema).min(1).max(1000),
  source: z.string().min(1).max(100),
  campaign_id: z.string().max(100).optional(),
  skip_duplicates: z.boolean().default(true),
  notify_on_complete: z.boolean().default(false)
});

export type BulkImportInput = z.infer<typeof bulkImportSchema>;

/**
 * Bulk import response schema.
 */
export const bulkImportResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  batch_id: z.string().uuid(),
  total_leads: z.number(),
  queued_at: z.string().datetime()
});

export type BulkImportResponse = z.infer<typeof bulkImportResponseSchema>;

// =============================================================================
// Event Types (for reference)
// =============================================================================

/**
 * Common event types used in the system.
 * This is not a strict enum - custom event types are allowed.
 */
export const COMMON_EVENT_TYPES = [
  // Website Events
  'page_visited',
  'form_submitted',
  'demo_requested',
  'pricing_viewed',
  'roi_calculator_submitted',
  'download_completed',
  'video_watched',
  
  // Email Events
  'email_sent',
  'email_opened',
  'email_clicked',
  'email_replied',
  'email_bounced',
  'email_unsubscribed',
  
  // LinkedIn Events
  'linkedin_connection_sent',
  'linkedin_connection_accepted',
  'linkedin_message_sent',
  'linkedin_message_replied',
  'linkedin_profile_viewed',
  
  // Sales Events
  'meeting_scheduled',
  'meeting_completed',
  'call_completed',
  'proposal_sent',
  'contract_sent',
  'deal_won',
  'deal_lost',
  
  // Product Events
  'user_registered',
  'order_placed',
  'order_completed',
  'subscription_started',
  'subscription_cancelled',
  
  // Marketing Events
  'webinar_registered',
  'webinar_attended',
  'conference_visited',
  'trade_show_scanned'
] as const;

export type CommonEventType = typeof COMMON_EVENT_TYPES[number];
