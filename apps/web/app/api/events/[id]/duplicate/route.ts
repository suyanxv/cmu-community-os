import { NextRequest } from 'next/server'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { ApiError, errorResponse } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id: sourceId } = await params

    // Clone everything except RSVPs, generated content, reminders, timestamps
    const rows = await sql`
      INSERT INTO events (
        org_id, created_by, name, status,
        event_date, end_date, start_time, end_time, timezone,
        location_name, location_address, location_url, is_virtual, event_mode,
        description, speakers, agenda, sponsors,
        tone, target_audience, channels, rsvp_link, rsvp_deadline, max_capacity,
        tags, notes, custom_fields
      )
      SELECT
        org_id, ${ctx.userId}, 'Copy of ' || name, 'draft',
        event_date, end_date, start_time, end_time, timezone,
        location_name, location_address, location_url, is_virtual, event_mode,
        description, speakers, agenda, sponsors,
        tone, target_audience, channels, rsvp_link, rsvp_deadline, max_capacity,
        tags, notes, custom_fields
      FROM events
      WHERE id = ${sourceId} AND org_id = ${ctx.orgId}
      RETURNING id, name
    `

    if (!rows[0]) throw new ApiError(404, 'Event not found')

    logActivity({
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityType: 'event',
      entityId: rows[0].id,
      action: 'created',
      detail: { duplicated_from: sourceId },
    })

    return Response.json({ data: rows[0] }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
