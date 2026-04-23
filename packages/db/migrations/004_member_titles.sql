-- Per-member title (Co-President, Board Member, etc.)
-- Run after previous migrations.

ALTER TABLE org_members ADD COLUMN IF NOT EXISTS title TEXT;
