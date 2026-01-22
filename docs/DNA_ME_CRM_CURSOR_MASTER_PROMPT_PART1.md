# 🧬 DNA ME - CURSOR MASTER PROMPT v2.0
## Complete Custom CRM Platform with Smart Routing & Intent Detection

**Tech Stack:** Node.js (Fastify) + PostgreSQL + Redis (BullMQ) + TypeScript  
**Timeline:** 6-8 weeks MVP

---

# 📋 QUICK SUMMARY

Build a Marketing Automation CRM that:
1. **Ingests events** from 5+ channels (LinkedIn/Waalaxy, Email/Lemlist, Website, Ads, Conferences)
2. **Scores leads** in real-time with decay
3. **Detects product intent** (Research Lab vs B2B Lab vs Co-Creation)
4. **Routes leads** to correct pipeline based on score + intent
5. **Automates** stage movements and notifications
6. **Syncs** with Moco (German finance) and Slack (alerts)

---

# 🚨 CRITICAL: SMART ROUTING ARCHITECTURE

## The Problem

Cold leads from scrapers have **NO product affinity yet**. We cannot assign them to a pipeline immediately.

## The Solution: Global Lead Pool + Intent Detection

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GLOBAL LEAD POOL (Stage 0)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ALL NEW LEADS START HERE:                                                  │
│  Lead { pipeline_id: NULL, routing_status: 'unrouted', intent_signals: [] } │
│                                                                             │
│                              ▼                                              │
│                    Events accumulate                                        │
│                    Score increases                                          │
│                    Intent signals detected                                  │
│                              ▼                                              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     ROUTING DECISION ENGINE                         │   │
│  │                                                                     │   │
│  │  IF lead.total_score >= 40                                         │   │
│  │  AND lead.intent_confidence >= 60%                                 │   │
│  │  THEN:                                                              │   │
│  │    'research'    → Research Lab Pipeline   → Assign BDR            │   │
│  │    'b2b'         → B2B Lab Pipeline        → Assign AE             │   │
│  │    'co_creation' → Co-Creation Pipeline    → Assign Partner Mgr    │   │
│  │    'unknown'     → Manual Review           → Notify Marketing Mgr  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 1. SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DNA MARKETING ENGINE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INBOUND SOURCES           CORE ENGINE                    OUTBOUND         │
│                                                                             │
│  ┌──────────────┐         ┌─────────────────────────────┐                  │
│  │   Waalaxy    │──┐      │     API Gateway (Fastify)   │                  │
│  │   Portal     │  │      │  POST /events/ingest        │                  │
│  │   Lemlist    │──┼─────▶│  POST /leads/bulk           │                  │
│  │   Ads        │  │      │  GET  /leads, /deals, etc.  │                  │
│  │  Conferences │──┘      └──────────────┬──────────────┘                  │
│                                          │                                  │
│                           ┌──────────────▼──────────────┐                  │
│                           │      BullMQ Queues          │                  │
│                           │  [Events][Scoring][Routing] │                  │
│                           │  [Automation][Sync]         │                  │
│                           └──────────────┬──────────────┘                  │
│                                          │                    ┌──────────┐ │
│                           ┌──────────────▼──────────────┐     │  Moco    │ │
│                           │    Worker Processes         │────▶│  Slack   │ │
│                           │  • Event Processor          │     └──────────┘ │
│                           │  • Scoring Engine           │                  │
│                           │  • Intent Detector          │                  │
│                           │  • Pipeline Router          │                  │
│                           │  • Automation Engine        │                  │
│                           └──────────────┬──────────────┘                  │
│                                          │                                  │
│                           ┌──────────────▼──────────────┐                  │
│                           │    PostgreSQL Database      │                  │
│                           │  leads│events│pipelines     │                  │
│                           │  deals│scores│intent_signals│                  │
│                           └─────────────────────────────┘                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 2. DATABASE SCHEMA

