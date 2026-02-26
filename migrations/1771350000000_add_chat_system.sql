-- =============================================================================
-- DNA Marketing Engine - Chat System Migration
-- Adds conversations, messages, email_accounts, linkedin_connections tables
-- with GIN indexes for JSONB fields, sender_id, email_thread_id, status tracking
-- =============================================================================

-- Up Migration

-- =============================================================================
-- CONVERSATIONS
-- Zentrale Tabelle für Chat-Konversationen (E-Mail, LinkedIn, interne Notizen)
-- =============================================================================
CREATE TABLE conversations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id             UUID REFERENCES leads(id) ON DELETE CASCADE,
    deal_id             UUID REFERENCES deals(id) ON DELETE CASCADE,
    type                VARCHAR(50) NOT NULL DEFAULT 'direct',
    status              VARCHAR(50) NOT NULL DEFAULT 'active',
    subject             VARCHAR(500),
    participant_emails  JSONB DEFAULT '[]',
    last_message_at     TIMESTAMPTZ,
    created_by_id       UUID REFERENCES team_members(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    -- Mindestens lead_id ODER deal_id muss gesetzt sein
    CONSTRAINT chk_conversations_entity CHECK (lead_id IS NOT NULL OR deal_id IS NOT NULL),
    -- type muss einer der erlaubten Werte sein
    CONSTRAINT chk_conversations_type CHECK (type IN ('direct', 'group', 'internal')),
    -- status muss einer der erlaubten Werte sein
    CONSTRAINT chk_conversations_status CHECK (status IN ('active', 'archived', 'closed'))
);

-- =============================================================================
-- MESSAGES
-- Speichert alle Nachrichten (E-Mail, LinkedIn, interne Notizen, Aufgaben)
-- =============================================================================
CREATE TABLE messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id           UUID REFERENCES team_members(id) ON DELETE SET NULL,
    message_type        VARCHAR(50) NOT NULL DEFAULT 'email',
    direction           VARCHAR(50) NOT NULL DEFAULT 'outbound',
    status              VARCHAR(50) NOT NULL DEFAULT 'draft',
    sender_email        VARCHAR(255),
    sender_name         VARCHAR(255),
    recipients          JSONB DEFAULT '[]',
    subject             VARCHAR(500),
    body_html           TEXT,
    body_text           TEXT,
    metadata            JSONB DEFAULT '{}',
    attachments         JSONB DEFAULT '[]',
    external_id         VARCHAR(255),
    email_thread_id     VARCHAR(255),
    sent_at             TIMESTAMPTZ,
    read_at             TIMESTAMPTZ,
    replied_at          TIMESTAMPTZ,
    error_message       TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    -- message_type muss einer der erlaubten Werte sein
    CONSTRAINT chk_messages_type CHECK (message_type IN ('email', 'linkedin', 'internal_note', 'task')),
    -- direction muss einer der erlaubten Werte sein
    CONSTRAINT chk_messages_direction CHECK (direction IN ('inbound', 'outbound', 'internal')),
    -- status muss einer der erlaubten Werte sein
    CONSTRAINT chk_messages_status CHECK (status IN ('draft', 'sending', 'sent', 'error'))
);

-- =============================================================================
-- EMAIL ACCOUNTS
-- IMAP/SMTP-Konfiguration für E-Mail-Import und -Versand
-- =============================================================================
CREATE TABLE email_accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_member_id      UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    email_address       VARCHAR(255) NOT NULL,
    imap_host           VARCHAR(255),
    imap_port           INTEGER,
    imap_username       VARCHAR(255),
    imap_password       TEXT,
    smtp_host           VARCHAR(255),
    smtp_port           INTEGER,
    smtp_username       VARCHAR(255),
    smtp_password       TEXT,
    sync_enabled        BOOLEAN DEFAULT FALSE,
    last_sync_at        TIMESTAMPTZ,
    sync_status         VARCHAR(50) DEFAULT 'idle',
    sync_error          TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    -- sync_status muss einer der erlaubten Werte sein
    CONSTRAINT chk_email_accounts_sync_status CHECK (sync_status IN ('idle', 'syncing', 'error'))
);

