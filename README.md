# Quorum

AI-native event OS for volunteer-led community organizations. One event form in → ready-to-send content across WhatsApp, email, Instagram, LinkedIn, and Luma out. Plus RSVPs, partner CRM, smart reminders, and board collaboration.

**Live:** [cmu-community-os-pink.vercel.app](https://cmu-community-os-pink.vercel.app)

---

## What it does

1. **Fill out one event form** (core fields + any custom fields your org uses — form template is AI-parsed from your existing Google/Monday/Luma form URL)
2. **Click Create & Generate** — AI drafts content for each selected channel with prompt caching (same event context reused across channels)
3. **Copy each channel's copy** into WhatsApp/email/social with one click
4. Track **RSVPs** (manual entry or CSV import), link **partners & sponsors** to events, manage **AI-suggested reminder schedules**, and share event pages with your board

## Stack

| Layer | Tool |
|---|---|
| Frontend | Next.js 16 (App Router) + React + Tailwind v4 |
| Auth | Clerk (organizations mode, B2B multi-tenant) |
| Database | Neon Postgres (serverless HTTP driver) |
| AI | Anthropic Claude Sonnet 4.6 (content) + Haiku 4.5 (reminders, CRM drafts) with prompt caching |
| Hosting | Vercel (serverless functions; monorepo root set to `apps/web`) |

No ORM — raw SQL via `@neondatabase/serverless`. Every query is scoped by `org_id` for multi-tenancy.

## Repository layout

```
apps/web/          Next.js app (frontend + API routes)
├── app/
│   ├── (auth)/    Clerk sign-in / sign-up
│   ├── (dashboard)/
│   │   ├── events/       Event CRUD + content + RSVPs
│   │   ├── partners/     CRM
│   │   ├── reminders/    Board-wide reminder list
│   │   └── settings/     Org settings + event form template parser
│   └── api/       REST endpoints + Clerk webhook
├── components/    UI components grouped by feature
└── lib/           db.ts, ai.ts, auth.ts, activity.ts, errors.ts

packages/db/       Canonical schema.sql + TypeScript types
```

## Local setup

Prerequisites: Node 20+, npm, a Neon database, a Clerk app, an Anthropic API key.

```bash
git clone https://github.com/suyanxv/cmu-community-os.git
cd cmu-community-os
npm install
cp .env.example apps/web/.env.local
# Fill in the five env vars in apps/web/.env.local

# Apply the schema to your Neon database
# Option A: from the Neon SQL Editor — paste contents of packages/db/schema.sql
# Option B: psql "$DATABASE_URL" -f packages/db/schema.sql

npm run --workspace=apps/web dev
```

Open `http://localhost:3000`. Configure a Clerk webhook endpoint pointing at `/api/webhooks/clerk` (subscribe to `user.created`, `organization.created`, `organizationMembership.created/updated/deleted`) to auto-seed user/org rows.

## Multi-tenancy

Every data table has an `org_id` column enforced by `requireOrgMember()` in [`apps/web/lib/auth.ts`](apps/web/lib/auth.ts). All API routes start with that guard — it resolves the Clerk `orgId` to our internal UUID and attaches the user's role. Queries never run without it.

## AI content generation

`POST /api/events/:id/generate` is the core endpoint. The event's 20+ fields are assembled into a single XML context block that becomes the cached system prompt prefix. Each channel (WhatsApp / Email / Instagram / LinkedIn / Luma) is a separate user message with channel-specific constraints. With Claude's prompt caching, generating all 5 channels costs roughly the same input tokens as generating one.

Content generation style rules live in `apps/web/lib/ai.ts` — no em-dashes, no "not only… but also", no AI-cliche verbs.

## Custom event form templates

Orgs can upload their existing intake form (Monday / Google Forms / Luma URL, a pasted field list, or a text description). The backend fetches the URL content server-side and feeds the HTML to Claude Haiku, which extracts a structured schema. The schema is stored in `organizations.settings.event_template_schema` and drives a dynamic form at `/events/new`. Core AI-required fields (name, date, channels, tone) stay in place; custom fields are stored in `events.custom_fields` and fed into the AI prompt as additional context.

## Roadmap

See [TODO.md](./TODO.md) for Phase 2 items: image upload, direct channel API sending (SendGrid, WhatsApp Business, Meta Graph, LinkedIn), member-facing event pages, automated reminder notifications, analytics.

## License

Private. Not currently open-sourced.
