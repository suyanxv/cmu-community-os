-- Added after initial schema:
-- - events.custom_fields for dynamic template form data
-- - events.end_date for multi-day events
-- - events.event_mode tri-state (in_person | virtual | hybrid)
-- Already applied to production Neon DB — included for anyone re-bootstrapping.

ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date      DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_mode    TEXT NOT NULL DEFAULT 'in_person';
