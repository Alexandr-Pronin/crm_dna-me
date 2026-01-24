// =============================================================================
// src/types/index.ts
// TypeScript Type Definitions for DNA Marketing Engine
// =============================================================================

// =============================================================================
// Database Entity Types
// =============================================================================

export interface Organization {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  company_size?: string;
  country?: string;
  portal_id?: string;
  moco_id?: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface Pipeline {
  id: string;
  slug: string;
  name: string;
  description?: string;
  is_active: boolean;
  is_default: boolean;
  sales_cycle_days?: number;
  target_persona?: string;
  config: Record<string, unknown>;
  created_at: Date;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  slug: string;
  name: string;
  position: number;
  stage_type?: string;
  automation_config: AutomationStageConfig[];
  created_at: Date;
}

export interface Lead {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  job_title?: string;
  organization_id?: string;
  status: LeadStatus;
  lifecycle_stage: LifecycleStage;
  demographic_score: number;
  engagement_score: number;
  behavior_score: number;
  total_score: number;
  pipeline_id?: string;
  routing_status: RoutingStatus;
  routed_at?: Date;
  primary_intent?: IntentType;
  intent_confidence: number;
  intent_summary: IntentSummary;
  first_touch_source?: string;
  first_touch_campaign?: string;
  first_touch_date?: Date;
  last_touch_source?: string;
  last_touch_campaign?: string;
  last_touch_date?: Date;
  portal_id?: string;
  waalaxy_id?: string;
  linkedin_url?: string;
  lemlist_id?: string;
  consent_date?: Date;
  consent_source?: string;
  gdpr_delete_requested?: Date;
  created_at: Date;
  updated_at: Date;
  last_activity?: Date;
}

export interface IntentSignal {
  id: string;
  lead_id: string;
  intent: IntentType;
  rule_id: string;
  confidence_points: number;
  trigger_type: string;
  event_id?: string;
  trigger_data?: Record<string, unknown>;
  detected_at: Date;
}

export interface Deal {
  id: string;
  lead_id: string;
  pipeline_id: string;
  stage_id: string;
  position: number;
  name?: string;
  value?: number;
  currency: string;
  expected_close_date?: Date;
  stage_entered_at: Date;
  assigned_to?: string;
  assigned_region?: string;
  assigned_at?: Date;
  status: DealStatus;
  close_reason?: string;
  closed_at?: Date;
  moco_offer_id?: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface MarketingEvent {
  id: string;
  lead_id?: string;
  event_type: string;
  event_category?: string;
  source: string;
  occurred_at: Date;
  metadata: Record<string, unknown>;
  campaign_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  correlation_id?: string;
  score_points: number;
  score_category?: string;
  processed_at?: Date;
  created_at: Date;
}

export interface ScoringRule {
  id: string;
  slug: string;
  name: string;
  description?: string;
  is_active: boolean;
  priority: number;
  rule_type: string;
  category: ScoreCategory;
  conditions: ScoringConditions;
  points: number;
  max_per_day?: number;
  max_per_lead?: number;
  decay_days?: number;
  created_at: Date;
  updated_at: Date;
}

export interface ScoreHistory {
  id: string;
  lead_id: string;
  event_id?: string;
  rule_id?: string;
  category: ScoreCategory;
  points_change: number;
  new_total: number;
  expires_at?: Date;
  expired: boolean;
  expired_at?: Date;
  created_at: Date;
}

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  priority: number;
  pipeline_id?: string;
  stage_id?: string;
  trigger_type: AutomationTriggerType;
  trigger_config: Record<string, unknown>;
  action_type: AutomationActionType;
  action_config: Record<string, unknown>;
  last_executed?: Date;
  execution_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface Task {
  id: string;
  lead_id?: string;
  deal_id?: string;
  title: string;
  description?: string;
  task_type?: string;
  assigned_to?: string;
  due_date?: Date;
  completed_at?: Date;
  status: TaskStatus;
  automation_rule_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: TeamRole;
  region?: string;
  is_active: boolean;
  max_leads: number;
  current_leads: number;
  created_at: Date;
}

export interface Campaign {
  id: string;
  name: string;
  campaign_type?: string;
  status: CampaignStatus;
  budget?: number;
  spent: number;
  currency: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  start_date?: Date;
  end_date?: Date;
  leads_generated: number;
  deals_created: number;
  revenue_attributed: number;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface ApiKey {
  id: string;
  source: string;
  key_hash: string;
  is_active: boolean;
  last_used_at?: Date;
  created_at: Date;
}

// =============================================================================
// E-Mail Sequence Types
// =============================================================================

export interface EmailSequence {
  id: string;
  name: string;
  description?: string;
  trigger_event?: string;
  trigger_config: Record<string, unknown>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface EmailSequenceStep {
  id: string;
  sequence_id: string;
  position: number;
  delay_days: number;
  delay_hours: number;
  subject: string;
  body_html: string;
  body_text?: string;
  created_at: Date;
  updated_at: Date;
}

export interface EmailSequenceEnrollment {
  id: string;
  lead_id: string;
  sequence_id: string;
  current_step: number;
  status: EmailEnrollmentStatus;
  enrolled_at: Date;
  last_email_sent_at?: Date;
  next_email_due_at?: Date;
  completed_at?: Date;
  unsubscribed_at?: Date;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface EmailTracking {
  id: string;
  enrollment_id: string;
  step_id: string;
  sent_at: Date;
  opened_at?: Date;
  open_count: number;
  clicked_at?: Date;
  click_count: number;
  bounced_at?: Date;
  bounce_reason?: string;
  unsubscribed_at?: Date;
  metadata: Record<string, unknown>;
}

export type EmailEnrollmentStatus = 'active' | 'paused' | 'completed' | 'unsubscribed';

// =============================================================================
// Enums / Union Types
// =============================================================================

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'nurturing' | 'customer' | 'churned';
export type LifecycleStage = 'lead' | 'mql' | 'sql' | 'opportunity' | 'customer';
export type RoutingStatus = 'unrouted' | 'pending' | 'routed' | 'manual_review';
export type IntentType = 'research' | 'b2b' | 'co_creation';
export type DealStatus = 'open' | 'won' | 'lost';
export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';
export type ScoreCategory = 'demographic' | 'engagement' | 'behavior';
export type TeamRole = 'bdr' | 'ae' | 'partnership_manager' | 'marketing_manager' | 'admin';

export type AutomationTriggerType = 
  | 'event'
  | 'score_threshold'
  | 'intent_detected'
  | 'time_in_stage'
  | 'stage_change';

export type AutomationActionType = 
  | 'move_to_stage'
  | 'assign_owner'
  | 'send_notification'
  | 'create_task'
  | 'sync_moco'
  | 'update_field'
  | 'route_to_pipeline';

// =============================================================================
// Helper Types
// =============================================================================

export interface IntentSummary {
  research: number;
  b2b: number;
  co_creation: number;
}

export interface ScoringConditions {
  event_type?: string;
  metadata?: Record<string, unknown>;
  field?: string;
  operator?: 'equals' | 'in' | 'contains' | 'gte' | 'lte' | 'pattern';
  value?: unknown;
}

export interface AutomationStageConfig {
  trigger: {
    type: string;
    [key: string]: unknown;
  };
  action: {
    type: string;
    [key: string]: unknown;
  };
}

// =============================================================================
// Job Types (BullMQ)
// =============================================================================

export interface EventProcessingJob {
  event_id: string;
  event_type: string;
  source: string;
  lead_identifier: LeadIdentifier;
  metadata: Record<string, unknown>;
  occurred_at: string;
}

export interface LeadIdentifier {
  email?: string;
  portal_id?: string;
  waalaxy_id?: string;
  linkedin_url?: string;
  lemlist_id?: string;
}

export interface RoutingJob {
  lead_id: string;
  trigger: 'score_change' | 'intent_change' | 'manual' | 'scheduled';
}

export interface SyncJob {
  entity_type: 'lead' | 'deal' | 'organization';
  entity_id: string;
  target: 'moco' | 'slack';
  action: string;
}

// =============================================================================
// API Types
// =============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    database: boolean;
    redis: boolean;
  };
}

// =============================================================================
// Routing Types
// =============================================================================

export interface RoutingResult {
  action: 'routed' | 'skip' | 'wait' | 'manual_review';
  reason: string;
  pipeline_id?: string;
  pipeline_name?: string;
  deal_id?: string;
  assigned_to?: string;
  details?: string;
  days_in_pool?: number;
}

export interface IntentCalculationResult {
  primary_intent: IntentType | null;
  intent_confidence: number;
  intent_summary: IntentSummary;
  is_routable: boolean;
  conflict_detected: boolean;
}
