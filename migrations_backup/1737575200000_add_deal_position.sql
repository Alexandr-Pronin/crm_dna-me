-- =============================================================================
-- Add position column to deals for Kanban ordering
-- =============================================================================

ALTER TABLE deals
  ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY pipeline_id, stage_id
      ORDER BY created_at DESC
    ) AS pos
  FROM deals
)
UPDATE deals d
SET position = ranked.pos
FROM ranked
WHERE d.id = ranked.id;

CREATE INDEX idx_deals_pipeline_stage_position ON deals(pipeline_id, stage_id, position);
