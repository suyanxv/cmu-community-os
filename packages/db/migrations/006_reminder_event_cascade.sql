-- Cascade delete reminders when their linked event is deleted.
-- Previously used ON DELETE SET NULL which orphaned reminders as standalone.

ALTER TABLE reminders
  DROP CONSTRAINT IF EXISTS reminders_event_id_fkey;

ALTER TABLE reminders
  ADD CONSTRAINT reminders_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
