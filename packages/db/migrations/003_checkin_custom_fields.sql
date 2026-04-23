-- Dynamic check-in form responses
-- Run after 002_checkin.sql

ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS check_in_data JSONB NOT NULL DEFAULT '{}';
