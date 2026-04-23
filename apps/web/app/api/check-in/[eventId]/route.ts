import { NextRequest } from 'next/server'
import { z } from 'zod'
import { sql } from '@/lib/db'
import { errorResponse, ApiError } from '@/lib/errors'

type Params = { params: Promise<{ eventId: string }> }

// Public endpoint — no auth. Returns the minimum info needed to render the
// public /check-in page (event name, organization name, whatsapp link).
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { eventId } = await params
    const rows = await sql`
      SELECT e.id, e.name, e.event_date, e.end_date, e.start_time, e.location_name,
             e.location_address, e.is_virtual, e.event_mode,
             e.checkin_config, o.name AS org_name
      FROM events e
      JOIN organizations o ON o.id = e.org_id
      WHERE e.id = ${eventId} AND e.status != 'archived'
    `
    if (!rows[0]) throw new ApiError(404, 'Event not found')
    return Response.json({ data: rows[0] })
  } catch (err) {
    return errorResponse(err)
  }
}

const CheckInSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  graduation_year: z.string().optional().nullable().transform((v) => v || null),
  school: z.string().optional().nullable().transform((v) => v || null),
  how_heard: z.string().optional().nullable().transform((v) => v || null),
  whatsapp_joined: z.boolean().optional().default(false),
})

// Public endpoint — anyone with the QR/link can check themselves in.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { eventId } = await params
    const body = await req.json()
    const data = CheckInSchema.parse(body)

    // Verify event exists + resolve org_id
    const eventRows = await sql`
      SELECT id, org_id FROM events WHERE id = ${eventId} AND status != 'archived'
    `
    if (!eventRows[0]) throw new ApiError(404, 'Event not found')
    const orgId = eventRows[0].org_id

    // Upsert by (event_id, email). If the attendee already RSVP'd, update their
    // existing row with check-in fields. Otherwise create a new row.
    const existing = await sql`
      SELECT id, check_in_at FROM rsvps
      WHERE event_id = ${eventId} AND LOWER(email) = LOWER(${data.email})
      LIMIT 1
    `

    let rsvpId: string
    let wasAlreadyCheckedIn = false

    if (existing[0]) {
      rsvpId = existing[0].id
      wasAlreadyCheckedIn = !!existing[0].check_in_at
      await sql`
        UPDATE rsvps SET
          name            = ${data.name},
          graduation_year = ${data.graduation_year},
          school          = ${data.school},
          how_heard       = ${data.how_heard},
          whatsapp_joined = ${data.whatsapp_joined},
          check_in_at     = COALESCE(check_in_at, NOW()),
          status          = 'confirmed',
          source          = CASE WHEN source IN ('manual', 'csv_import') THEN source ELSE 'check_in' END,
          updated_at      = NOW()
        WHERE id = ${rsvpId}
      `
    } else {
      const inserted = await sql`
        INSERT INTO rsvps (
          org_id, event_id, name, email, graduation_year, school, how_heard,
          whatsapp_joined, status, guest_count, check_in_at, source
        ) VALUES (
          ${orgId}, ${eventId}, ${data.name}, ${data.email.toLowerCase()},
          ${data.graduation_year}, ${data.school}, ${data.how_heard},
          ${data.whatsapp_joined},
          'confirmed', 1, NOW(), 'check_in'
        )
        RETURNING id
      `
      rsvpId = inserted[0].id
    }

    return Response.json({ data: { rsvp_id: rsvpId, already_checked_in: wasAlreadyCheckedIn } })
  } catch (err) {
    return errorResponse(err)
  }
}
