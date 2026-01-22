// =============================================================================
// src/services/intentDetector.ts
// Intent Detection Service for Lead Intent Analysis
// =============================================================================

import { db } from '../db/index.js';
import { INTENT_RULES, type IntentRule, type IntentTrigger } from '../config/intentRules.js';
import type { 
  Lead, 
  MarketingEvent, 
  IntentSignal,
  IntentType,
  IntentSummary,
  IntentCalculationResult,
  Organization
} from '../types/index.js';

// =============================================================================
// Intent Detection Result Types
// =============================================================================

export interface IntentDetectionResult {
  signals_detected: string[];
  total_points_added: number;
  intent_summary: IntentSummary;
  primary_intent: IntentType | null;
  intent_confidence: number;
  is_routable: boolean;
  conflict_detected: boolean;
}

// =============================================================================
// Routing Configuration (for confidence calculation)
// =============================================================================

const ROUTING_CONFIG = {
  min_score_threshold: 40,
  min_intent_confidence: 60,
  intent_confidence_margin: 15,
  max_unrouted_days: 14
};

// =============================================================================
// Intent Detector Class
// =============================================================================

export class IntentDetector {
  private rules: IntentRule[] = [];
  private initialized: boolean = false;

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Load intent rules (from config)
   */
  async initialize(): Promise<void> {
    this.rules = INTENT_RULES;
    this.initialized = true;
    console.log(`[Intent Detector] Loaded ${this.rules.length} intent rules`);
  }

  /**
   * Get all loaded rules
   */
  getRules(): IntentRule[] {
    return this.rules;
  }

  // ===========================================================================
  // Event Processing
  // ===========================================================================

  /**
   * Process an event and detect intent signals
   */
  async processEvent(event: MarketingEvent, lead: Lead): Promise<IntentDetectionResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const result: IntentDetectionResult = {
      signals_detected: [],
      total_points_added: 0,
      intent_summary: { research: 0, b2b: 0, co_creation: 0 },
      primary_intent: null,
      intent_confidence: 0,
      is_routable: false,
      conflict_detected: false
    };

    // Get organization data if available
    let organization: Organization | null = null;
    if (lead.organization_id) {
      organization = await db.queryOne<Organization>(`
        SELECT * FROM organizations WHERE id = $1
      `, [lead.organization_id]);
    }

    // Process each rule
    for (const rule of this.rules) {
      const triggerType = this.getTriggerType(rule);
      
      if (await this.matchesIntentTrigger(rule, event, lead, organization)) {
        // Check if this signal was already recorded for this lead
        const existingSignal = await this.hasExistingSignal(lead.id, rule.id);
        
        if (!existingSignal) {
          // Store the intent signal
          await this.storeIntentSignal({
            lead_id: lead.id,
            intent: rule.intent,
            rule_id: rule.id,
            confidence_points: rule.confidence_points,
            trigger_type: triggerType,
            event_id: event.id,
            trigger_data: this.buildTriggerData(rule, event, lead, organization)
          });

          result.signals_detected.push(rule.id);
          result.total_points_added += rule.confidence_points;
          
          console.log(`[Intent Detector] Signal detected: ${rule.id} (${rule.intent}, +${rule.confidence_points} pts) for lead ${lead.id}`);
        }
      }
    }

    // If any signals were detected, recalculate intent
    if (result.signals_detected.length > 0 || await this.hasAnySignals(lead.id)) {
      const intentResult = await this.calculateIntentConfidence(lead.id);
      
      result.intent_summary = intentResult.intent_summary;
      result.primary_intent = intentResult.primary_intent;
      result.intent_confidence = intentResult.intent_confidence;
      result.is_routable = intentResult.is_routable;
      result.conflict_detected = intentResult.conflict_detected;

      // Update lead's intent fields
      await this.updateLeadIntent(lead.id, intentResult);
    }

