// =============================================================================
// src/services/reportService.ts
// Report & Analytics Service
// =============================================================================

import { db } from '../db/index.js';
import { SCORE_THRESHOLDS } from '../config/scoringRules.js';
import type { IntentType } from '../types/index.js';

// =============================================================================
// Report Response Types
// =============================================================================

export interface ScoreTierReport {
  tier: 'cold' | 'warm' | 'hot' | 'very_hot';
  count: number;
  percentage: number;
  avg_score: number;
  min_score_threshold: number;
  max_score_threshold: number | null;
}

export interface LeadsByScoreResponse {
  total_leads: number;
  score_distribution: ScoreTierReport[];
  avg_total_score: number;
  score_breakdown: {
    avg_demographic: number;
    avg_engagement: number;
    avg_behavior: number;
  };
}

export interface IntentReport {
  intent: IntentType;
  count: number;
  percentage: number;
  avg_confidence: number;
  routed_count: number;
  routed_percentage: number;
}

export interface LeadsByIntentResponse {
  total_leads_with_intent: number;
  no_intent_count: number;
  intent_distribution: IntentReport[];
  conflict_count: number;
}

export interface PipelineStageMetrics {
  stage_id: string;
  stage_name: string;
  position: number;
  deal_count: number;
  total_value: number;
  avg_value: number;
  avg_time_in_stage_days: number;
  conversion_rate: number;
}

export interface PipelineFunnelResponse {
  pipeline_id: string;
  pipeline_name: string;
  total_deals: number;
  open_deals: number;
  won_deals: number;
  lost_deals: number;
  total_value: number;
  won_value: number;
  win_rate: number;
  avg_sales_cycle_days: number;
  stages: PipelineStageMetrics[];
}

export interface CampaignMetrics {
  campaign_id: string;
  campaign_name: string;
  utm_campaign: string | null;
  status: string;
  leads_generated: number;
  first_touch_leads: number;
  last_touch_leads: number;
  deals_created: number;
  revenue_attributed: number;
  spent: number;
  roi: number;
  cost_per_lead: number;
}

export interface CampaignAttributionResponse {
  total_campaigns: number;
  total_leads_attributed: number;
  total_revenue: number;
  total_spent: number;
  overall_roi: number;
  campaigns: CampaignMetrics[];
  top_sources: { source: string; lead_count: number; percentage: number }[];
}

export interface RoutingMetrics {
  period: string;
  total_routed: number;
  by_pipeline: { pipeline_name: string; count: number; percentage: number }[];
  by_intent: { intent: IntentType; count: number; percentage: number }[];
  avg_time_to_route_hours: number;
  manual_review_count: number;
  manual_review_percentage: number;
}

export interface RoutingEffectivenessResponse {
  total_leads: number;
  routed_count: number;
  unrouted_count: number;
  pending_count: number;
  manual_review_count: number;
  routing_rate: number;
  avg_score_at_routing: number;
  avg_time_to_route_hours: number;
  routing_by_period: RoutingMetrics[];
  pipeline_distribution: { pipeline_name: string; count: number; percentage: number }[];
}

export interface DateRangeFilter {
  start_date?: string;
  end_date?: string;
}

// =============================================================================
// Report Service Class
// =============================================================================

export class ReportService {
  // ===========================================================================
  // Leads by Score Tier
  // ===========================================================================
  