```sql
-- ============================================================================
-- COMPLETE SCHEMA FOR DNA MARKETING ENGINE
-- PostgreSQL 15+
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ORGANIZATIONS
CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    domain          VARCHAR(255),
    industry        VARCHAR(100),
    company_size    VARCHAR(50),
    country         VARCHAR(2),
    portal_id       VARCHAR(100) UNIQUE,
    moco_id         VARCHAR(50),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- PIPELINES
CREATE TABLE pipelines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(100) NOT NULL UNIQUE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    is_default      BOOLEAN DEFAULT FALSE,
    sales_cycle_days INTEGER,
    target_persona  VARCHAR(255),
    config          JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- PIPELINE STAGES
CREATE TABLE pipeline_stages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id     UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    slug            VARCHAR(100) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    position        INTEGER NOT NULL,
    stage_type      VARCHAR(50),
    automation_config JSONB DEFAULT '[]',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pipeline_id, slug),
    UNIQUE(pipeline_id, position)
);

-- LEADS (with Smart Routing fields)
CREATE TABLE leads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identity
    email           VARCHAR(255) NOT NULL UNIQUE,
    first_name      VARCHAR(100),
    last_name       VARCHAR(100),
    phone           VARCHAR(50),
    job_title       VARCHAR(150),
    organization_id UUID REFERENCES organizations(id),
    
    -- Status
    status          VARCHAR(50) DEFAULT 'new',
    lifecycle_stage VARCHAR(50) DEFAULT 'lead',
    
    -- SCORING
    demographic_score   INTEGER DEFAULT 0,
    engagement_score    INTEGER DEFAULT 0,
    behavior_score      INTEGER DEFAULT 0,
    total_score         INTEGER GENERATED ALWAYS AS 
                        (demographic_score + engagement_score + behavior_score) STORED,
    
    -- SMART ROUTING (CRITICAL!)
    pipeline_id         UUID REFERENCES pipelines(id),  -- NULL = Global Pool
    routing_status      VARCHAR(50) DEFAULT 'unrouted',
    routed_at           TIMESTAMPTZ,
    primary_intent      VARCHAR(50),    -- 'research', 'b2b', 'co_creation'
    intent_confidence   INTEGER DEFAULT 0,  -- 0-100
    intent_summary      JSONB DEFAULT '{"research":0,"b2b":0,"co_creation":0}',
    
    -- Attribution
    first_touch_source      VARCHAR(100),
    first_touch_campaign    VARCHAR(100),
    first_touch_date        TIMESTAMPTZ,
    last_touch_source       VARCHAR(100),
    last_touch_campaign     VARCHAR(100),
    last_touch_date         TIMESTAMPTZ,
    
    -- External IDs
    portal_id           VARCHAR(100) UNIQUE,
    waalaxy_id          VARCHAR(100),
    linkedin_url        VARCHAR(255),
    lemlist_id          VARCHAR(100),
    
    -- GDPR
    consent_date            TIMESTAMPTZ,
    consent_source          VARCHAR(100),
    gdpr_delete_requested   TIMESTAMPTZ,
    
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    last_activity       TIMESTAMPTZ
);

-- INTENT SIGNALS (Key for Smart Routing!)
CREATE TABLE intent_signals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    intent          VARCHAR(50) NOT NULL,
    rule_id         VARCHAR(100) NOT NULL,
    confidence_points INTEGER NOT NULL,
    trigger_type    VARCHAR(50) NOT NULL,
    event_id        UUID,
    trigger_data    JSONB,
    detected_at     TIMESTAMPTZ DEFAULT NOW()
);

-- DEALS
CREATE TABLE deals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID NOT NULL REFERENCES leads(id),
    pipeline_id     UUID NOT NULL REFERENCES pipelines(id),
    stage_id        UUID NOT NULL REFERENCES pipeline_stages(id),
    name            VARCHAR(255),
    value           DECIMAL(12,2),
    currency        VARCHAR(3) DEFAULT 'EUR',
    expected_close_date DATE,
    stage_entered_at    TIMESTAMPTZ DEFAULT NOW(),
    assigned_to         VARCHAR(255),
    assigned_region     VARCHAR(50),
    assigned_at         TIMESTAMPTZ,
    status          VARCHAR(50) DEFAULT 'open',
    close_reason    TEXT,
    closed_at       TIMESTAMPTZ,
    moco_offer_id   VARCHAR(50),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(lead_id, pipeline_id)
);

-- EVENTS (Partitioned)
CREATE TABLE events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID REFERENCES leads(id),
    event_type      VARCHAR(100) NOT NULL,
    event_category  VARCHAR(50),
    source          VARCHAR(100) NOT NULL,
    occurred_at     TIMESTAMPTZ NOT NULL,
    metadata        JSONB DEFAULT '{}',
    campaign_id     VARCHAR(100),
    utm_source      VARCHAR(100),
    utm_medium      VARCHAR(100),
    utm_campaign    VARCHAR(100),
    correlation_id  UUID,
    score_points    INTEGER DEFAULT 0,
    score_category  VARCHAR(50),
    processed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (occurred_at);

-- Create monthly partitions
CREATE TABLE events_2026_01 PARTITION OF events FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE events_2026_02 PARTITION OF events FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE events_2026_03 PARTITION OF events FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- SCORING RULES
CREATE TABLE scoring_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(100) NOT NULL UNIQUE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    priority        INTEGER DEFAULT 100,
    rule_type       VARCHAR(50) NOT NULL,
    category        VARCHAR(50) NOT NULL,
    conditions      JSONB NOT NULL,
    points          INTEGER NOT NULL,
    max_per_day     INTEGER,
    max_per_lead    INTEGER,
    decay_days      INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- SCORE HISTORY
CREATE TABLE score_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    event_id        UUID REFERENCES events(id),
    rule_id         UUID REFERENCES scoring_rules(id),
    category        VARCHAR(50) NOT NULL,
    points_change   INTEGER NOT NULL,
    new_total       INTEGER NOT NULL,
    expires_at      TIMESTAMPTZ,
    expired         BOOLEAN DEFAULT FALSE,
    expired_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- AUTOMATION RULES
CREATE TABLE automation_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    priority        INTEGER DEFAULT 100,
    pipeline_id     UUID REFERENCES pipelines(id),
    stage_id        UUID REFERENCES pipeline_stages(id),
    trigger_type    VARCHAR(50) NOT NULL,
    trigger_config  JSONB NOT NULL,
    action_type     VARCHAR(50) NOT NULL,
    action_config   JSONB NOT NULL,
    last_executed   TIMESTAMPTZ,
    execution_count INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- TASKS
CREATE TABLE tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID REFERENCES leads(id),
    deal_id         UUID REFERENCES deals(id),
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    task_type       VARCHAR(50),
    assigned_to     VARCHAR(255),
    due_date        TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    status          VARCHAR(50) DEFAULT 'open',
    automation_rule_id UUID REFERENCES automation_rules(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- TEAM MEMBERS
CREATE TABLE team_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    name            VARCHAR(255) NOT NULL,
    role            VARCHAR(50) NOT NULL,
    region          VARCHAR(50),
    is_active       BOOLEAN DEFAULT TRUE,
    max_leads       INTEGER DEFAULT 50,
    current_leads   INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- CAMPAIGNS
CREATE TABLE campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    campaign_type   VARCHAR(50),
    status          VARCHAR(50) DEFAULT 'draft',
    budget          DECIMAL(10,2),
    spent           DECIMAL(10,2) DEFAULT 0,
    currency        VARCHAR(3) DEFAULT 'EUR',
    utm_source      VARCHAR(100),
    utm_medium      VARCHAR(100),
    utm_campaign    VARCHAR(100) UNIQUE,
    start_date      DATE,
    end_date        DATE,
    leads_generated INTEGER DEFAULT 0,
    deals_created   INTEGER DEFAULT 0,
    revenue_attributed DECIMAL(12,2) DEFAULT 0,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_leads_total_score ON leads(total_score DESC);
CREATE INDEX idx_leads_routing_status ON leads(routing_status) WHERE routing_status = 'unrouted';
CREATE INDEX idx_leads_pipeline ON leads(pipeline_id);
CREATE INDEX idx_leads_intent ON leads(primary_intent, intent_confidence DESC);
CREATE INDEX idx_intent_signals_lead ON intent_signals(lead_id, detected_at DESC);
CREATE INDEX idx_events_lead_occurred ON events(lead_id, occurred_at DESC);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_deals_pipeline_stage ON deals(pipeline_id, stage_id);
CREATE INDEX idx_score_history_lead ON score_history(lead_id, created_at DESC);
CREATE INDEX idx_score_history_expiring ON score_history(expires_at) WHERE expired = FALSE;

-- HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION recalculate_lead_scores(p_lead_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE leads SET
        demographic_score = COALESCE((
            SELECT SUM(points_change) FROM score_history 
            WHERE lead_id = p_lead_id AND category = 'demographic' AND expired = FALSE
        ), 0),
        engagement_score = COALESCE((
            SELECT SUM(points_change) FROM score_history 
            WHERE lead_id = p_lead_id AND category = 'engagement' AND expired = FALSE
        ), 0),
        behavior_score = COALESCE((
            SELECT SUM(points_change) FROM score_history 
            WHERE lead_id = p_lead_id AND category = 'behavior' AND expired = FALSE
        ), 0),
        updated_at = NOW()
    WHERE id = p_lead_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION expire_old_scores()
RETURNS TABLE(expired_count INTEGER, leads_updated INTEGER) AS $$
DECLARE
    v_expired_count INTEGER;
    v_leads_count INTEGER;
BEGIN
    WITH expired AS (
        UPDATE score_history 
        SET expired = TRUE, expired_at = NOW()
        WHERE expires_at < NOW() AND expired = FALSE
        RETURNING lead_id
    )
    SELECT COUNT(*), COUNT(DISTINCT lead_id) INTO v_expired_count, v_leads_count FROM expired;
    
    PERFORM recalculate_lead_scores(DISTINCT lead_id)
    FROM score_history WHERE expired_at > NOW() - INTERVAL '1 minute';
    
    RETURN QUERY SELECT v_expired_count, v_leads_count;
END;
$$ LANGUAGE plpgsql;

-- SEED DATA: Pipelines
INSERT INTO pipelines (id, slug, name, description, is_active, is_default) VALUES
('00000000-0000-0000-0000-000000000000', 'discovery', 'Discovery Pipeline', 'For leads with unclear intent', TRUE, TRUE);

INSERT INTO pipelines (id, slug, name, description, sales_cycle_days, target_persona) VALUES
('11111111-1111-1111-1111-111111111111', 'research-lab', 'Research Lab', 'Academic researchers', 14, 'PhD/Professor'),
('22222222-2222-2222-2222-222222222222', 'b2b-lab-enablement', 'B2B Lab Enablement', 'Enterprise labs', 60, 'Lab Director'),
('33333333-3333-3333-3333-333333333333', 'panel-co-creation', 'Panel Co-Creation', 'Partnerships', 120, 'VP R&D');

-- Seed stages for each pipeline
INSERT INTO pipeline_stages (pipeline_id, slug, name, position, stage_type) VALUES
-- Discovery
('00000000-0000-0000-0000-000000000000', 'new', 'New Lead', 1, 'awareness'),
('00000000-0000-0000-0000-000000000000', 'qualifying', 'Qualifying', 2, 'interest'),
('00000000-0000-0000-0000-000000000000', 'routed', 'Routed', 3, 'decision'),
-- Research Lab
('11111111-1111-1111-1111-111111111111', 'awareness', 'Initial Contact', 1, 'awareness'),
('11111111-1111-1111-1111-111111111111', 'interest', 'Information Phase', 2, 'interest'),
('11111111-1111-1111-1111-111111111111', 'consultation', 'Consultation', 3, 'consideration'),
('11111111-1111-1111-1111-111111111111', 'pilot', 'Pilot Project', 4, 'evaluation'),
('11111111-1111-1111-1111-111111111111', 'proposal', 'Proposal', 5, 'decision'),
('11111111-1111-1111-1111-111111111111', 'closed_won', 'Customer', 6, 'closed_won'),
('11111111-1111-1111-1111-111111111111', 'closed_lost', 'Lost', 7, 'closed_lost'),
-- B2B Lab
('22222222-2222-2222-2222-222222222222', 'awareness', 'Initial Contact', 1, 'awareness'),
('22222222-2222-2222-2222-222222222222', 'tech-discovery', 'Technical Discovery', 2, 'interest'),
('22222222-2222-2222-2222-222222222222', 'deep-analysis', 'Deep Analysis', 3, 'consideration'),
('22222222-2222-2222-2222-222222222222', 'poc', 'Proof of Concept', 4, 'evaluation'),
('22222222-2222-2222-2222-222222222222', 'business-case', 'Business Case', 5, 'decision'),
('22222222-2222-2222-2222-222222222222', 'closed_won', 'Contract Signed', 6, 'closed_won'),
('22222222-2222-2222-2222-222222222222', 'closed_lost', 'Lost', 7, 'closed_lost'),
-- Co-Creation
('33333333-3333-3333-3333-333333333333', 'awareness', 'Initial Contact', 1, 'awareness'),
('33333333-3333-3333-3333-333333333333', 'exploration', 'Exploration', 2, 'interest'),
('33333333-3333-3333-3333-333333333333', 'workshop', 'Requirements Workshop', 3, 'consideration'),
('33333333-3333-3333-3333-333333333333', 'development', 'Panel Development', 4, 'evaluation'),
('33333333-3333-3333-3333-333333333333', 'finalization', 'Finalization', 5, 'decision'),
('33333333-3333-3333-3333-333333333333', 'closed_won', 'Partnership Signed', 6, 'closed_won'),
('33333333-3333-3333-3333-333333333333', 'closed_lost', 'Lost', 7, 'closed_lost');
```