    return result;
  }

  /**
   * Process lead profile changes for intent detection
   * Called when lead profile is updated
   */
  async processLeadProfile(lead: Lead): Promise<IntentDetectionResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const result: IntentDetectionResult = {
      signals_detected: [],
      total_points_added: 0,
      intent_summary: { research: 0, b2b: 0, co_creation: 0 },
      primary_intent: null,
      intent_confidence: 0,
      is_routable: false,
      conflict_detected: false
    };

    // Get organization data if available
    let organization: Organization | null = null;
    if (lead.organization_id) {
      organization = await db.queryOne<Organization>(`
        SELECT * FROM organizations WHERE id = $1
      `, [lead.organization_id]);
    }

    // Only process field-based rules (lead_field, organization_field)
    const fieldRules = this.rules.filter(rule => 
      rule.trigger.lead_field || rule.trigger.organization_field
    );

    for (const rule of fieldRules) {
      const triggerType = this.getTriggerType(rule);
      
      if (await this.matchesFieldTrigger(rule, lead, organization)) {
        const existingSignal = await this.hasExistingSignal(lead.id, rule.id);
        
        if (!existingSignal) {
          await this.storeIntentSignal({
            lead_id: lead.id,
            intent: rule.intent,
            rule_id: rule.id,
            confidence_points: rule.confidence_points,
            trigger_type: triggerType,
            trigger_data: this.buildTriggerData(rule, null, lead, organization)
          });

          result.signals_detected.push(rule.id);
          result.total_points_added += rule.confidence_points;
          
          console.log(`[Intent Detector] Profile signal: ${rule.id} (${rule.intent}, +${rule.confidence_points} pts) for lead ${lead.id}`);
        }
      }
    }

    // Recalculate intent
    if (result.signals_detected.length > 0 || await this.hasAnySignals(lead.id)) {
      const intentResult = await this.calculateIntentConfidence(lead.id);
      
      result.intent_summary = intentResult.intent_summary;
      result.primary_intent = intentResult.primary_intent;
      result.intent_confidence = intentResult.intent_confidence;
      result.is_routable = intentResult.is_routable;
      result.conflict_detected = intentResult.conflict_detected;

      await this.updateLeadIntent(lead.id, intentResult);
    }

    return result;
  }

  // ===========================================================================
  // Trigger Matching
  // ===========================================================================

  /**
   * Check if a rule's trigger matches the current event/lead/organization
   */
  private async matchesIntentTrigger(
    rule: IntentRule,
    event: MarketingEvent,
    lead: Lead,
    organization: Organization | null
  ): Promise<boolean> {
    const trigger = rule.trigger;

    // Event-based triggers
    if (trigger.event_type) {
      if (event.event_type !== trigger.event_type) {
        return false;
      }

      // Check metadata conditions if specified
      if (trigger.metadata) {
        for (const [key, expectedValue] of Object.entries(trigger.metadata)) {
          const actualValue = event.metadata?.[key];

          // Handle comparison operators in metadata
          if (typeof expectedValue === 'object' && expectedValue !== null) {
            const opObj = expectedValue as { lt?: number; gte?: number };
            
            if (opObj.lt !== undefined) {
              if (!(Number(actualValue) < opObj.lt)) return false;
            }
            if (opObj.gte !== undefined) {
              if (!(Number(actualValue) >= opObj.gte)) return false;
            }
          } else if (actualValue !== expectedValue) {
            return false;
          }
        }
      }

      return true;
    }

    // Field-based triggers (lead_field, organization_field)
    return this.matchesFieldTrigger(rule, lead, organization);
  }

  /**
   * Check if a field-based trigger matches
   */
  private matchesFieldTrigger(
    rule: IntentRule,
    lead: Lead,
    organization: Organization | null
  ): boolean {
    const trigger = rule.trigger;

    // Lead field triggers
    if (trigger.lead_field) {
      const fieldValue = this.getLeadFieldValue(lead, trigger.lead_field);
      
      if (fieldValue === undefined || fieldValue === null) {
        return false;
      }

      return this.matchesTriggerCondition(trigger, String(fieldValue));
    }

    // Organization field triggers
    if (trigger.organization_field) {
      if (!organization) {
        return false;
      }

      const fieldValue = this.getOrganizationFieldValue(organization, trigger.organization_field);
      
      if (fieldValue === undefined || fieldValue === null) {
        return false;
      }

      return this.matchesTriggerCondition(trigger, String(fieldValue));
    }

    return false;
  }

  /**
   * Match trigger conditions (pattern, contains, in)
   */
  private matchesTriggerCondition(trigger: IntentTrigger, value: string): boolean {
    // Pattern matching (regex)
    if (trigger.pattern) {
      try {
        const regex = new RegExp(trigger.pattern, 'i');
        return regex.test(value);
      } catch {
        return false;
      }
    }

    // Contains matching (any word in array)
    if (trigger.contains) {
      const lowerValue = value.toLowerCase();
      return trigger.contains.some(word => 
        lowerValue.includes(word.toLowerCase())
      );
    }

    // In matching (exact match in array)
    if (trigger.in) {
      return trigger.in.includes(value);
    }

    return false;
  }

  /**
   * Get a field value from lead
   */
  private getLeadFieldValue(lead: Lead, field: string): unknown {
    return (lead as unknown as Record<string, unknown>)[field];
  }

  /**
   * Get a field value from organization
   */
  private getOrganizationFieldValue(organization: Organization, field: string): unknown {
    return (organization as unknown as Record<string, unknown>)[field];
  }

  /**
   * Determine the trigger type for a rule
   */
  private getTriggerType(rule: IntentRule): string {
    if (rule.trigger.event_type) return 'event';
    if (rule.trigger.lead_field) return 'lead_field';
    if (rule.trigger.organization_field) return 'organization_field';
    return 'unknown';
  }

  /**
   * Build trigger data for storage
   */
  private buildTriggerData(
    rule: IntentRule,
    event: MarketingEvent | null,
    lead: Lead,
    organization: Organization | null
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {
      rule_description: rule.description
    };

    if (event) {
      data.event_type = event.event_type;
      data.event_metadata = event.metadata;
    }

    if (rule.trigger.lead_field) {
      data.matched_field = rule.trigger.lead_field;
      data.matched_value = this.getLeadFieldValue(lead, rule.trigger.lead_field);
    }

    if (rule.trigger.organization_field && organization) {
      data.matched_field = rule.trigger.organization_field;
      data.matched_value = this.getOrganizationFieldValue(organization, rule.trigger.organization_field);
    }

    return data;
  }

  // ===========================================================================
  // Signal Storage
  // ===========================================================================

  /**
   * Store an intent signal in the database
   */
  private async storeIntentSignal(signal: {
    lead_id: string;
    intent: IntentType;
    rule_id: string;
    confidence_points: number;
    trigger_type: string;
    event_id?: string;
    trigger_data?: Record<string, unknown>;
  }): Promise<IntentSignal> {
    const result = await db.queryOne<IntentSignal>(`
      INSERT INTO intent_signals (
        lead_id, intent, rule_id, confidence_points, 
        trigger_type, event_id, trigger_data
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      signal.lead_id,
      signal.intent,
      signal.rule_id,
      signal.confidence_points,
      signal.trigger_type,
      signal.event_id || null,
      JSON.stringify(signal.trigger_data || {})
    ]);

    if (!result) {
      throw new Error('Failed to store intent signal');
    }

    return result;
  }

  /**
   * Check if a signal already exists for this lead and rule
   */
  private async hasExistingSignal(leadId: string, ruleId: string): Promise<boolean> {
    const existing = await db.queryOne<{ count: number }>(`
      SELECT COUNT(*)::int as count FROM intent_signals 
      WHERE lead_id = $1 AND rule_id = $2
    `, [leadId, ruleId]);

    return existing !== null && existing.count > 0;
  }

  /**
   * Check if lead has any intent signals
   */
  private async hasAnySignals(leadId: string): Promise<boolean> {
    const result = await db.queryOne<{ count: number }>(`
      SELECT COUNT(*)::int as count FROM intent_signals WHERE lead_id = $1
    `, [leadId]);

    return result !== null && result.count > 0;
  }

  // ===========================================================================
  // Intent Confidence Calculation
  // ===========================================================================

  /**
   * Calculate intent confidence based on all signals for a lead
   */
  async calculateIntentConfidence(leadId: string): Promise<IntentCalculationResult> {
    // Get all signals for this lead
    const signals = await db.query<IntentSignal>(`
      SELECT * FROM intent_signals WHERE lead_id = $1
    `, [leadId]);

    // Aggregate points by intent
    const summary: IntentSummary = { research: 0, b2b: 0, co_creation: 0 };

    for (const signal of signals) {
      summary[signal.intent] += signal.confidence_points;
    }

    // Find primary and secondary intents
    const sorted = (Object.entries(summary) as [IntentType, number][])
      .sort(([, a], [, b]) => b - a);
    
    const [primaryIntent, primaryScore] = sorted[0];
    const [, secondaryScore] = sorted[1] || [null, 0];

    // Calculate total points
    const totalPoints = Object.values(summary).reduce((a, b) => a + b, 0);

    // Calculate confidence (0-100)
    let confidence = 0;
    if (totalPoints > 0) {
      // Base confidence from dominance of primary intent
      confidence = Math.round((primaryScore / totalPoints) * 100);

      // Boost if primary clearly beats secondary
      if (primaryScore - secondaryScore >= ROUTING_CONFIG.intent_confidence_margin) {
        confidence = Math.min(100, confidence + 10);
      }

      // Reduce if total signals are weak
      if (totalPoints < 30) {
        confidence = Math.max(0, confidence - 20);
      }
    }

    // Detect conflict
    const conflict_detected = 
      secondaryScore > 0 && 
      (primaryScore - secondaryScore) < ROUTING_CONFIG.intent_confidence_margin;

    // Determine if routable
    const is_routable = 
      confidence >= ROUTING_CONFIG.min_intent_confidence && 
      !conflict_detected;

    return {
      primary_intent: primaryScore > 0 ? primaryIntent : null,
      intent_confidence: confidence,
      intent_summary: summary,
      is_routable,
      conflict_detected
    };
  }

  /**
   * Update lead's intent fields in the database
   */
  async updateLeadIntent(leadId: string, intent: IntentCalculationResult): Promise<void> {
    await db.execute(`
      UPDATE leads SET 
        primary_intent = $2,
        intent_confidence = $3,
        intent_summary = $4,
        updated_at = NOW()
      WHERE id = $1
    `, [
      leadId,
      intent.primary_intent,
      intent.intent_confidence,
      JSON.stringify(intent.intent_summary)
    ]);

    console.log(`[Intent Detector] Updated lead ${leadId}: intent=${intent.primary_intent}, confidence=${intent.intent_confidence}%`);
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Get all intent signals for a lead
   */
  async getLeadIntentSignals(leadId: string): Promise<IntentSignal[]> {
    return db.query<IntentSignal>(`
      SELECT * FROM intent_signals 
      WHERE lead_id = $1 
      ORDER BY detected_at DESC
    `, [leadId]);
  }

  /**
   * Get intent summary for a lead
   */
  async getLeadIntentSummary(leadId: string): Promise<{
    signals: IntentSignal[];
    summary: IntentSummary;
    primary_intent: IntentType | null;
    confidence: number;
    is_routable: boolean;
    conflict_detected: boolean;
  }> {
    const signals = await this.getLeadIntentSignals(leadId);
    const calculation = await this.calculateIntentConfidence(leadId);

    return {
      signals,
      summary: calculation.intent_summary,
      primary_intent: calculation.primary_intent,
      confidence: calculation.intent_confidence,
      is_routable: calculation.is_routable,
      conflict_detected: calculation.conflict_detected
    };
  }

  /**
   * Remove all intent signals for a lead (for recalculation)
   */
  async clearLeadIntentSignals(leadId: string): Promise<number> {
    const result = await db.execute(`
      DELETE FROM intent_signals WHERE lead_id = $1
    `, [leadId]);

    // Reset lead's intent fields
    await db.execute(`
      UPDATE leads SET 
        primary_intent = NULL,
        intent_confidence = 0,
        intent_summary = '{"research":0,"b2b":0,"co_creation":0}',
        updated_at = NOW()
      WHERE id = $1
    `, [leadId]);

    return result;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let intentDetectorInstance: IntentDetector | null = null;

export function getIntentDetector(): IntentDetector {
  if (!intentDetectorInstance) {
    intentDetectorInstance = new IntentDetector();
  }
  return intentDetectorInstance;
}

export default IntentDetector;
