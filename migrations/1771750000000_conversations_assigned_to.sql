-- Conversations: assign conversation/lead to a team member (CRM user icon in chat list)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS assigned_to_id UUID REFERENCES team_members(id) ON DELETE SET NULL;
