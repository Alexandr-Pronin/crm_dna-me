-- Up Migration
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS is_two_factor_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS temp_two_factor_secret TEXT;

-- Down Migration
-- ALTER TABLE team_members DROP COLUMN IF EXISTS password_hash;
-- ALTER TABLE team_members DROP COLUMN IF EXISTS two_factor_secret;
-- ALTER TABLE team_members DROP COLUMN IF EXISTS is_two_factor_enabled;
-- ALTER TABLE team_members DROP COLUMN IF EXISTS temp_two_factor_secret;
