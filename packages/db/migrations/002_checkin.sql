-- Check-in feature
-- Run in Neon SQL Editor before using the /check-in flow

ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS graduation_year TEXT;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS school          TEXT;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS how_heard       TEXT;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS whatsapp_joined BOOLEAN DEFAULT FALSE;

ALTER TABLE events ADD COLUMN IF NOT EXISTS checkin_config JSONB NOT NULL DEFAULT '{}';
