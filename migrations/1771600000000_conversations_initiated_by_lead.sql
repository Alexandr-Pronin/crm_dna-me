-- Up Migration
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS initiated_by_lead BOOLEAN NOT NULL DEFAULT FALSE;

-- Down Migration
-- ALTER TABLE conversations DROP COLUMN IF EXISTS initiated_by_lead;
