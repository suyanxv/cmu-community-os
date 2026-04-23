-- Track when (if ever) a reminder was emailed. Cron only sends once per
-- reminder, so this column is the idempotency key. NULL means "not yet sent";
-- a timestamp means "already delivered" and the cron skips it.

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS last_emailed_at TIMESTAMPTZ;

-- Speed up the cron's scan: due + pending + not-yet-emailed.
CREATE INDEX IF NOT EXISTS idx_reminders_due_email
  ON reminders (due_date)
  WHERE status = 'pending' AND last_emailed_at IS NULL;
