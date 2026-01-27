-- =============================================================================
-- Email Sequence Enrollments: Deal + Stage Support
-- =============================================================================

ALTER TABLE email_sequence_enrollments
  ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL;

-- Remove legacy unique constraint (lead_id + sequence_id)
ALTER TABLE email_sequence_enrollments
  DROP CONSTRAINT IF EXISTS email_sequence_enrollments_lead_id_sequence_id_key;

-- Unique enrollments for lead-based sequences (no deal)
CREATE UNIQUE INDEX IF NOT EXISTS ux_email_enrollments_lead_sequence
  ON email_sequence_enrollments (lead_id, sequence_id)
  WHERE deal_id IS NULL;

-- Unique enrollments per deal + sequence
CREATE UNIQUE INDEX IF NOT EXISTS ux_email_enrollments_deal_sequence
  ON email_sequence_enrollments (deal_id, sequence_id)
  WHERE deal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_enrollments_deal
  ON email_sequence_enrollments (deal_id);

CREATE INDEX IF NOT EXISTS idx_email_enrollments_stage
  ON email_sequence_enrollments (stage_id);