---

# 3. INTENT DETECTION RULES

```typescript
// src/config/intentRules.ts

export interface IntentRule {
  id: string;
  intent: 'research' | 'b2b' | 'co_creation';
  trigger: {
    event_type?: string;
    metadata?: Record<string, any>;
    lead_field?: string;
    organization_field?: string;
    pattern?: string;
    contains?: string[];
    in?: string[];
    lt?: number;
    gte?: number;
  };
  confidence_points: number;
  description: string;
}

export const INTENT_RULES: IntentRule[] = [
  // ═══════════════════════════════════════════════════════════════════
  // RESEARCH LAB INTENT (+120 pts total possible)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'research-16s-pricing',
    intent: 'research',
    trigger: { event_type: 'page_visited', metadata: { page_path: '/pricing/16s' } },
    confidence_points: 25,
    description: 'Viewed 16S microbiome pricing'
  },
  {
    id: 'research-academic-email',
    intent: 'research',
    trigger: { lead_field: 'email', pattern: '\\.(edu|ac\\.|uni-|university)' },
    confidence_points: 30,
    description: 'Academic email domain'
  },
  {
    id: 'research-job-title',
    intent: 'research',
    trigger: { lead_field: 'job_title', contains: ['PhD', 'PostDoc', 'Researcher', 'Professor', 'PI'] },
    confidence_points: 20,
    description: 'Academic job title'
  },
  {
    id: 'research-sample-report',
    intent: 'research',
    trigger: { event_type: 'sample_report_downloaded' },
    confidence_points: 20,
    description: 'Downloaded sample report'
  },
  {
    id: 'research-small-volume',
    intent: 'research',
    trigger: { event_type: 'roi_calculator_submitted', metadata: { samples_per_month: { lt: 100 } } },
    confidence_points: 25,
    description: 'ROI calc < 100 samples/month'
  },

  // ═══════════════════════════════════════════════════════════════════
  // B2B LAB INTENT (+155 pts total possible)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'b2b-roi-calculator',
    intent: 'b2b',
    trigger: { event_type: 'roi_calculator_submitted' },
    confidence_points: 20,
    description: 'Used ROI calculator'
  },
  {
    id: 'b2b-enterprise-page',
    intent: 'b2b',
    trigger: { event_type: 'page_visited', metadata: { page_path: '/enterprise' } },
    confidence_points: 30,
    description: 'Viewed enterprise page'
  },
  {
    id: 'b2b-high-volume',
    intent: 'b2b',
    trigger: { event_type: 'roi_calculator_submitted', metadata: { samples_per_month: { gte: 100 } } },
    confidence_points: 35,
    description: 'ROI calc >= 100 samples/month'
  },
  {
    id: 'b2b-company-size',
    intent: 'b2b',
    trigger: { organization_field: 'company_size', in: ['51-200', '201-500', '501-1000', '1000+'] },
    confidence_points: 25,
    description: 'Medium/large company'
  },
  {
    id: 'b2b-job-title',
    intent: 'b2b',
    trigger: { lead_field: 'job_title', contains: ['Director', 'VP', 'Head of', 'Manager', 'Operations'] },
    confidence_points: 20,
    description: 'Business/operations title'
  },
  {
    id: 'b2b-api-docs',
    intent: 'b2b',
    trigger: { event_type: 'page_visited', metadata: { page_path: '/api-docs' } },
    confidence_points: 25,
    description: 'Viewed API documentation'
  },

  // ═══════════════════════════════════════════════════════════════════
  // CO-CREATION INTENT (+180 pts total possible)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'cocreation-partnership-page',
    intent: 'co_creation',
    trigger: { event_type: 'page_visited', metadata: { page_path: '/partnerships' } },
    confidence_points: 40,
    description: 'Viewed partnerships page'
  },
  {
    id: 'cocreation-custom-panel',
    intent: 'co_creation',
    trigger: { event_type: 'contact_form_submitted', metadata: { inquiry_type: 'custom_panel' } },
    confidence_points: 50,
    description: 'Custom panel inquiry'
  },
  {
    id: 'cocreation-whitelabel',
    intent: 'co_creation',
    trigger: { event_type: 'page_visited', metadata: { page_path: '/white-label' } },
    confidence_points: 45,
    description: 'Viewed white-label page'
  },
  {
    id: 'cocreation-pharma',
    intent: 'co_creation',
    trigger: { organization_field: 'industry', in: ['Pharmaceutical', 'Biotechnology R&D'] },
    confidence_points: 20,
    description: 'Pharma/Biotech R&D company'
  },
  {
    id: 'cocreation-exec-title',
    intent: 'co_creation',
    trigger: { lead_field: 'job_title', contains: ['VP', 'CSO', 'CTO', 'Chief', 'Founder', 'CEO'] },
    confidence_points: 25,
    description: 'Executive/C-level title'
  }
];
```

