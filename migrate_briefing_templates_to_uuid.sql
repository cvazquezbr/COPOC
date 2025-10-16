-- =================================================================
-- SCRIPT TO RECREATE THE 'briefing_templates' TABLE WITH UUID
-- =================================================================
-- WARNING: This script will drop the existing 'briefing_templates' table and all its data.
-- Back up any important data before running this script.

DROP TABLE IF EXISTS briefing_templates;

-- Create the 'briefing_templates' table with the correct structure.
CREATE TABLE briefing_templates (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE, -- Ensures one template per user
    template_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_user
        FOREIGN KEY(user_id)
        REFERENCES users(uuid)
        ON DELETE CASCADE
);

-- Create an index on 'user_id' for faster lookups.
CREATE INDEX IF NOT EXISTS idx_briefing_templates_user_id ON briefing_templates(user_id);

-- Success message.
-- The 'briefing_templates' table has been successfully recreated with the correct schema.
-- =================================================================