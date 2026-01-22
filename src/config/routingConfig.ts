// =============================================================================
// src/config/routingConfig.ts
// Routing Configuration for Smart Lead Routing
// =============================================================================

import type { IntentType } from '../types/index.js';

// =============================================================================
// Routing Configuration Type
// =============================================================================

export interface OwnerAssignmentConfig {
  role: string;
  strategy: 'round_robin' | 'capacity_based' | 'manual' | 'notify_only';
  region_aware?: boolean;
  value_tier_aware?: boolean;
}

export interface RoutingConfig {
  // Minimum lead score before attempting to route
  min_score_threshold: number;
  
  // Minimum intent confidence before routing (0-100)
  min_intent_confidence: number;
  
  // Primary must exceed secondary by this margin (prevents conflicts)
  intent_confidence_margin: number;
  
  // Maximum days in Global Pool before forcing manual review
  max_unrouted_days: number;
  
  // Fallback pipeline for ambiguous leads
  fallback_pipeline: string;
  
  // Pipeline mapping by intent
  intent_to_pipeline: Record<IntentType, string>;
  
  // Owner assignment rules by intent
  owner_assignment: Record<IntentType | 'discovery', OwnerAssignmentConfig>;
}

// =============================================================================
// Routing Configuration
// =============================================================================

export const ROUTING_CONFIG: RoutingConfig = {
  // Minimum lead score before attempting to route
  min_score_threshold: 40,
  
  // Minimum intent confidence before routing (0-100)
  min_intent_confidence: 60,
  
  // Primary must exceed secondary by this margin (prevents conflicts)
  intent_confidence_margin: 15,
  
  // Maximum days in Global Pool before forcing manual review
  max_unrouted_days: 14,
  
  // Fallback pipeline for ambiguous leads
  fallback_pipeline: 'discovery',
  
  // Pipeline mapping
  intent_to_pipeline: {
    research: 'research-lab',
    b2b: 'b2b-lab-enablement',
    co_creation: 'panel-co-creation'
  },
  
  // Owner assignment rules
  owner_assignment: {
    research: { 
      role: 'bdr', 
      strategy: 'round_robin', 
      region_aware: true 
    },
    b2b: { 
      role: 'ae', 
      strategy: 'capacity_based', 
      value_tier_aware: true 
    },
    co_creation: { 
      role: 'partnership_manager', 
      strategy: 'manual' 
    },
    discovery: { 
      role: 'marketing_manager', 
      strategy: 'notify_only' 
    }
  }
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get pipeline slug for an intent type
 */
export function getPipelineForIntent(intent: IntentType): string {
  return ROUTING_CONFIG.intent_to_pipeline[intent] || ROUTING_CONFIG.fallback_pipeline;
}

/**
 * Get owner assignment config for an intent type
 */
export function getOwnerAssignmentConfig(intent: IntentType | 'discovery'): OwnerAssignmentConfig {
  return ROUTING_CONFIG.owner_assignment[intent] || ROUTING_CONFIG.owner_assignment.discovery;
}

/**
 * Check if a lead meets routing thresholds
 */
export function meetsRoutingThresholds(score: number, intentConfidence: number): boolean {
  return score >= ROUTING_CONFIG.min_score_threshold && 
         intentConfidence >= ROUTING_CONFIG.min_intent_confidence;
}

export default ROUTING_CONFIG;