  async getLeadsByScore(filters?: DateRangeFilter): Promise<LeadsByScoreResponse> {
    // Build date filter
    let dateCondition = '';
    const params: unknown[] = [];
    
    if (filters?.start_date) {
      params.push(filters.start_date);
      dateCondition += ` AND created_at >= $${params.length}`;
    }
    if (filters?.end_date) {
      params.push(filters.end_date);
      dateCondition += ` AND created_at <= $${params.length}`;
    }
    
    // Get total count and averages
    const totals = await db.queryOne<{
      total: number;
      avg_score: number;
      avg_demographic: number;
      avg_engagement: number;
      avg_behavior: number;
    }>(`
      SELECT 
        COUNT(*)::int as total,
        COALESCE(AVG(total_score), 0)::numeric(10,2) as avg_score,
        COALESCE(AVG(demographic_score), 0)::numeric(10,2) as avg_demographic,
        COALESCE(AVG(engagement_score), 0)::numeric(10,2) as avg_engagement,
        COALESCE(AVG(behavior_score), 0)::numeric(10,2) as avg_behavior
      FROM leads
      WHERE 1=1 ${dateCondition}
    `, params);
    
    const total = totals?.total ?? 0;
    
    // Get score distribution by tier
    const distribution = await db.query<{
      tier: string;
      count: number;
      avg_score: number;
    }>(`
      SELECT 
        CASE 
          WHEN total_score >= ${SCORE_THRESHOLDS.VERY_HOT} THEN 'very_hot'
          WHEN total_score >= ${SCORE_THRESHOLDS.HOT} THEN 'hot'
          WHEN total_score >= ${SCORE_THRESHOLDS.WARM} THEN 'warm'
          ELSE 'cold'
        END as tier,
        COUNT(*)::int as count,
        COALESCE(AVG(total_score), 0)::numeric(10,2) as avg_score
      FROM leads
      WHERE 1=1 ${dateCondition}
      GROUP BY tier
      ORDER BY 
        CASE tier
          WHEN 'very_hot' THEN 1
          WHEN 'hot' THEN 2
          WHEN 'warm' THEN 3
          ELSE 4
        END
    `, params);
    
    // Map to response format with thresholds
    const tierThresholds: Record<string, { min: number; max: number | null }> = {
      cold: { min: 0, max: SCORE_THRESHOLDS.WARM - 1 },
      warm: { min: SCORE_THRESHOLDS.WARM, max: SCORE_THRESHOLDS.HOT - 1 },
      hot: { min: SCORE_THRESHOLDS.HOT, max: SCORE_THRESHOLDS.VERY_HOT - 1 },
      very_hot: { min: SCORE_THRESHOLDS.VERY_HOT, max: null }
    };
    
    const scoreDistribution: ScoreTierReport[] = ['cold', 'warm', 'hot', 'very_hot'].map(tier => {
      const found = distribution.find(d => d.tier === tier);
      const thresholds = tierThresholds[tier];
      return {
        tier: tier as ScoreTierReport['tier'],
        count: found?.count ?? 0,
        percentage: total > 0 ? Number((((found?.count ?? 0) / total) * 100).toFixed(2)) : 0,
        avg_score: Number(found?.avg_score ?? 0),
        min_score_threshold: thresholds.min,
        max_score_threshold: thresholds.max
      };
    });
    
    return {
      total_leads: total,
      score_distribution: scoreDistribution,
      avg_total_score: Number(totals?.avg_score ?? 0),
      score_breakdown: {
        avg_demographic: Number(totals?.avg_demographic ?? 0),
        avg_engagement: Number(totals?.avg_engagement ?? 0),
        avg_behavior: Number(totals?.avg_behavior ?? 0)
      }
    };
  }
  
  // ===========================================================================
  // Leads by Intent
  // ===========================================================================
  
  async getLeadsByIntent(filters?: DateRangeFilter): Promise<LeadsByIntentResponse> {
    // Build date filter
    let dateCondition = '';
    const params: unknown[] = [];
    
    if (filters?.start_date) {
      params.push(filters.start_date);
      dateCondition += ` AND created_at >= $${params.length}`;
    }
    if (filters?.end_date) {
      params.push(filters.end_date);
      dateCondition += ` AND created_at <= $${params.length}`;
    }
    
    // Get intent distribution
    const intentData = await db.query<{
      primary_intent: string | null;
      count: number;
      avg_confidence: number;
      routed_count: number;
    }>(`
      SELECT 
        primary_intent,
        COUNT(*)::int as count,
        COALESCE(AVG(intent_confidence), 0)::numeric(10,2) as avg_confidence,
        COUNT(*) FILTER (WHERE routing_status = 'routed')::int as routed_count
      FROM leads
      WHERE 1=1 ${dateCondition}
      GROUP BY primary_intent
    `, params);
    
    // Calculate totals
    const totalWithIntent = intentData
      .filter(d => d.primary_intent !== null)
      .reduce((sum, d) => sum + d.count, 0);
    
    const noIntentRow = intentData.find(d => d.primary_intent === null);
    const noIntentCount = noIntentRow?.count ?? 0;
    
    // Get conflict count (leads with similar scores for multiple intents)
    const conflictResult = await db.queryOne<{ count: number }>(`
      SELECT COUNT(*)::int as count
      FROM leads
      WHERE 1=1 ${dateCondition}
        AND primary_intent IS NOT NULL
        AND (
          ABS((intent_summary->>'research')::int - (intent_summary->>'b2b')::int) <= 10
          OR ABS((intent_summary->>'research')::int - (intent_summary->>'co_creation')::int) <= 10
          OR ABS((intent_summary->>'b2b')::int - (intent_summary->>'co_creation')::int) <= 10
        )
    `, params);
    
    // Build intent distribution
    const intentDistribution: IntentReport[] = ['research', 'b2b', 'co_creation']
      .map(intent => {
        const found = intentData.find(d => d.primary_intent === intent);
        const count = found?.count ?? 0;
        const routedCount = found?.routed_count ?? 0;
        return {
          intent: intent as IntentType,
          count,
          percentage: totalWithIntent > 0 ? Number(((count / totalWithIntent) * 100).toFixed(2)) : 0,
          avg_confidence: Number(found?.avg_confidence ?? 0),
          routed_count: routedCount,
          routed_percentage: count > 0 ? Number(((routedCount / count) * 100).toFixed(2)) : 0
        };
      });
    
    return {
      total_leads_with_intent: totalWithIntent,
      no_intent_count: noIntentCount,
      intent_distribution: intentDistribution,
      conflict_count: conflictResult?.count ?? 0
    };
  }
  
