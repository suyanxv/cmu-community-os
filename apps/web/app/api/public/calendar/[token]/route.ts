import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'

// Public read-only calendar endpoint. No auth — the share token IS the auth.
// Returns org name plus published/past/cancelled events. Omits drafts and
// archived. Omits RSVP internals, notes, and other sensitive fields.

type Params = { params: Promise<{ token: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params
  if (!token || token.length < 8) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const orgs = await sql`
    SELECT id, name FROM organizations WHERE public_share_token = ${token}
  `
  if (!orgs[0]) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  const org = orgs[0]

  // Show published, past, and cancelled (so viewers know what's off). Hide
  // drafts (not ready) and archived (hidden by design).
  const events = await sql`
    SELECT
      id, name, status, category, co_hosts, cover_emoji,
      to_char(event_date, 'YYYY-MM-DD') AS event_date,
      to_char(COALESCE(end_date, event_date), 'YYYY-MM-DD') AS effective_end_date,
      start_time, location_name, location_address, event_mode, rsvp_link,
      description
    FROM events
    WHERE org_id = ${org.id}
      AND status IN ('published', 'past', 'cancelled')
    ORDER BY event_date DESC
    LIMIT 200
  `

  return Response.json({
    data: {
      org: { name: org.name },
      events,
    },
  })
}
