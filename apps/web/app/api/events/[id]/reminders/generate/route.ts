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

    const today = new Date().toISOString().slice(0, 10)
    const eventYmd = event.event_date instanceof Date
      ? event.event_date.toISOString().slice(0, 10)
      : String(event.event_date).slice(0, 10)
    if (eventYmd < today) {
      throw new ApiError(422, 'This event already happened — reminders can only be suggested for upcoming events.')
    }

    const suggestions = await generateReminderSchedule(
      event.name,
      event.event_date,
      event.channels as string[]
    )

    // The AI schedules backwards from the event date, which can produce due
    // dates that are already gone for events happening soon. Clamp to today.
    const clamped = suggestions.map((s: { due_date?: string }) =>
      s.due_date && s.due_date.slice(0, 10) < today ? { ...s, due_date: today } : s
    )

    // Return suggestions without auto-saving — frontend shows them for user confirmation
    return Response.json({ data: clamped })
  } catch (err) {
    return errorResponse(err)
  }
}
