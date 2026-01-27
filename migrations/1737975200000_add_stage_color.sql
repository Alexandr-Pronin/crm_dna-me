-- =============================================================================
-- Add color field to pipeline stages
-- =============================================================================

ALTER TABLE pipeline_stages
ADD COLUMN color VARCHAR(7);
