// =============================================================================
// src/config/intentRules.ts
// Intent Detection Rules Configuration
// =============================================================================

import type { IntentType } from '../types/index.js';

// =============================================================================
// Intent Rule Types
// =============================================================================

export interface IntentTrigger {
  event_type?: string;
  metadata?: Record<string, unknown>;
  lead_field?: string;
  organization_field?: string;
  pattern?: string;
  contains?: string[];
  in?: string[];
  lt?: number;
  gte?: number;
}

export interface IntentRule {
  id: string;
  intent: IntentType;
  trigger: IntentTrigger;
  confidence_points: number;
  description: string;
}

// =============================================================================
// Intent Rules Configuration
// =============================================================================

export const INTENT_RULES: IntentRule[] = [
  // ===========================================================================
  // RESEARCH LAB INTENT (+120 pts total possible)
  // Target: Academic researchers, PhD students, PostDocs
  // ===========================================================================
  {
    id: 'research-16s-pricing',
    intent: 'research',
    trigger: { 
      event_type: 'page_visited', 
      metadata: { page_path: '/pricing/16s' } 
    },
    confidence_points: 25,
    description: 'Viewed 16S microbiome pricing'
  },
  {
    id: 'research-academic-email',
    intent: 'research',
    trigger: { 
      lead_field: 'email', 
      pattern: '\\.(edu|ac\\.|uni-|university)' 
    },
    confidence_points: 30,
    description: 'Academic email domain'
  },
  {
    id: 'research-job-title',
    intent: 'research',
    trigger: { 
      lead_field: 'job_title', 
      contains: ['PhD', 'PostDoc', 'Researcher', 'Professor', 'PI', 'Scientist', 'Student'] 
    },
    confidence_points: 20,
    description: 'Academic job title'
  },
  {
    id: 'research-sample-report',
    intent: 'research',
    trigger: { 
      event_type: 'sample_report_downloaded' 
    },
    confidence_points: 20,
    description: 'Downloaded sample report'
  },
  {
    id: 'research-small-volume',
    intent: 'research',
    trigger: { 
      event_type: 'roi_calculator_submitted', 
      metadata: { samples_per_month: { lt: 100 } } 
    },
    confidence_points: 25,
    description: 'ROI calc < 100 samples/month'
  },
  {
    id: 'research-publication-page',
    intent: 'research',
    trigger: { 
      event_type: 'page_visited', 
      metadata: { page_path: '/publications' } 
    },
    confidence_points: 15,
    description: 'Viewed publications page'
  },
  {
    id: 'research-methods-page',
    intent: 'research',
    trigger: { 
      event_type: 'page_visited', 
      metadata: { page_path: '/methods' } 
    },
    confidence_points: 10,
    description: 'Viewed methods page'
  },

  // ===========================================================================
  // B2B LAB INTENT (+155 pts total possible)
  // Target: Enterprise labs, Lab Directors, Operations Managers
  // ===========================================================================
  {
    id: 'b2b-roi-calculator',
    intent: 'b2b',
    trigger: { 
      event_type: 'roi_calculator_submitted' 
    },
    confidence_points: 20,
    description: 'Used ROI calculator'
  },
  {
    id: 'b2b-enterprise-page',
    intent: 'b2b',
    trigger: { 
      event_type: 'page_visited', 
      metadata: { page_path: '/enterprise' } 
    },
    confidence_points: 30,
    description: 'Viewed enterprise page'
  },
  {
    id: 'b2b-high-volume',
    intent: 'b2b',
    trigger: { 
      event_type: 'roi_calculator_submitted', 
      metadata: { samples_per_month: { gte: 100 } } 
    },
    confidence_points: 35,
    description: 'ROI calc >= 100 samples/month'
  },
  {
    id: 'b2b-company-size',
    intent: 'b2b',
    trigger: { 
      organization_field: 'company_size', 
      in: ['51-200', '201-500', '501-1000', '1000+'] 
    },
    confidence_points: 25,
    description: 'Medium/large company'
  },
  {
    id: 'b2b-job-title',
    intent: 'b2b',
    trigger: { 
      lead_field: 'job_title', 
      contains: ['Director', 'VP', 'Head of', 'Manager', 'Operations', 'Laboratory Director'] 
    },
    confidence_points: 20,
    description: 'Business/operations title'
  },
  {
    id: 'b2b-api-docs',
    intent: 'b2b',
    trigger: { 
      event_type: 'page_visited', 
      metadata: { page_path: '/api-docs' } 
    },
    confidence_points: 25,
    description: 'Viewed API documentation'
  },
  {
    id: 'b2b-integration-page',
    intent: 'b2b',
    trigger: { 
      event_type: 'page_visited', 
      metadata: { page_path: '/integrations' } 
    },
    confidence_points: 20,
    description: 'Viewed integrations page'
  },
  {
    id: 'b2b-demo-requested',
    intent: 'b2b',
    trigger: { 
      event_type: 'demo_requested' 
    },
    confidence_points: 25,
    description: 'Requested a demo'
  },

  // ===========================================================================
  // CO-CREATION INTENT (+180 pts total possible)
  // Target: Pharma/Biotech partnerships, custom panel development
  // ===========================================================================
  {
    id: 'cocreation-partnership-page',
    intent: 'co_creation',
    trigger: { 
      event_type: 'page_visited', 
      metadata: { page_path: '/partnerships' } 
    },
    confidence_points: 40,
    description: 'Viewed partnerships page'
  },
  {
    id: 'cocreation-custom-panel',
    intent: 'co_creation',
    trigger: { 
      event_type: 'contact_form_submitted', 
      metadata: { inquiry_type: 'custom_panel' } 
    },
    confidence_points: 50,
    description: 'Custom panel inquiry'
  },
  {
    id: 'cocreation-whitelabel',
    intent: 'co_creation',
    trigger: { 
      event_type: 'page_visited', 
      metadata: { page_path: '/white-label' } 
    },
    confidence_points: 45,
    description: 'Viewed white-label page'
  },
  {
    id: 'cocreation-pharma',
    intent: 'co_creation',
    trigger: { 
      organization_field: 'industry', 
      in: ['Pharmaceutical', 'Biotechnology R&D', 'Biotech', 'Pharma'] 
    },
    confidence_points: 20,
    description: 'Pharma/Biotech R&D company'
  },
  {
    id: 'cocreation-exec-title',
    intent: 'co_creation',
    trigger: { 
      lead_field: 'job_title', 
      contains: ['VP', 'CSO', 'CTO', 'Chief', 'Founder', 'CEO', 'President', 'C-Level'] 
    },
    confidence_points: 25,
    description: 'Executive/C-level title'
  },
  {
    id: 'cocreation-oem-page',
    intent: 'co_creation',
    trigger: { 
      event_type: 'page_visited', 
      metadata: { page_path: '/oem' } 
    },
    confidence_points: 35,
    description: 'Viewed OEM page'
  },
  {
    id: 'cocreation-licensing-inquiry',
    intent: 'co_creation',
    trigger: { 
      event_type: 'contact_form_submitted', 
      metadata: { inquiry_type: 'licensing' } 
    },
    confidence_points: 45,
    description: 'Licensing inquiry'
  }
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get all rules for a specific intent type
 */
export function getRulesByIntent(intent: IntentType): IntentRule[] {
  return INTENT_RULES.filter(rule => rule.intent === intent);
}

/**
 * Get a specific rule by ID
 */
export function getRuleById(ruleId: string): IntentRule | undefined {
  return INTENT_RULES.find(rule => rule.id === ruleId);
}

/**
 * Get maximum possible confidence points for each intent
 */
export function getMaxConfidenceByIntent(): Record<IntentType, number> {
  const maxPoints: Record<IntentType, number> = {
    research: 0,
    b2b: 0,
    co_creation: 0
  };

  for (const rule of INTENT_RULES) {
    maxPoints[rule.intent] += rule.confidence_points;
  }

  return maxPoints;
}

export default INTENT_RULES;
