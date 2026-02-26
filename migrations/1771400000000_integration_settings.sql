-- =============================================================================
-- Integration Settings - Store Moco/Cituro etc. API keys and subdomains (UI config)
-- =============================================================================

CREATE TABLE IF NOT EXISTS integration_settings (
    name    VARCHAR(64) PRIMARY KEY,
    payload JSONB       NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE integration_settings IS 'Per-integration config (e.g. moco: api_key_encrypted, subdomain) overridable via UI';