  // ===========================================================================
  // Pipeline Funnel Metrics
  // ===========================================================================
  
  async getPipelineFunnel(
    pipelineId?: string,
    filters?: DateRangeFilter
  ): Promise<PipelineFunnelResponse[]> {
    // Build filters
    const conditions: string[] = ['p.is_active = TRUE'];
    const params: unknown[] = [];
    let paramIndex = 1;
    
    if (pipelineId) {
      conditions.push(`p.id = $${paramIndex++}`);
      params.push(pipelineId);
    }
    
    let dateCondition = '';
    if (filters?.start_date) {
      dateCondition += ` AND d.created_at >= $${paramIndex++}`;
      params.push(filters.start_date);
    }
    if (filters?.end_date) {
      dateCondition += ` AND d.created_at <= $${paramIndex++}`;
      params.push(filters.end_date);
    }
    
    // Get pipelines
    const pipelines = await db.query<{
      id: string;
      name: string;
    }>(`
      SELECT id, name FROM pipelines 
      WHERE ${conditions.join(' AND ')}
      ORDER BY name
    `, pipelineId ? [pipelineId] : []);
    
    const results: PipelineFunnelResponse[] = [];
    
    for (const pipeline of pipelines) {
      // Get deal stats for pipeline
      const dealStats = await db.queryOne<{
        total_deals: number;
        open_deals: number;
        won_deals: number;
        lost_deals: number;
        total_value: number;
        won_value: number;
        avg_cycle_days: number;
      }>(`
        SELECT 
          COUNT(*)::int as total_deals,
          COUNT(*) FILTER (WHERE status = 'open')::int as open_deals,
          COUNT(*) FILTER (WHERE status = 'won')::int as won_deals,
          COUNT(*) FILTER (WHERE status = 'lost')::int as lost_deals,
          COALESCE(SUM(value), 0)::numeric(12,2) as total_value,
          COALESCE(SUM(value) FILTER (WHERE status = 'won'), 0)::numeric(12,2) as won_value,
          COALESCE(AVG(
            EXTRACT(EPOCH FROM (COALESCE(closed_at, NOW()) - created_at)) / 86400
          ) FILTER (WHERE status = 'won'), 0)::numeric(10,2) as avg_cycle_days
        FROM deals d
        WHERE d.pipeline_id = $1 ${dateCondition}
      `, [pipeline.id, ...params.slice(pipelineId ? 1 : 0)]);
      
      // Get stage metrics
      const stageMetrics = await db.query<{
        stage_id: string;
        stage_name: string;
        position: number;
        deal_count: number;
        total_value: number;
        avg_value: number;
        avg_time_days: number;
      }>(`
        SELECT 
          ps.id as stage_id,
          ps.name as stage_name,
          ps.position,
          COUNT(d.id)::int as deal_count,
          COALESCE(SUM(d.value), 0)::numeric(12,2) as total_value,
          COALESCE(AVG(d.value), 0)::numeric(12,2) as avg_value,
          COALESCE(AVG(
            EXTRACT(EPOCH FROM (NOW() - d.stage_entered_at)) / 86400
          ), 0)::numeric(10,2) as avg_time_days
        FROM pipeline_stages ps
        LEFT JOIN deals d ON d.stage_id = ps.id AND d.status = 'open' ${dateCondition}
        WHERE ps.pipeline_id = $1
        GROUP BY ps.id, ps.name, ps.position
        ORDER BY ps.position
      `, [pipeline.id, ...params.slice(pipelineId ? 1 : 0)]);
      
      // Calculate conversion rates between stages
      const stages: PipelineStageMetrics[] = stageMetrics.map((stage, index) => {
        const prevCount = index > 0 ? stageMetrics[index - 1].deal_count : dealStats?.total_deals ?? 0;
        const conversionRate = prevCount > 0 
          ? Number(((stage.deal_count / prevCount) * 100).toFixed(2))
          : 0;
        
        return {
          stage_id: stage.stage_id,
          stage_name: stage.stage_name,
          position: stage.position,
          deal_count: stage.deal_count,
          total_value: Number(stage.total_value),
          avg_value: Number(stage.avg_value),
          avg_time_in_stage_days: Number(stage.avg_time_days),
          conversion_rate: conversionRate
        };
      });
      
      const totalDeals = dealStats?.total_deals ?? 0;
      const wonDeals = dealStats?.won_deals ?? 0;
      
      results.push({
        pipeline_id: pipeline.id,
        pipeline_name: pipeline.name,
        total_deals: totalDeals,
        open_deals: dealStats?.open_deals ?? 0,
        won_deals: wonDeals,
        lost_deals: dealStats?.lost_deals ?? 0,
        total_value: Number(dealStats?.total_value ?? 0),
        won_value: Number(dealStats?.won_value ?? 0),
        win_rate: totalDeals > 0 ? Number(((wonDeals / totalDeals) * 100).toFixed(2)) : 0,
        avg_sales_cycle_days: Number(dealStats?.avg_cycle_days ?? 0),
        stages
      });
    }
    
    return results;
  }
  
