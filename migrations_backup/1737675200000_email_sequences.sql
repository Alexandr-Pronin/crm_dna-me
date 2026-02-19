-- =============================================================================
-- DNA Marketing Engine - E-Mail Sequences Migration
-- PostgreSQL 15+
-- =============================================================================

-- =============================================================================
-- EMAIL SEQUENCES
-- =============================================================================
CREATE TABLE email_sequences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    trigger_event   VARCHAR(50),              -- z.B. 'stage_enter', 'lead_created', 'form_submit'
    trigger_config  JSONB DEFAULT '{}',       -- Zusätzliche Trigger-Konfiguration
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- EMAIL SEQUENCE STEPS
-- =============================================================================
CREATE TABLE email_sequence_steps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id     UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
    position        INTEGER NOT NULL,
    delay_days      INTEGER NOT NULL DEFAULT 0,
    delay_hours     INTEGER DEFAULT 0,
    subject         VARCHAR(255) NOT NULL,
    body_html       TEXT NOT NULL,
    body_text       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sequence_id, position)
);

-- =============================================================================
-- EMAIL SEQUENCE ENROLLMENTS
-- =============================================================================
CREATE TABLE email_sequence_enrollments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id             UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    sequence_id         UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
    current_step        INTEGER DEFAULT 0,
    status              VARCHAR(20) DEFAULT 'active',  -- active, paused, completed, unsubscribed
    enrolled_at         TIMESTAMPTZ DEFAULT NOW(),
    last_email_sent_at  TIMESTAMPTZ,
    next_email_due_at   TIMESTAMPTZ,                   -- Wann die nächste E-Mail gesendet werden soll
    completed_at        TIMESTAMPTZ,
    unsubscribed_at     TIMESTAMPTZ,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(lead_id, sequence_id)
);

-- =============================================================================
-- EMAIL TRACKING (für Opens und Clicks)
-- =============================================================================
CREATE TABLE email_tracking (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id   UUID NOT NULL REFERENCES email_sequence_enrollments(id) ON DELETE CASCADE,
    step_id         UUID NOT NULL REFERENCES email_sequence_steps(id) ON DELETE CASCADE,
    sent_at         TIMESTAMPTZ DEFAULT NOW(),
    opened_at       TIMESTAMPTZ,
    open_count      INTEGER DEFAULT 0,
    clicked_at      TIMESTAMPTZ,
    click_count     INTEGER DEFAULT 0,
    bounced_at      TIMESTAMPTZ,
    bounce_reason   TEXT,
    unsubscribed_at TIMESTAMPTZ,
    metadata        JSONB DEFAULT '{}'
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Email sequences indexes
CREATE INDEX idx_email_sequences_active ON email_sequences(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_email_sequences_trigger ON email_sequences(trigger_event);

-- Email sequence steps indexes
CREATE INDEX idx_email_sequence_steps_sequence ON email_sequence_steps(sequence_id, position);

-- Email sequence enrollments indexes
CREATE INDEX idx_email_enrollments_lead ON email_sequence_enrollments(lead_id);
CREATE INDEX idx_email_enrollments_sequence ON email_sequence_enrollments(sequence_id);
CREATE INDEX idx_email_enrollments_status ON email_sequence_enrollments(status) WHERE status = 'active';
CREATE INDEX idx_email_enrollments_next_due ON email_sequence_enrollments(next_email_due_at) 
    WHERE status = 'active' AND next_email_due_at IS NOT NULL;

-- Email tracking indexes
CREATE INDEX idx_email_tracking_enrollment ON email_tracking(enrollment_id);
CREATE INDEX idx_email_tracking_step ON email_tracking(step_id);
CREATE INDEX idx_email_tracking_sent ON email_tracking(sent_at DESC);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at on email_sequences
CREATE TRIGGER trigger_email_sequences_updated_at
    BEFORE UPDATE ON email_sequences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Auto-update updated_at on email_sequence_steps
CREATE TRIGGER trigger_email_sequence_steps_updated_at
    BEFORE UPDATE ON email_sequence_steps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Auto-update updated_at on email_sequence_enrollments
CREATE TRIGGER trigger_email_enrollments_updated_at
    BEFORE UPDATE ON email_sequence_enrollments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Calculate next email due date based on current step and delays
CREATE OR REPLACE FUNCTION calculate_next_email_due(
    p_enrollment_id UUID
) RETURNS TIMESTAMPTZ AS $$
DECLARE
    v_sequence_id UUID;
    v_current_step INTEGER;
    v_last_sent TIMESTAMPTZ;
    v_delay_days INTEGER;
    v_delay_hours INTEGER;
    v_next_due TIMESTAMPTZ;
BEGIN
    -- Get enrollment info
    SELECT sequence_id, current_step, COALESCE(last_email_sent_at, enrolled_at)
    INTO v_sequence_id, v_current_step, v_last_sent
    FROM email_sequence_enrollments
    WHERE id = p_enrollment_id;
    
    -- Get next step delay
    SELECT delay_days, COALESCE(delay_hours, 0)
    INTO v_delay_days, v_delay_hours
    FROM email_sequence_steps
    WHERE sequence_id = v_sequence_id AND position = v_current_step + 1;
    
    -- If no next step found, return NULL
    IF v_delay_days IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Calculate next due date
    v_next_due := v_last_sent + (v_delay_days || ' days')::INTERVAL + (v_delay_hours || ' hours')::INTERVAL;
    
    RETURN v_next_due;
END;
$$ LANGUAGE plpgsql;

-- Update next_email_due_at after step completion
CREATE OR REPLACE FUNCTION update_enrollment_next_due()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if current_step or last_email_sent_at changed
    IF (NEW.current_step != OLD.current_step OR NEW.last_email_sent_at != OLD.last_email_sent_at) 
       AND NEW.status = 'active' THEN
        NEW.next_email_due_at := calculate_next_email_due(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_enrollment_next_due
    BEFORE UPDATE ON email_sequence_enrollments
    FOR EACH ROW
    EXECUTE FUNCTION update_enrollment_next_due();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE email_sequences IS 'E-Mail-Marketing-Sequenzen für automatisierte E-Mail-Ketten';
COMMENT ON TABLE email_sequence_steps IS 'Einzelne E-Mail-Schritte innerhalb einer Sequenz';
COMMENT ON TABLE email_sequence_enrollments IS 'Zuordnung von Leads zu E-Mail-Sequenzen';
COMMENT ON TABLE email_tracking IS 'Tracking von E-Mail-Opens, Clicks und Bounces';

COMMENT ON COLUMN email_sequences.trigger_event IS 'Ereignis das die Sequenz startet: stage_enter, lead_created, form_submit, manual';
COMMENT ON COLUMN email_sequence_steps.delay_days IS 'Verzögerung in Tagen nach dem vorherigen Schritt';
COMMENT ON COLUMN email_sequence_steps.delay_hours IS 'Zusätzliche Verzögerung in Stunden';
COMMENT ON COLUMN email_sequence_enrollments.status IS 'Status: active, paused, completed, unsubscribed';
COMMENT ON COLUMN email_sequence_enrollments.next_email_due_at IS 'Berechneter Zeitpunkt für die nächste E-Mail';