---

# 4. ROUTING CONFIGURATION

```typescript
// src/config/routingConfig.ts

export const ROUTING_CONFIG = {
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
    research: { role: 'bdr', strategy: 'round_robin', region_aware: true },
    b2b: { role: 'ae', strategy: 'capacity_based', value_tier_aware: true },
    co_creation: { role: 'partnership_manager', strategy: 'manual' },
    discovery: { role: 'marketing_manager', strategy: 'notify_only' }
  }
};
```

---

# 5. INTENT CONFIDENCE ALGORITHM

```typescript
// src/services/intentDetector.ts

interface IntentSignal {
  intent: 'research' | 'b2b' | 'co_creation';
  rule_id: string;
  confidence_points: number;
}

interface IntentSummary {
  research: number;
  b2b: number;
  co_creation: number;
}

export function calculateIntentConfidence(signals: IntentSignal[]): {
  primary_intent: string | null;
  intent_confidence: number;
  intent_summary: IntentSummary;
  is_routable: boolean;
  conflict_detected: boolean;
} {
  // 1. Aggregate points by intent
  const summary: IntentSummary = { research: 0, b2b: 0, co_creation: 0 };
  
  for (const signal of signals) {
    summary[signal.intent] += signal.confidence_points;
  }
  
  // 2. Find primary and secondary intents
  const sorted = Object.entries(summary).sort(([, a], [, b]) => b - a);
  const [primaryIntent, primaryScore] = sorted[0];
  const [, secondaryScore] = sorted[1] || [null, 0];
  
  // 3. Calculate total points
  const totalPoints = Object.values(summary).reduce((a, b) => a + b, 0);
  
  // 4. Calculate confidence (0-100)
  let confidence = 0;
  if (totalPoints > 0) {
    // Dominance of primary intent
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
  
  // 5. Detect conflict
  const conflict_detected = 
    secondaryScore > 0 && 
    (primaryScore - secondaryScore) < ROUTING_CONFIG.intent_confidence_margin;
  
  // 6. Determine if routable
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
```