  // ===========================================================================
  // Campaign Attribution
  // ===========================================================================
  
  async getCampaignAttribution(filters?: DateRangeFilter): Promise<CampaignAttributionResponse> {
    // Build date filter
    let dateCondition = '';
    const params: unknown[] = [];
    
    if (filters?.start_date) {
      params.push(filters.start_date);
      dateCondition += ` AND created_at >= $${params.length}`;
    }
    if (filters?.end_date) {
      params.push(filters.end_date);
      dateCondition += ` AND created_at <= $${params.length}`;
    }
    
    // Get campaign metrics
    const campaigns = await db.query<{
      id: string;
      name: string;
      utm_campaign: string | null;
      status: string;
      leads_generated: number;
      deals_created: number;
      revenue_attributed: number;
      spent: number;
    }>(`
      SELECT 
        id,
        name,
        utm_campaign,
        status,
        leads_generated,
        deals_created,
        COALESCE(revenue_attributed, 0)::numeric(12,2) as revenue_attributed,
        COALESCE(spent, 0)::numeric(10,2) as spent
      FROM campaigns
      WHERE 1=1 ${dateCondition}
      ORDER BY revenue_attributed DESC
    `, params);
    
    // Get first/last touch attribution from leads
    const touchAttribution = await db.query<{
      campaign_id: string;
      first_touch_count: number;
      last_touch_count: number;
    }>(`
      SELECT 
        c.id as campaign_id,
        COUNT(*) FILTER (WHERE l.first_touch_campaign = c.utm_campaign)::int as first_touch_count,
        COUNT(*) FILTER (WHERE l.last_touch_campaign = c.utm_campaign)::int as last_touch_count
      FROM campaigns c
      LEFT JOIN leads l ON l.first_touch_campaign = c.utm_campaign 
                        OR l.last_touch_campaign = c.utm_campaign
      WHERE 1=1 ${dateCondition.replace('created_at', 'c.created_at')}
      GROUP BY c.id
    `, params);
    
    // Get top sources
    const topSources = await db.query<{
      source: string;
      lead_count: number;
    }>(`
      SELECT 
        COALESCE(first_touch_source, 'Unknown') as source,
        COUNT(*)::int as lead_count
      FROM leads
      WHERE 1=1 ${dateCondition}
      GROUP BY first_touch_source
      ORDER BY lead_count DESC
      LIMIT 10
    `, params);
    
    // Calculate totals
    const totalLeadsAttributed = topSources.reduce((sum, s) => sum + s.lead_count, 0);
    const totalRevenue = campaigns.reduce((sum, c) => sum + Number(c.revenue_attributed), 0);
    const totalSpent = campaigns.reduce((sum, c) => sum + Number(c.spent), 0);
    
    // Build campaign metrics
    const campaignMetrics: CampaignMetrics[] = campaigns.map(c => {
      const touch = touchAttribution.find(t => t.campaign_id === c.id);
      const spent = Number(c.spent);
      const revenue = Number(c.revenue_attributed);
      
      return {
        campaign_id: c.id,
        campaign_name: c.name,
        utm_campaign: c.utm_campaign,
        status: c.status,
        leads_generated: c.leads_generated,
        first_touch_leads: touch?.first_touch_count ?? 0,
        last_touch_leads: touch?.last_touch_count ?? 0,
        deals_created: c.deals_created,
        revenue_attributed: revenue,
        spent: spent,
        roi: spent > 0 ? Number((((revenue - spent) / spent) * 100).toFixed(2)) : 0,
        cost_per_lead: c.leads_generated > 0 ? Number((spent / c.leads_generated).toFixed(2)) : 0
      };
    });
    
    return {
      total_campaigns: campaigns.length,
      total_leads_attributed: totalLeadsAttributed,
      total_revenue: totalRevenue,
      total_spent: totalSpent,
      overall_roi: totalSpent > 0 ? Number((((totalRevenue - totalSpent) / totalSpent) * 100).toFixed(2)) : 0,
      campaigns: campaignMetrics,
      top_sources: topSources.map(s => ({
        source: s.source,
        lead_count: s.lead_count,
        percentage: totalLeadsAttributed > 0 
          ? Number(((s.lead_count / totalLeadsAttributed) * 100).toFixed(2)) 
          : 0
      }))
    };
  }
  
