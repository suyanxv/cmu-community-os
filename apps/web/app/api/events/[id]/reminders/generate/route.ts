import { NextRequest } from 'next/server'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { generateReminderSchedule } from '@/lib/ai'
import { ApiError, errorResponse } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id: eventId } = await params

    const events = await sql`SELECT name, event_date, channels FROM events WHERE id = ${eventId} AND org_id = ${ctx.orgId}`
    if (!events[0]) throw new ApiError(404, 'Event not found')
    const event = events[0]

    const suggestions = await generateReminderSchedule(
      event.name,
      event.event_date,
      event.channels as string[]
    )

    // Return suggestions without auto-saving — frontend shows them for user confirmation
    return Response.json({ data: suggestions })
  } catch (err) {
    return errorResponse(err)
  }
}
