-- =============================================================================
-- DNA Marketing Engine - Initial Schema Migration
-- PostgreSQL 15+
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ORGANIZATIONS
-- =============================================================================
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

-- =============================================================================
-- PIPELINES
-- =============================================================================
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

-- =============================================================================
-- PIPELINE STAGES
-- =============================================================================
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

-- =============================================================================
-- LEADS (with Smart Routing fields)
-- =============================================================================
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
    pipeline_id         UUID REFERENCES pipelines(id),
    routing_status      VARCHAR(50) DEFAULT 'unrouted',
    routed_at           TIMESTAMPTZ,
    primary_intent      VARCHAR(50),
    intent_confidence   INTEGER DEFAULT 0,
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

-- =============================================================================
-- INTENT SIGNALS (Key for Smart Routing!)
-- =============================================================================
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

-- =============================================================================
-- DEALS
-- =============================================================================
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

-- =============================================================================
-- EVENTS (Partitioned by month)
-- =============================================================================
CREATE TABLE events (
    id              UUID DEFAULT gen_random_uuid(),
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
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- Create monthly partitions for 2026
CREATE TABLE events_2026_01 PARTITION OF events FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE events_2026_02 PARTITION OF events FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE events_2026_03 PARTITION OF events FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE events_2026_04 PARTITION OF events FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE events_2026_05 PARTITION OF events FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE events_2026_06 PARTITION OF events FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE events_2026_07 PARTITION OF events FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE events_2026_08 PARTITION OF events FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE events_2026_09 PARTITION OF events FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE events_2026_10 PARTITION OF events FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE events_2026_11 PARTITION OF events FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE events_2026_12 PARTITION OF events FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- =============================================================================
-- SCORING RULES
-- =============================================================================
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

-- =============================================================================
-- SCORE HISTORY
-- =============================================================================
CREATE TABLE score_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    event_id        UUID,
    rule_id         UUID REFERENCES scoring_rules(id),
    category        VARCHAR(50) NOT NULL,
    points_change   INTEGER NOT NULL,
    new_total       INTEGER NOT NULL,
    expires_at      TIMESTAMPTZ,
    expired         BOOLEAN DEFAULT FALSE,
    expired_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- AUTOMATION RULES
-- =============================================================================
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

-- =============================================================================
-- AUTOMATION LOGS (for tracking rule executions)
-- =============================================================================
CREATE TABLE automation_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id         UUID REFERENCES automation_rules(id),
    lead_id         UUID REFERENCES leads(id),
    deal_id         UUID REFERENCES deals(id),
    trigger_data    JSONB,
    action_result   JSONB,
    success         BOOLEAN DEFAULT TRUE,
    error_message   TEXT,
    executed_at     TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TASKS
-- =============================================================================
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

-- =============================================================================
-- TEAM MEMBERS
-- =============================================================================
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

-- =============================================================================
-- CAMPAIGNS
-- =============================================================================
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

-- =============================================================================
-- API KEYS (for webhook authentication)
-- =============================================================================
CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source          VARCHAR(100) NOT NULL,
    key_hash        VARCHAR(255) NOT NULL UNIQUE,
    description     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Leads indexes
CREATE INDEX idx_leads_total_score ON leads(total_score DESC);
CREATE INDEX idx_leads_routing_status ON leads(routing_status) WHERE routing_status = 'unrouted';
CREATE INDEX idx_leads_pipeline ON leads(pipeline_id);
CREATE INDEX idx_leads_intent ON leads(primary_intent, intent_confidence DESC);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_lifecycle ON leads(lifecycle_stage);
CREATE INDEX idx_leads_created ON leads(created_at DESC);
CREATE INDEX idx_leads_last_activity ON leads(last_activity DESC);

-- Intent signals indexes
CREATE INDEX idx_intent_signals_lead ON intent_signals(lead_id, detected_at DESC);
CREATE INDEX idx_intent_signals_intent ON intent_signals(intent);

-- Events indexes
CREATE INDEX idx_events_lead_occurred ON events(lead_id, occurred_at DESC);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_source ON events(source);
CREATE INDEX idx_events_processed ON events(processed_at) WHERE processed_at IS NULL;

-- Deals indexes
CREATE INDEX idx_deals_pipeline_stage ON deals(pipeline_id, stage_id);
CREATE INDEX idx_deals_lead ON deals(lead_id);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_assigned ON deals(assigned_to);

-- Score history indexes
CREATE INDEX idx_score_history_lead ON score_history(lead_id, created_at DESC);
CREATE INDEX idx_score_history_expiring ON score_history(expires_at) WHERE expired = FALSE;
CREATE INDEX idx_score_history_rule ON score_history(rule_id, lead_id);

-- Tasks indexes
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to, status);
CREATE INDEX idx_tasks_due ON tasks(due_date) WHERE status = 'open';

-- API keys indexes
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE is_active = TRUE;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Recalculate lead scores from score history
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

-- Expire old scores and recalculate affected leads
CREATE OR REPLACE FUNCTION expire_old_scores()
RETURNS TABLE(expired_count INTEGER, leads_updated INTEGER) AS $$
DECLARE
    v_expired_count INTEGER;
    v_leads_count INTEGER;
    v_lead_id UUID;
BEGIN
    -- Mark expired scores
    WITH expired AS (
        UPDATE score_history 
        SET expired = TRUE, expired_at = NOW()
        WHERE expires_at < NOW() AND expired = FALSE
        RETURNING lead_id
    )
    SELECT COUNT(*), COUNT(DISTINCT lead_id) INTO v_expired_count, v_leads_count FROM expired;
    
    -- Recalculate scores for affected leads
    FOR v_lead_id IN 
        SELECT DISTINCT lead_id FROM score_history 
        WHERE expired_at > NOW() - INTERVAL '1 minute'
    LOOP
        PERFORM recalculate_lead_scores(v_lead_id);
    END LOOP;
    
    RETURN QUERY SELECT v_expired_count, v_leads_count;
END;
$$ LANGUAGE plpgsql;

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at on leads
CREATE TRIGGER trigger_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Auto-update updated_at on deals
CREATE TRIGGER trigger_deals_updated_at
    BEFORE UPDATE ON deals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Auto-update updated_at on organizations
CREATE TRIGGER trigger_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Auto-update updated_at on scoring_rules
CREATE TRIGGER trigger_scoring_rules_updated_at
    BEFORE UPDATE ON scoring_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Auto-update updated_at on automation_rules
CREATE TRIGGER trigger_automation_rules_updated_at
    BEFORE UPDATE ON automation_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Auto-update updated_at on tasks
CREATE TRIGGER trigger_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Auto-update updated_at on campaigns
CREATE TRIGGER trigger_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
