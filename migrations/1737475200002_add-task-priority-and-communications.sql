-- =============================================================================
-- DNA Marketing Engine - Migration: Task Priority + Communications
-- =============================================================================

-- =============================================================================
-- EXTEND TASKS TABLE
-- =============================================================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_tasks_due_date_range
  ON tasks(due_date)
  WHERE status NOT IN ('completed', 'cancelled');

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_priority
  ON tasks(assigned_to, priority, due_date);

CREATE INDEX IF NOT EXISTS idx_tasks_created_by
  ON tasks(created_by);

-- =============================================================================
-- COMMUNICATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS communications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    deal_id         UUID REFERENCES deals(id),
    comm_type       VARCHAR(50) NOT NULL,
    subject         VARCHAR(500),
    body            TEXT NOT NULL,
    direction       VARCHAR(10) DEFAULT 'outbound',
    created_by      VARCHAR(255),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_communications_lead
  ON communications(lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_communications_type
  ON communications(comm_type);

CREATE INDEX IF NOT EXISTS idx_communications_deal
  ON communications(deal_id)
  WHERE deal_id IS NOT NULL;
