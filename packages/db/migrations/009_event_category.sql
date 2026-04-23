-- Event category: distinguish internal events from co-hosted partnerships and
-- events where the org is attending an external host. Drives color-coding in
-- the year calendar view so boards can scan partnership cadence at a glance.
--
-- internal  = driven entirely by the org
-- partnered = co-hosted with another org (another alumni network, a sponsor,
--             a partner org) — shown in butter/yellow to match spreadsheet convention
-- external  = org is attending a third-party event (e.g. sports outing, conference)

ALTER TABLE events ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'internal';

CREATE INDEX IF NOT EXISTS idx_events_category ON events(org_id, category);
