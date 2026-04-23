-- Broadcasts: unified record of an email send or a WhatsApp tap-to-send.
-- Email broadcasts are dispatched through Resend and track per-recipient delivery.
-- WhatsApp broadcasts are "click-to-send" — Quorum drafts + records, the user's
-- own WhatsApp account actually sends. We mark them sent when the user confirms.

CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  kind TEXT NOT NULL CHECK (kind IN ('announcement', 'reminder', 'thank_you', 'custom')),
  subject TEXT,
  body TEXT NOT NULL,
  audience_type TEXT NOT NULL CHECK (audience_type IN ('confirmed_rsvps', 'all_rsvps', 'partners', 'individual', 'custom_list')),
  audience_ids UUID[] DEFAULT '{}',
  recipient_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_event    ON broadcasts(event_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_org      ON broadcasts(org_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_sent_at  ON broadcasts(sent_at DESC);

-- Per-recipient delivery rows for email broadcasts (WhatsApp has no recipient tracking).
CREATE TABLE IF NOT EXISTS email_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  rsvp_id UUID REFERENCES rsvps(id) ON DELETE SET NULL,
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  resend_email_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed')),
  error TEXT,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_deliveries_broadcast ON email_deliveries(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_email_deliveries_status    ON email_deliveries(status);
