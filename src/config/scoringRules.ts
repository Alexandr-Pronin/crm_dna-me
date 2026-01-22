// =============================================================================
// src/config/scoringRules.ts
// Scoring Rules Configuration for DNA Marketing Engine
// =============================================================================

import type { ScoreCategory, ScoringConditions } from '../types/index.js';

// =============================================================================
// Scoring Rule Definition Interface
// =============================================================================

export interface ScoringRuleDefinition {
  slug: string;
  name: string;
  description: string;
  rule_type: 'event' | 'field' | 'threshold';
  category: ScoreCategory;
  conditions: ScoringConditions;
  points: number;
  max_per_day?: number;
  max_per_lead?: number;
  decay_days?: number;
  priority?: number;
}

// =============================================================================
// Default Scoring Rules
// =============================================================================

export const DEFAULT_SCORING_RULES: ScoringRuleDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // ENGAGEMENT RULES - Based on website/platform interactions
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Page visits
  {
    slug: 'page-visited',
    name: 'Page Visited',
    description: 'General page visit',
    rule_type: 'event',
    category: 'engagement',
    conditions: { event_type: 'page_visited' },
    points: 2,
    max_per_day: 10,
    decay_days: 30
  },
  {
    slug: 'pricing-page-visited',
    name: 'Pricing Page Visited',
    description: 'Viewed pricing page - high intent signal',
    rule_type: 'event',
    category: 'engagement',
    conditions: { 
      event_type: 'page_visited', 
      metadata: { page_path: '/pricing' } 
    },
    points: 5,
    max_per_day: 2,
    decay_days: 14
  },
  {
    slug: '16s-pricing-visited',
    name: '16S Pricing Visited',
    description: 'Viewed 16S microbiome pricing - research intent',
    rule_type: 'event',
    category: 'engagement',
    conditions: { 
      event_type: 'page_visited', 
      metadata: { page_path: '/pricing/16s' } 
    },
    points: 8,
    max_per_day: 2,
    decay_days: 14
  },
  {
    slug: 'enterprise-page-visited',
    name: 'Enterprise Page Visited',
    description: 'Viewed enterprise page - B2B intent',
    rule_type: 'event',
    category: 'engagement',
    conditions: { 
      event_type: 'page_visited', 
      metadata: { page_path: '/enterprise' } 
    },
    points: 10,
    max_per_day: 2,
    decay_days: 14
  },
  {
    slug: 'partnership-page-visited',
    name: 'Partnership Page Visited',
    description: 'Viewed partnership page - co-creation intent',
    rule_type: 'event',
    category: 'engagement',
    conditions: { 
      event_type: 'page_visited', 
      metadata: { page_path: '/partnerships' } 
    },
    points: 12,
    max_per_day: 2,
    decay_days: 14
  },
  {
    slug: 'api-docs-visited',
    name: 'API Docs Visited',
    description: 'Viewed API documentation - technical interest',
    rule_type: 'event',
    category: 'engagement',
    conditions: { 
      event_type: 'page_visited', 
      metadata: { page_path: '/api-docs' } 
    },
    points: 8,
    max_per_day: 3,
    decay_days: 21
  },
  
  // ROI Calculator
  {
    slug: 'roi-calculator-started',
    name: 'ROI Calculator Started',
    description: 'Started using the ROI calculator',
    rule_type: 'event',
    category: 'engagement',
    conditions: { event_type: 'roi_calculator_started' },
    points: 8,
    max_per_day: 1,
    decay_days: 14
  },
  {
    slug: 'roi-calculator-submitted',
    name: 'ROI Calculator Submitted',
    description: 'Completed ROI calculator - strong buying intent',
    rule_type: 'event',
    category: 'engagement',
    conditions: { event_type: 'roi_calculator_submitted' },
    points: 15,
    max_per_lead: 3,
    decay_days: 30
  },
  
  // Demo/Consultation Requests
  {
    slug: 'demo-requested',
    name: 'Demo Requested',
    description: 'Requested a product demo - very high intent',
    rule_type: 'event',
    category: 'engagement',
    conditions: { event_type: 'demo_requested' },
    points: 20,
    max_per_lead: 1
  },
  {
    slug: 'consultation-booked',
    name: 'Consultation Booked',
    description: 'Booked a consultation call',
    rule_type: 'event',
    category: 'engagement',
    conditions: { event_type: 'consultation_booked' },
    points: 25,
    max_per_lead: 1
  },
  
  // Content Downloads
  {
    slug: 'sample-report-downloaded',
    name: 'Sample Report Downloaded',
    description: 'Downloaded a sample report',
    rule_type: 'event',
    category: 'engagement',
    conditions: { event_type: 'sample_report_downloaded' },
    points: 10,
    max_per_day: 3,
    decay_days: 30
  },
  {
    slug: 'whitepaper-downloaded',
    name: 'Whitepaper Downloaded',
    description: 'Downloaded a whitepaper',
    rule_type: 'event',
    category: 'engagement',
    conditions: { event_type: 'whitepaper_downloaded' },
    points: 8,
    max_per_day: 3,
    decay_days: 30
  },
  {
    slug: 'case-study-downloaded',
    name: 'Case Study Downloaded',
    description: 'Downloaded a case study',
    rule_type: 'event',
    category: 'engagement',
    conditions: { event_type: 'case_study_downloaded' },
    points: 10,
    max_per_day: 3,
    decay_days: 30
  },
  
  // Contact Form
  {
    slug: 'contact-form-submitted',
    name: 'Contact Form Submitted',
    description: 'Submitted a contact form',
    rule_type: 'event',
    category: 'engagement',
    conditions: { event_type: 'contact_form_submitted' },
    points: 15,
    max_per_lead: 1
  },
  
  // Email Interactions
  {
    slug: 'email-opened',
    name: 'Email Opened',
    description: 'Opened a marketing email',
    rule_type: 'event',
    category: 'engagement',
    conditions: { event_type: 'email_opened' },
    points: 2,
    max_per_day: 5,
    decay_days: 14
  },
  {
    slug: 'email-clicked',
    name: 'Email Link Clicked',
    description: 'Clicked a link in marketing email',
    rule_type: 'event',
    category: 'engagement',
    conditions: { event_type: 'email_clicked' },
    points: 5,
    max_per_day: 5,
    decay_days: 14
  },
  {
    slug: 'email-replied',
    name: 'Email Replied',
    description: 'Replied to a marketing email',
    rule_type: 'event',
    category: 'engagement',
    conditions: { event_type: 'email_replied' },
    points: 15,
    max_per_lead: 5,
    decay_days: 30
  },
  
  // LinkedIn Interactions
  {
    slug: 'linkedin-connected',
    name: 'LinkedIn Connected',
    description: 'Accepted LinkedIn connection request',
    rule_type: 'event',
    category: 'engagement',
    conditions: { event_type: 'linkedin_connected' },
    points: 10,
    max_per_lead: 1
  },
  {
    slug: 'linkedin-message-received',
    name: 'LinkedIn Message Received',
    description: 'Responded to LinkedIn message',
    rule_type: 'event',
    category: 'engagement',
    conditions: { event_type: 'linkedin_message_received' },
    points: 12,
    max_per_day: 3,
    decay_days: 21
  },
  
  // Webinar/Event
  {
    slug: 'webinar-registered',
    name: 'Webinar Registered',
    description: 'Registered for a webinar',
    rule_type: 'event',
    category: 'engagement',
    conditions: { event_type: 'webinar_registered' },
    points: 12,
    max_per_lead: 3,
    decay_days: 30
  },
  {
    slug: 'webinar-attended',
    name: 'Webinar Attended',
    description: 'Attended a webinar',
    rule_type: 'event',
    category: 'engagement',
    conditions: { event_type: 'webinar_attended' },
    points: 20,
    max_per_lead: 3,
    decay_days: 60
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // BEHAVIOR RULES - Based on account/purchase behavior
  // ═══════════════════════════════════════════════════════════════════════════
  
  {
    slug: 'user-registered',
    name: 'User Registered',
    description: 'Registered on the portal',
    rule_type: 'event',
    category: 'behavior',
    conditions: { event_type: 'user_registered' },
    points: 25,
    max_per_lead: 1
  },
  {
    slug: 'order-placed',
    name: 'Order Placed',
    description: 'Placed an order - immediate customer',
    rule_type: 'event',
    category: 'behavior',
    conditions: { event_type: 'order_placed' },
    points: 100,
    max_per_lead: 10
  },
  {
    slug: 'sample-submitted',
    name: 'Sample Submitted',
    description: 'Submitted a sample for analysis',
    rule_type: 'event',
    category: 'behavior',
    conditions: { event_type: 'sample_submitted' },
    points: 50,
    max_per_lead: 20
  },
  {
    slug: 'results-accessed',
    name: 'Results Accessed',
    description: 'Accessed analysis results',
    rule_type: 'event',
    category: 'behavior',
    conditions: { event_type: 'results_accessed' },
    points: 10,
    max_per_day: 5,
    decay_days: 30
  },
  {
    slug: 'trial-started',
    name: 'Trial Started',
    description: 'Started a free trial',
    rule_type: 'event',
    category: 'behavior',
    conditions: { event_type: 'trial_started' },
    points: 30,
    max_per_lead: 1
  },
  {
    slug: 'subscription-upgraded',
    name: 'Subscription Upgraded',
    description: 'Upgraded subscription plan',
    rule_type: 'event',
    category: 'behavior',
    conditions: { event_type: 'subscription_upgraded' },
    points: 50,
    max_per_lead: 5
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DEMOGRAPHIC RULES - Based on lead/company profile
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Note: Demographic rules are typically applied once when lead profile is enriched
  // These use field-based conditions rather than event-based
  
  {
    slug: 'academic-email',
    name: 'Academic Email Domain',
    description: 'Lead has academic email (.edu, .ac., university)',
    rule_type: 'field',
    category: 'demographic',
    conditions: { 
      field: 'email', 
      operator: 'pattern',
      value: '\\.(edu|ac\\.|uni-|university)'
    },
    points: 10,
    max_per_lead: 1
  },
  {
    slug: 'company-email',
    name: 'Company Email Domain',
    description: 'Lead has company email (not gmail, yahoo, etc.)',
    rule_type: 'field',
    category: 'demographic',
    conditions: { 
      field: 'email', 
      operator: 'pattern',
      value: '^(?!.*@(gmail|yahoo|hotmail|outlook|aol|icloud|mail)\\.).*@.*\\.[a-z]{2,}$'
    },
    points: 5,
    max_per_lead: 1
  },
  {
    slug: 'executive-title',
    name: 'Executive Job Title',
    description: 'Lead has executive-level title',
    rule_type: 'field',
    category: 'demographic',
    conditions: { 
      field: 'job_title', 
      operator: 'contains',
      value: ['VP', 'CSO', 'CTO', 'CEO', 'Chief', 'Director', 'Head of', 'Founder']
    },
    points: 15,
    max_per_lead: 1
  },
  {
    slug: 'researcher-title',
    name: 'Researcher Job Title',
    description: 'Lead has research-related title',
    rule_type: 'field',
    category: 'demographic',
    conditions: { 
      field: 'job_title', 
      operator: 'contains',
      value: ['PhD', 'PostDoc', 'Researcher', 'Professor', 'PI', 'Scientist']
    },
    points: 10,
    max_per_lead: 1
  },
  {
    slug: 'operations-title',
    name: 'Operations Job Title',
    description: 'Lead has operations/lab management title',
    rule_type: 'field',
    category: 'demographic',
    conditions: { 
      field: 'job_title', 
      operator: 'contains',
      value: ['Manager', 'Operations', 'Lab Director', 'Coordinator']
    },
    points: 8,
    max_per_lead: 1
  },
  {
    slug: 'large-company',
    name: 'Large Company',
    description: 'Lead from company with 500+ employees',
    rule_type: 'field',
    category: 'demographic',
    conditions: { 
      field: 'organization.company_size', 
      operator: 'in',
      value: ['501-1000', '1000+']
    },
    points: 12,
    max_per_lead: 1
  },
  {
    slug: 'pharma-biotech-industry',
    name: 'Pharma/Biotech Industry',
    description: 'Lead from pharmaceutical or biotech company',
    rule_type: 'field',
    category: 'demographic',
    conditions: { 
      field: 'organization.industry', 
      operator: 'in',
      value: ['Pharmaceutical', 'Biotechnology', 'Biotechnology R&D', 'Life Sciences']
    },
    points: 10,
    max_per_lead: 1
  },
  {
    slug: 'target-country',
    name: 'Target Country',
    description: 'Lead from primary target country (DACH, US, UK)',
    rule_type: 'field',
    category: 'demographic',
    conditions: { 
      field: 'organization.country', 
      operator: 'in',
      value: ['DE', 'AT', 'CH', 'US', 'UK', 'GB']
    },
    points: 5,
    max_per_lead: 1
  }
];

// =============================================================================
// Score Thresholds
// =============================================================================

export const SCORE_THRESHOLDS = {
  COLD: 0,
  WARM: 40,
  HOT: 80,
  VERY_HOT: 120
} as const;

// =============================================================================
// Score Tier Helper
// =============================================================================

export function getScoreTier(totalScore: number): 'cold' | 'warm' | 'hot' | 'very_hot' {
  if (totalScore >= SCORE_THRESHOLDS.VERY_HOT) return 'very_hot';
  if (totalScore >= SCORE_THRESHOLDS.HOT) return 'hot';
  if (totalScore >= SCORE_THRESHOLDS.WARM) return 'warm';
  return 'cold';
}

// =============================================================================
// Export
// =============================================================================

export default DEFAULT_SCORING_RULES;