---

# 6. PIPELINE ROUTER SERVICE

```typescript
// src/services/pipelineRouter.ts

export class PipelineRouter {
  
  async evaluateAndRoute(lead: Lead): Promise<RoutingResult> {
    // 1. Skip if already routed
    if (lead.pipeline_id !== null) {
      return { action: 'skip', reason: 'already_routed' };
    }
    
    // 2. Check minimum score
    if (lead.total_score < ROUTING_CONFIG.min_score_threshold) {
      return { 
        action: 'skip', 
        reason: 'score_below_threshold',
        details: `Score ${lead.total_score} < ${ROUTING_CONFIG.min_score_threshold}`
      };
    }
    
    // 3. Get intent signals
    const signals = await db.query(`
      SELECT * FROM intent_signals WHERE lead_id = $1
    `, [lead.id]);
    
    // 4. Calculate intent confidence
    const intent = calculateIntentConfidence(signals);
    
    // 5. Update lead's intent fields
    await db.query(`
      UPDATE leads SET 
        primary_intent = $2,
        intent_confidence = $3,
        intent_summary = $4
      WHERE id = $1
    `, [lead.id, intent.primary_intent, intent.intent_confidence, JSON.stringify(intent.intent_summary)]);
    
    // 6. Route if confident enough
    if (intent.is_routable && intent.primary_intent) {
      return await this.routeLeadToPipeline(lead, intent.primary_intent as IntentType);
    }
    
    // 7. Handle conflicts
    if (intent.conflict_detected) {
      await this.sendSlackNotification({
        channel: '#lead-routing',
        text: `⚠️ Intent Conflict: ${lead.email}\n` +
              `Research: ${intent.intent_summary.research} | ` +
              `B2B: ${intent.intent_summary.b2b} | ` +
              `Co-Creation: ${intent.intent_summary.co_creation}\n` +
              `Please review and manually route.`
      });
      return { action: 'manual_review', reason: 'intent_conflict' };
    }
    
    // 8. Check if stuck too long
    const daysInPool = this.daysSinceCreation(lead.created_at);
    if (daysInPool > ROUTING_CONFIG.max_unrouted_days) {
      await this.handleStuckLead(lead, intent);
      return { action: 'manual_review', reason: 'stuck_in_pool', days_in_pool: daysInPool };
    }
    
    // 9. Not ready yet
    return { action: 'wait', reason: 'insufficient_confidence' };
  }
  
  private async routeLeadToPipeline(lead: Lead, intent: IntentType): Promise<RoutingResult> {
    const pipelineSlug = ROUTING_CONFIG.intent_to_pipeline[intent];
    const pipeline = await db.queryOne(`SELECT * FROM pipelines WHERE slug = $1`, [pipelineSlug]);
    const firstStage = await db.queryOne(`
      SELECT * FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY position LIMIT 1
    `, [pipeline.id]);
    
    // Create deal
    const deal = await db.queryOne(`
      INSERT INTO deals (lead_id, pipeline_id, stage_id, name, status)
      VALUES ($1, $2, $3, $4, 'open')
      RETURNING *
    `, [lead.id, pipeline.id, firstStage.id, `${lead.first_name} ${lead.last_name} - ${pipeline.name}`]);
    
    // Update lead
    await db.query(`
      UPDATE leads SET pipeline_id = $2, routing_status = 'routed', routed_at = NOW()
      WHERE id = $1
    `, [lead.id, pipeline.id]);
    
    // Assign owner
    const ownerConfig = ROUTING_CONFIG.owner_assignment[intent];
    const owner = await this.assignOwner(deal.id, ownerConfig);
    
    // Send notification
    await this.sendSlackNotification({
      channel: '#hot-leads',
      text: `🎯 Lead Routed!\n` +
            `${lead.first_name} ${lead.last_name} (${lead.email})\n` +
            `→ ${pipeline.name}\n` +
            `Intent: ${intent} (${lead.intent_confidence}% confidence)\n` +
            `Score: ${lead.total_score}\n` +
            `Assigned: ${owner?.email || 'Unassigned'}`
    });
    
    return {
      action: 'routed',
      pipeline_id: pipeline.id,
      pipeline_name: pipeline.name,
      deal_id: deal.id,
      assigned_to: owner?.email
    };
  }
}
```

