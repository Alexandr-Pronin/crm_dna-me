-- =============================================================================
-- conversations.imported_at – Mark conversations created from CSV/lead import
-- =============================================================================
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ NULL;

-- Optional: index for filtering imported chats
-- CREATE INDEX idx_conversations_imported_at ON conversations(imported_at) WHERE imported_at IS NOT NULL;
