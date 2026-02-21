-- Up Migration
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS avatar VARCHAR(512);

-- Down Migration
-- ALTER TABLE team_members DROP COLUMN IF EXISTS avatar;
