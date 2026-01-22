-- =============================================================================
-- DNA Marketing Engine - Seed Data: Pipelines and Stages
-- =============================================================================

-- =============================================================================
-- PIPELINES
-- =============================================================================

-- Discovery Pipeline (Default for unclear intent)
INSERT INTO pipelines (id, slug, name, description, is_active, is_default) VALUES
('00000000-0000-0000-0000-000000000000', 'discovery', 'Discovery Pipeline', 'For leads with unclear intent - manual qualification needed', TRUE, TRUE);

-- Research Lab Pipeline
INSERT INTO pipelines (id, slug, name, description, sales_cycle_days, target_persona) VALUES
('11111111-1111-1111-1111-111111111111', 'research-lab', 'Research Lab', 'For academic researchers and small research labs', 14, 'PhD/Professor/Researcher');

-- B2B Lab Enablement Pipeline
INSERT INTO pipelines (id, slug, name, description, sales_cycle_days, target_persona) VALUES
('22222222-2222-2222-2222-222222222222', 'b2b-lab-enablement', 'B2B Lab Enablement', 'For enterprise labs and commercial customers', 60, 'Lab Director/Operations Manager');

-- Panel Co-Creation Pipeline
INSERT INTO pipelines (id, slug, name, description, sales_cycle_days, target_persona) VALUES
('33333333-3333-3333-3333-333333333333', 'panel-co-creation', 'Panel Co-Creation', 'For strategic partnerships and custom panel development', 120, 'VP R&D/CSO/CTO');

-- =============================================================================
-- PIPELINE STAGES
-- =============================================================================

-- Discovery Pipeline Stages
INSERT INTO pipeline_stages (pipeline_id, slug, name, position, stage_type) VALUES
('00000000-0000-0000-0000-000000000000', 'new', 'New Lead', 1, 'awareness'),
('00000000-0000-0000-0000-000000000000', 'qualifying', 'Qualifying', 2, 'interest'),
('00000000-0000-0000-0000-000000000000', 'routed', 'Routed to Pipeline', 3, 'decision');

-- Research Lab Pipeline Stages
INSERT INTO pipeline_stages (pipeline_id, slug, name, position, stage_type, automation_config) VALUES
('11111111-1111-1111-1111-111111111111', 'awareness', 'Initial Contact', 1, 'awareness', '[]'),
('11111111-1111-1111-1111-111111111111', 'interest', 'Information Phase', 2, 'interest', '[]'),
('11111111-1111-1111-1111-111111111111', 'consultation', 'Consultation Scheduled', 3, 'consideration', '[]'),
('11111111-1111-1111-1111-111111111111', 'pilot', 'Pilot Project', 4, 'evaluation', '[]'),
('11111111-1111-1111-1111-111111111111', 'proposal', 'Proposal Sent', 5, 'decision', '[{"trigger":{"type":"stage_entered"},"action":{"type":"sync_moco","action":"create_offer"}}]'),
('11111111-1111-1111-1111-111111111111', 'closed_won', 'Customer', 6, 'closed_won', '[{"trigger":{"type":"stage_entered"},"action":{"type":"sync_moco","action":"create_customer"}}]'),
('11111111-1111-1111-1111-111111111111', 'closed_lost', 'Lost', 7, 'closed_lost', '[]');

-- B2B Lab Enablement Pipeline Stages
INSERT INTO pipeline_stages (pipeline_id, slug, name, position, stage_type, automation_config) VALUES
('22222222-2222-2222-2222-222222222222', 'awareness', 'Initial Contact', 1, 'awareness', '[]'),
('22222222-2222-2222-2222-222222222222', 'tech-discovery', 'Technical Discovery', 2, 'interest', '[]'),
('22222222-2222-2222-2222-222222222222', 'deep-analysis', 'Deep Analysis', 3, 'consideration', '[]'),
('22222222-2222-2222-2222-222222222222', 'poc', 'Proof of Concept', 4, 'evaluation', '[]'),
('22222222-2222-2222-2222-222222222222', 'business-case', 'Business Case Review', 5, 'decision', '[{"trigger":{"type":"stage_entered"},"action":{"type":"sync_moco","action":"create_offer"}}]'),
('22222222-2222-2222-2222-222222222222', 'closed_won', 'Contract Signed', 6, 'closed_won', '[{"trigger":{"type":"stage_entered"},"action":{"type":"sync_moco","action":"create_customer"}}]'),
('22222222-2222-2222-2222-222222222222', 'closed_lost', 'Lost', 7, 'closed_lost', '[]');

-- Panel Co-Creation Pipeline Stages
INSERT INTO pipeline_stages (pipeline_id, slug, name, position, stage_type, automation_config) VALUES
('33333333-3333-3333-3333-333333333333', 'awareness', 'Initial Contact', 1, 'awareness', '[]'),
('33333333-3333-3333-3333-333333333333', 'exploration', 'Exploration Phase', 2, 'interest', '[]'),
('33333333-3333-3333-3333-333333333333', 'workshop', 'Requirements Workshop', 3, 'consideration', '[]'),
('33333333-3333-3333-3333-333333333333', 'development', 'Panel Development', 4, 'evaluation', '[]'),
('33333333-3333-3333-3333-333333333333', 'finalization', 'Contract Finalization', 5, 'decision', '[{"trigger":{"type":"stage_entered"},"action":{"type":"sync_moco","action":"create_offer"}}]'),
('33333333-3333-3333-3333-333333333333', 'closed_won', 'Partnership Signed', 6, 'closed_won', '[{"trigger":{"type":"stage_entered"},"action":{"type":"sync_moco","action":"create_customer"}}]'),
('33333333-3333-3333-3333-333333333333', 'closed_lost', 'Lost', 7, 'closed_lost', '[]');
