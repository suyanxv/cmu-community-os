-- ============================================================
-- QUORUM DATABASE SCHEMA
-- Multi-tenant: every row is scoped to org_id
-- Run: psql $DATABASE_URL -f packages/db/schema.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ORGANIZATIONS
-- Created via Clerk webhook on organization.created
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id    TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  plan            TEXT NOT NULL DEFAULT 'free',
  settings        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USERS
-- Created via Clerk webhook on user.created
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id   TEXT UNIQUE NOT NULL,
  email           TEXT NOT NULL,
  full_name       TEXT,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ORG MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS org_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'editor',
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at       TIMESTAMPTZ,
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id  ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members(user_id);

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by          UUID NOT NULL REFERENCES users(id),

  name                TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'draft',

  event_date          DATE NOT NULL,
  end_date            DATE,
  start_time          TIME,
  end_time            TIME,
  timezone            TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  location_name       TEXT,
  location_address    TEXT,
  location_url        TEXT,
  is_virtual          BOOLEAN NOT NULL DEFAULT FALSE,
  event_mode          TEXT NOT NULL DEFAULT 'in_person',  -- 'in_person' | 'virtual' | 'hybrid'

  description         TEXT,
  speakers            JSONB,
  agenda              TEXT,
  sponsors            JSONB,

  tone                TEXT NOT NULL DEFAULT 'professional-warm',
  target_audience     TEXT,
  channels            TEXT[] NOT NULL DEFAULT '{}',
  rsvp_link           TEXT,
  rsvp_deadline       DATE,
  max_capacity        INT,

  tags                TEXT[] DEFAULT '{}',
  notes               TEXT,
  custom_fields       JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_org_id    ON events(org_id);
CREATE INDEX IF NOT EXISTS idx_events_date      ON events(org_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_status    ON events(org_id, status);

-- ============================================================
-- GENERATED CONTENT
-- ============================================================
CREATE TABLE IF NOT EXISTS generated_content (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL,
  version         INT NOT NULL DEFAULT 1,

  subject_line    TEXT,
  body            TEXT NOT NULL,
  character_count INT,

  model           TEXT NOT NULL,
  prompt_tokens   INT,
  output_tokens   INT,
  cached          BOOLEAN DEFAULT FALSE,

  approved        BOOLEAN NOT NULL DEFAULT FALSE,
  copied_at       TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_event_id ON generated_content(event_id);
CREATE INDEX IF NOT EXISTS idx_content_org_id   ON generated_content(org_id);

-- ============================================================
-- RSVPs
-- ============================================================
CREATE TABLE IF NOT EXISTS rsvps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  name            TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,

  status          TEXT NOT NULL DEFAULT 'confirmed',
  guest_count     INT NOT NULL DEFAULT 1,
  check_in_at     TIMESTAMPTZ,

  source          TEXT DEFAULT 'manual',
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rsvps_event_id ON rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_org_id   ON rsvps(org_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_email    ON rsvps(org_id, email);

-- ============================================================
-- PARTNERS (CRM)
-- ============================================================
CREATE TABLE IF NOT EXISTS partners (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  company_name    TEXT NOT NULL,
  contact_name    TEXT,
  email           TEXT,
  phone           TEXT,
  linkedin_url    TEXT,
  website         TEXT,

  type            TEXT NOT NULL DEFAULT 'sponsor',
  tier            TEXT,
  status          TEXT NOT NULL DEFAULT 'prospect',

  notes           TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partners_org_id  ON partners(org_id);
CREATE INDEX IF NOT EXISTS idx_partners_status  ON partners(org_id, status);

CREATE TABLE IF NOT EXISTS event_partners (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  partner_id      UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  role            TEXT,
  contribution    TEXT,
  confirmed       BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(event_id, partner_id)
);

CREATE TABLE IF NOT EXISTS partner_communications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  partner_id      UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id),

  type            TEXT NOT NULL,
  direction       TEXT,
  subject         TEXT,
  body            TEXT NOT NULL,
  ai_drafted      BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at         TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_comms_partner_id ON partner_communications(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_comms_org_id     ON partner_communications(org_id);

-- ============================================================
-- REMINDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS reminders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,

  title           TEXT NOT NULL,
  description     TEXT,
  due_date        TIMESTAMPTZ NOT NULL,

  status          TEXT NOT NULL DEFAULT 'pending',
  completed_at    TIMESTAMPTZ,
  completed_by    UUID REFERENCES users(id),

  ai_generated    BOOLEAN NOT NULL DEFAULT FALSE,
  priority        TEXT NOT NULL DEFAULT 'medium',

  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_org_id      ON reminders(org_id);
CREATE INDEX IF NOT EXISTS idx_reminders_event_id    ON reminders(event_id);
CREATE INDEX IF NOT EXISTS idx_reminders_assigned_to ON reminders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_reminders_due_date    ON reminders(org_id, due_date);
CREATE INDEX IF NOT EXISTS idx_reminders_status      ON reminders(org_id, status);

-- ============================================================
-- ACTIVITY LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,

  entity_type     TEXT NOT NULL,
  entity_id       UUID,
  action          TEXT NOT NULL,
  detail          JSONB,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_org_id ON activity_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log(entity_type, entity_id);
