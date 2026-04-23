-- Event hosts (internal org members running / representing an event)
-- Run after previous migrations.

CREATE TABLE IF NOT EXISTS event_hosts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_hosts_event_id ON event_hosts(event_id);
CREATE INDEX IF NOT EXISTS idx_event_hosts_user_id  ON event_hosts(user_id);