---

# 7. SCORING ENGINE

```typescript
// src/services/scoringEngine.ts

export class ScoringEngine {
  private rules: ScoringRule[] = [];
  
  async loadRules(): Promise<void> {
    this.rules = await db.query(`
      SELECT * FROM scoring_rules WHERE is_active = TRUE ORDER BY priority
    `);
  }
  
  async processEvent(event: MarketingEvent, lead: Lead): Promise<{
    rules_matched: string[];
    points_added: number;
    new_scores: { demographic: number; engagement: number; behavior: number; total: number };
  }> {
    const results = {
      rules_matched: [] as string[],
      points_added: 0,
      new_scores: { demographic: 0, engagement: 0, behavior: 0, total: 0 }
    };
    
    // Find and apply matching rules
    for (const rule of this.rules) {
      if (this.matchesConditions(rule, event, lead)) {
        if (await this.canApplyRule(rule, lead.id)) {
          await this.applyScore(rule, lead.id, event.id);
          results.rules_matched.push(rule.slug);
          results.points_added += rule.points;
        }
      }
    }
    
    // Recalculate scores
    await db.query(`SELECT recalculate_lead_scores($1)`, [lead.id]);
    
    // Get updated scores
    const updated = await db.queryOne(`
      SELECT demographic_score, engagement_score, behavior_score, total_score
      FROM leads WHERE id = $1
    `, [lead.id]);
    
    results.new_scores = {
      demographic: updated.demographic_score,
      engagement: updated.engagement_score,
      behavior: updated.behavior_score,
      total: updated.total_score
    };
    
    // Check for hot lead alerts
    if (lead.total_score < 80 && results.new_scores.total >= 80) {
      await this.sendHotLeadAlert(lead.id, results.new_scores.total);
    }
    
    return results;
  }
  
  private matchesConditions(rule: ScoringRule, event: MarketingEvent, lead: Lead): boolean {
    const conditions = rule.conditions;
    
    if ('event_type' in conditions) {
      if (event.event_type !== conditions.event_type) return false;
      if (conditions.metadata) {
        for (const [key, value] of Object.entries(conditions.metadata)) {
          if (event.metadata?.[key] !== value) return false;
        }
      }
      return true;
    }
    
    if ('field' in conditions) {
      const value = this.getNestedValue(lead, conditions.field);
      switch (conditions.operator) {
        case 'equals': return value === conditions.value;
        case 'in': return conditions.value.includes(value);
        case 'contains': return conditions.value.some((v: string) => value?.toLowerCase().includes(v.toLowerCase()));
        case 'gte': return value >= conditions.value;
        case 'lte': return value <= conditions.value;
      }
    }
    
    return false;
  }
  
  private async canApplyRule(rule: ScoringRule, leadId: string): Promise<boolean> {
    if (rule.max_per_day) {
      const count = await db.queryOne<{ count: number }>(`
        SELECT COUNT(*) as count FROM score_history 
        WHERE lead_id = $1 AND rule_id = $2 AND created_at > NOW() - INTERVAL '1 day'
      `, [leadId, rule.id]);
      if (count.count >= rule.max_per_day) return false;
    }
    return true;
  }
  
  private async applyScore(rule: ScoringRule, leadId: string, eventId: string): Promise<void> {
    const expiresAt = rule.decay_days 
      ? new Date(Date.now() + rule.decay_days * 24 * 60 * 60 * 1000)
      : null;
    
    const current = await db.queryOne<{ total: number }>(`
      SELECT COALESCE(SUM(points_change), 0) as total FROM score_history 
      WHERE lead_id = $1 AND category = $2 AND expired = FALSE
    `, [leadId, rule.category]);
    
    await db.query(`
      INSERT INTO score_history (lead_id, event_id, rule_id, category, points_change, new_total, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [leadId, eventId, rule.id, rule.category, rule.points, current.total + rule.points, expiresAt]);
  }
}
```

---

# 8. API ENDPOINTS

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API ENDPOINTS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  WEBHOOKS                                                                   │
│  POST   /api/v1/events/ingest           Receive marketing events            │
│  POST   /api/v1/leads/bulk              Bulk import (conferences)           │
│                                                                             │
│  LEADS                                                                      │
│  GET    /api/v1/leads                   List/search leads                   │
│  GET    /api/v1/leads/unrouted          Get Global Pool leads               │
│  GET    /api/v1/leads/:id               Get single lead                     │
│  POST   /api/v1/leads                   Create lead                         │
│  PATCH  /api/v1/leads/:id               Update lead                         │
│  DELETE /api/v1/leads/:id               Delete lead (GDPR)                  │
│  GET    /api/v1/leads/:id/events        Get lead events                     │
│  GET    /api/v1/leads/:id/intents       Get intent signals                  │
│  POST   /api/v1/leads/:id/route         Manually route lead                 │
│                                                                             │
│  PIPELINES                                                                  │
│  GET    /api/v1/pipelines               List pipelines                      │
│  GET    /api/v1/pipelines/:id           Get pipeline with stages            │
│  GET    /api/v1/pipelines/:id/deals     Get deals in pipeline               │
│                                                                             │
│  DEALS                                                                      │
│  GET    /api/v1/deals                   List deals                          │
│  GET    /api/v1/deals/:id               Get deal                            │
│  POST   /api/v1/deals                   Create deal                         │
│  PATCH  /api/v1/deals/:id               Update deal                         │
│  POST   /api/v1/deals/:id/move          Move to stage                       │
│  POST   /api/v1/deals/:id/close         Close deal                          │
│                                                                             │
│  SCORING & ROUTING                                                          │
│  GET    /api/v1/scoring/rules           List scoring rules                  │
│  POST   /api/v1/scoring/rules           Create rule                         │
│  GET    /api/v1/routing/config          Get routing config                  │
│  POST   /api/v1/routing/evaluate/:id    Trigger routing evaluation          │
│                                                                             │
│  AUTOMATION & TASKS                                                         │
│  GET    /api/v1/automation/rules        List automation rules               │
│  GET    /api/v1/tasks                   List tasks                          │
│  POST   /api/v1/tasks/:id/complete      Complete task                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 9. PROJECT STRUCTURE

```
dna-marketing-engine/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── events.ts
│   │   │   ├── leads.ts
│   │   │   ├── pipelines.ts
│   │   │   ├── deals.ts
│   │   │   ├── scoring.ts
│   │   │   ├── routing.ts
│   │   │   ├── automation.ts
│   │   │   └── tasks.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── hmac.ts
│   │   │   └── rateLimit.ts
│   │   └── server.ts
│   │
│   ├── services/
│   │   ├── scoringEngine.ts
│   │   ├── intentDetector.ts
│   │   ├── pipelineRouter.ts
│   │   ├── automationEngine.ts
│   │   ├── mocoService.ts
│   │   └── slackService.ts
│   │
│   ├── workers/
│   │   ├── eventWorker.ts
│   │   ├── scoringWorker.ts
│   │   ├── routingWorker.ts
│   │   ├── automationWorker.ts
│   │   └── syncWorker.ts
│   │
│   ├── config/
│   │   ├── scoringRules.ts
│   │   ├── intentRules.ts
│   │   └── routingConfig.ts
│   │
│   ├── db/
│   │   ├── index.ts
│   │   └── schema.sql
│   │
│   └── types/
│       └── index.ts
│
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

