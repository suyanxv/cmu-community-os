-- Co-host organizations for an event. Free-form array of names like "Stanford
-- Alumni", "MITCNC", "Sing" — captures the "w/ <org>" pattern many volunteer
-- boards use in their planning sheets without requiring a formal Partner record.
-- Formal partners (with contact info, tracked outreach, etc.) still live in the
-- partners CRM and are linked via event_partners.

ALTER TABLE events ADD COLUMN IF NOT EXISTS co_hosts TEXT[] NOT NULL DEFAULT '{}';