  // ===========================================================================
  // Routing Effectiveness
  // ===========================================================================
  
  async getRoutingEffectiveness(filters?: DateRangeFilter): Promise<RoutingEffectivenessResponse> {
    // Build date filter
    let dateCondition = '';
    const params: unknown[] = [];
    
    if (filters?.start_date) {
      params.push(filters.start_date);
      dateCondition += ` AND created_at >= $${params.length}`;
    }
    if (filters?.end_date) {
      params.push(filters.end_date);
      dateCondition += ` AND created_at <= $${params.length}`;
    }
    
    // Get routing status counts
    const statusCounts = await db.queryOne<{
      total: number;
      routed: number;
      unrouted: number;
      pending: number;
      manual_review: number;
      avg_score_routed: number;
      avg_time_hours: number;
    }>(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE routing_status = 'routed')::int as routed,
        COUNT(*) FILTER (WHERE routing_status = 'unrouted')::int as unrouted,
        COUNT(*) FILTER (WHERE routing_status = 'pending')::int as pending,
        COUNT(*) FILTER (WHERE routing_status = 'manual_review')::int as manual_review,
        COALESCE(AVG(total_score) FILTER (WHERE routing_status = 'routed'), 0)::numeric(10,2) as avg_score_routed,
        COALESCE(AVG(
          EXTRACT(EPOCH FROM (routed_at - created_at)) / 3600
        ) FILTER (WHERE routed_at IS NOT NULL), 0)::numeric(10,2) as avg_time_hours
      FROM leads
      WHERE 1=1 ${dateCondition}
    `, params);
    
    // Get pipeline distribution
    const pipelineDistribution = await db.query<{
      pipeline_name: string;
      count: number;
    }>(`
      SELECT 
        COALESCE(p.name, 'Unassigned') as pipeline_name,
        COUNT(l.id)::int as count
      FROM leads l
      LEFT JOIN pipelines p ON l.pipeline_id = p.id
      WHERE l.routing_status = 'routed' ${dateCondition}
      GROUP BY p.name
      ORDER BY count DESC
    `, params);
    
    // Get routing by period (last 6 months)
    const routingByPeriod = await db.query<{
      period: string;
      total_routed: number;
      manual_review_count: number;
      avg_time_hours: number;
    }>(`
      SELECT 
        TO_CHAR(routed_at, 'YYYY-MM') as period,
        COUNT(*)::int as total_routed,
        COUNT(*) FILTER (WHERE routing_status = 'manual_review')::int as manual_review_count,
        COALESCE(AVG(
          EXTRACT(EPOCH FROM (routed_at - created_at)) / 3600
        ), 0)::numeric(10,2) as avg_time_hours
      FROM leads
      WHERE routed_at IS NOT NULL 
        AND routed_at > NOW() - INTERVAL '6 months'
        ${dateCondition}
      GROUP BY TO_CHAR(routed_at, 'YYYY-MM')
      ORDER BY period DESC
    `, params);
    
    // Get intent breakdown for routed leads by period
    const intentByPeriod = await db.query<{
      period: string;
      intent: string;
      count: number;
    }>(`
      SELECT 
        TO_CHAR(routed_at, 'YYYY-MM') as period,
        primary_intent as intent,
        COUNT(*)::int as count
      FROM leads
      WHERE routed_at IS NOT NULL 
        AND primary_intent IS NOT NULL
        AND routed_at > NOW() - INTERVAL '6 months'
        ${dateCondition}
      GROUP BY TO_CHAR(routed_at, 'YYYY-MM'), primary_intent
      ORDER BY period DESC, count DESC
    `, params);
    
    // Get pipeline breakdown by period
    const pipelineByPeriod = await db.query<{
      period: string;
      pipeline_name: string;
      count: number;
    }>(`
      SELECT 
        TO_CHAR(l.routed_at, 'YYYY-MM') as period,
        p.name as pipeline_name,
        COUNT(*)::int as count
      FROM leads l
      JOIN pipelines p ON l.pipeline_id = p.id
      WHERE l.routed_at IS NOT NULL 
        AND l.routed_at > NOW() - INTERVAL '6 months'
        ${dateCondition}
      GROUP BY TO_CHAR(l.routed_at, 'YYYY-MM'), p.name
      ORDER BY period DESC, count DESC
    `, params);
    
    const total = statusCounts?.total ?? 0;
    const routedCount = statusCounts?.routed ?? 0;
    const totalPipelineCount = pipelineDistribution.reduce((sum, p) => sum + p.count, 0);
    
    // Build period metrics
    const routingMetrics: RoutingMetrics[] = routingByPeriod.map(p => {
      const periodIntents = intentByPeriod.filter(i => i.period === p.period);
      const periodPipelines = pipelineByPeriod.filter(pp => pp.period === p.period);
      const periodTotal = p.total_routed;
      
      return {
        period: p.period,
        total_routed: p.total_routed,
        by_pipeline: periodPipelines.map(pp => ({
          pipeline_name: pp.pipeline_name,
          count: pp.count,
          percentage: periodTotal > 0 ? Number(((pp.count / periodTotal) * 100).toFixed(2)) : 0
        })),
        by_intent: periodIntents.map(i => ({
          intent: i.intent as IntentType,
          count: i.count,
          percentage: periodTotal > 0 ? Number(((i.count / periodTotal) * 100).toFixed(2)) : 0
        })),
        avg_time_to_route_hours: Number(p.avg_time_hours),
        manual_review_count: p.manual_review_count,
        manual_review_percentage: p.total_routed > 0 
          ? Number(((p.manual_review_count / p.total_routed) * 100).toFixed(2)) 
          : 0
      };
    });
    
    return {
      total_leads: total,
      routed_count: routedCount,
      unrouted_count: statusCounts?.unrouted ?? 0,
      pending_count: statusCounts?.pending ?? 0,
      manual_review_count: statusCounts?.manual_review ?? 0,
      routing_rate: total > 0 ? Number(((routedCount / total) * 100).toFixed(2)) : 0,
      avg_score_at_routing: Number(statusCounts?.avg_score_routed ?? 0),
      avg_time_to_route_hours: Number(statusCounts?.avg_time_hours ?? 0),
      routing_by_period: routingMetrics,
      pipeline_distribution: pipelineDistribution.map(p => ({
        pipeline_name: p.pipeline_name,
        count: p.count,
        percentage: totalPipelineCount > 0 
          ? Number(((p.count / totalPipelineCount) * 100).toFixed(2)) 
          : 0
      }))
    };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let reportServiceInstance: ReportService | null = null;

export function getReportService(): ReportService {
  if (!reportServiceInstance) {
    reportServiceInstance = new ReportService();
  }
  return reportServiceInstance;
}

export const reportService = {
  get instance() {
    return getReportService();
  }
};

export default reportService;