---

# 10. IMPLEMENTATION ORDER

```
PHASE 1 (Week 1-2): Foundation
├─ Project setup + Docker (PostgreSQL, Redis)
├─ Schema + migrations
├─ Basic leads CRUD
├─ Webhook receiver (POST /events/ingest)
└─ HMAC validation

PHASE 2 (Week 3): Scoring Engine
├─ Scoring rules config
├─ Score calculation
├─ Score history + decay
└─ Daily decay job

PHASE 3 (Week 4): Smart Routing ⭐
├─ Intent detection rules
├─ Intent signal storage
├─ Confidence calculation
├─ Pipeline router
├─ Owner assignment
└─ Conflict handling

PHASE 4 (Week 5): Automation
├─ Automation rules
├─ Action executors
└─ Task management

PHASE 5 (Week 6): Integrations
├─ Slack notifications
├─ Moco sync
└─ Daily digest

PHASE 6 (Week 7-8): Polish
├─ Reports API
├─ GDPR endpoints
├─ Error handling
└─ Documentation
```

---

# 📋 QUICK REFERENCE

## Scoring Thresholds
- **0-39**: Cold (Nurture)
- **40-79**: Warm/MQL (Route to pipeline if intent known)
- **80-119**: Hot/SQL (Slack alert)
- **120+**: Very Hot (Immediate contact)
- **Order placed**: Auto-customer

## Intent Detection
- **Research**: Academic email, PhD title, small volume, 16S pricing page
- **B2B**: ROI calculator, enterprise page, high volume, Director title
- **Co-Creation**: Partnership page, custom panel inquiry, VP/C-level title

## Routing Rules
- Score >= 40 AND Intent confidence >= 60% → Route to pipeline
- Conflict detected → Manual review (Slack notification)
- Stuck > 14 days → Force manual review

---

**END OF MASTER PROMPT**

*Start with: "Implement Phase 1 according to this specification"*
