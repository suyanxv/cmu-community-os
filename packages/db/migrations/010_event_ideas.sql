-- Event ideas backlog. Volunteer boards keep a list of events they WANT to run
-- ("Hiking in Spring", "Yoga event — Mary's contact") separately from committed
-- events. This table captures that brainstorm state plus the context that seeds
-- it (contacts, venue leads, seasonality) so nothing is lost when the idea is
-- eventually promoted into an actual event.

CREATE TABLE IF NOT EXISTS event_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  notes TEXT,                      -- free-form: contacts, venue leads, timing hints
  target_season TEXT,              -- "Spring", "May/June", "Q3 2026" — left as text; UX sorts, not validates
  tags TEXT[] NOT NULL DEFAULT '{}',

  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'planning', 'promoted', 'archived')),
  converted_event_id UUID REFERENCES events(id) ON DELETE SET NULL,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_ideas_org    ON event_ideas(org_id);
CREATE INDEX IF NOT EXISTS idx_event_ideas_status ON event_ideas(org_id, status);