-- =============================================================================
-- LINKEDIN CONNECTIONS
-- LinkedIn OAuth-Token und Verbindungsstatus
-- =============================================================================
CREATE TABLE linkedin_connections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_member_id      UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    linkedin_profile_id VARCHAR(255),
    access_token        TEXT,
    refresh_token       TEXT,
    token_expires_at    TIMESTAMPTZ,
    profile_data        JSONB DEFAULT '{}',
    is_active           BOOLEAN DEFAULT TRUE,
    last_sync_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- B-TREE INDEXES
-- =============================================================================

-- Conversations indexes
CREATE INDEX idx_conversations_lead ON conversations(lead_id);
CREATE INDEX idx_conversations_deal ON conversations(deal_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_created_by ON conversations(created_by_id);

-- Messages indexes
CREATE INDEX idx_messages_conversation_sent ON messages(conversation_id, sent_at DESC);
CREATE UNIQUE INDEX idx_messages_external_id ON messages(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_messages_email_thread ON messages(email_thread_id);
CREATE INDEX idx_messages_type ON messages(message_type);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_status ON messages(status) WHERE status IN ('sending', 'error');
CREATE INDEX idx_messages_direction ON messages(direction);

-- Email accounts indexes
CREATE INDEX idx_email_accounts_team_member ON email_accounts(team_member_id);
CREATE INDEX idx_email_accounts_sync ON email_accounts(sync_enabled, sync_status);

-- LinkedIn connections indexes
CREATE INDEX idx_linkedin_connections_team_member ON linkedin_connections(team_member_id);
CREATE INDEX idx_linkedin_connections_profile ON linkedin_connections(linkedin_profile_id);

-- =============================================================================
-- GIN INDEXES für JSONB-Felder
-- =============================================================================

-- GIN-Index auf participant_emails (für Teilnehmersuche in Conversations)
CREATE INDEX idx_conversations_participants ON conversations USING GIN (participant_emails);

-- GIN-Index auf recipients (für Empfängersuche in Messages)
CREATE INDEX idx_messages_recipients ON messages USING GIN (recipients);

-- GIN-Index auf metadata (für Platform-Daten-Suche in Messages)
CREATE INDEX idx_messages_metadata ON messages USING GIN (metadata);

-- GIN-Index auf attachments (für Anhänge-Suche in Messages)
CREATE INDEX idx_messages_attachments ON messages USING GIN (attachments);

-- GIN-Index auf profile_data (für LinkedIn-Profilsuche)
CREATE INDEX idx_linkedin_connections_profile_data ON linkedin_connections USING GIN (profile_data);

-- =============================================================================
-- TRIGGERS (updated_at) - nutzt die bestehende update_updated_at() Funktion
-- =============================================================================

CREATE TRIGGER trigger_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_email_accounts_updated_at
    BEFORE UPDATE ON email_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_linkedin_connections_updated_at
    BEFORE UPDATE ON linkedin_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- Down Migration (auskommentiert, manuell ausführen bei Bedarf)
-- =============================================================================

-- DROP TRIGGER IF EXISTS trigger_linkedin_connections_updated_at ON linkedin_connections;
-- DROP TRIGGER IF EXISTS trigger_email_accounts_updated_at ON email_accounts;
-- DROP TRIGGER IF EXISTS trigger_messages_updated_at ON messages;
-- DROP TRIGGER IF EXISTS trigger_conversations_updated_at ON conversations;
-- DROP TABLE IF EXISTS linkedin_connections CASCADE;
-- DROP TABLE IF EXISTS email_accounts CASCADE;
-- DROP TABLE IF EXISTS messages CASCADE;
-- DROP TABLE IF EXISTS conversations CASCADE;
