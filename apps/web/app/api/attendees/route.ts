import { NextRequest } from 'next/server'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { errorResponse } from '@/lib/errors'

/**
 * GET /api/attendees?q=<search>
 *
 * Groups rsvps by normalized email (falls back to name if email missing).
 * Returns one row per unique attendee with aggregate stats + event history.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireOrgMember()
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') ?? '').trim().toLowerCase()
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

    const rows = await sql`
      WITH base AS (
        SELECT r.*, e.name AS event_name,
               to_char(e.event_date, 'YYYY-MM-DD') AS event_date
        FROM rsvps r
        JOIN events e ON e.id = r.event_id
        WHERE r.org_id = ${ctx.orgId}
      ),
      grouped AS (
        SELECT
          LOWER(COALESCE(NULLIF(email, ''), name)) AS key,
          MAX(name) AS name,
          MAX(email) AS email,
          COUNT(*)::int AS rsvp_count,
          COUNT(*) FILTER (WHERE check_in_at IS NOT NULL)::int AS check_in_count,
          MAX(check_in_at) AS last_check_in,
          MAX(created_at) AS last_rsvp,
          json_agg(json_build_object(
            'event_id',    event_id,
            'event_name',  event_name,
            'event_date',  event_date,
            'status',      status,
            'check_in_at', check_in_at
          ) ORDER BY event_date DESC) AS events
        FROM base
        GROUP BY key
      )
      SELECT *
      FROM grouped
      WHERE ${q ? sql`(LOWER(name) LIKE ${'%' + q + '%'} OR LOWER(email) LIKE ${'%' + q + '%'})` : sql`TRUE`}
      ORDER BY GREATEST(last_check_in, last_rsvp) DESC NULLS LAST
      LIMIT ${limit}
    `

    return Response.json({ data: rows })
  } catch (err) {
    return errorResponse(err)
  }
}
