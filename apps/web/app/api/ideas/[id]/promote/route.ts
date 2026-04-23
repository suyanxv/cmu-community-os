import { NextRequest } from 'next/server'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { ApiError, errorResponse } from '@/lib/errors'
import { logActivity } from '@/lib/activity'

type Params = { params: Promise<{ id: string }> }

// Creates a draft event from an idea and marks the idea as promoted, linking
// both. The user lands on the event edit page to fill in dates/location — the
// idea only has title + notes + tags, not enough to be a complete event yet.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id } = await params

    const ideas = await sql`
      SELECT * FROM event_ideas WHERE id = ${id} AND org_id = ${ctx.orgId}
    `
    if (!ideas[0]) throw new ApiError(404, 'Idea not found')
    const idea = ideas[0]

    if (idea.status === 'promoted' && idea.converted_event_id) {
      // Idempotent: if already promoted, just return the linked event id.
      return Response.json({ data: { event_id: idea.converted_event_id } })
    }

    // Create a bare draft event from the idea. Placeholder date = today so the
    // NOT NULL event_date constraint passes; the user will update it via edit.
    const tags = Array.isArray(idea.tags) ? idea.tags : []
    const events = await sql`
      INSERT INTO events (
        org_id, created_by, name, event_date, start_time, timezone,
        is_virtual, event_mode, description, tone, channels,
        tags, category, status
      ) VALUES (
        ${ctx.orgId}, ${ctx.userId}, ${idea.title},
        CURRENT_DATE, '18:00', 'America/Los_Angeles',
        false, 'in_person', ${idea.notes ?? null}, 'professional-warm', ${['whatsapp', 'email']},
        ${tags}, 'internal', 'draft'
      )
      RETURNING id
    `
    const eventId = events[0].id as string

    // Every event needs at least one host. Default to the user promoting it.
    await sql`
      INSERT INTO event_hosts (org_id, event_id, user_id)
      VALUES (${ctx.orgId}, ${eventId}, ${ctx.userId})
      ON CONFLICT (event_id, user_id) DO NOTHING
    `

    await sql`
      UPDATE event_ideas
      SET status = 'promoted', converted_event_id = ${eventId}, updated_at = NOW()
      WHERE id = ${id} AND org_id = ${ctx.orgId}
    `

    logActivity({
      orgId: ctx.orgId, userId: ctx.userId,
      entityType: 'idea', entityId: id,
      action: 'promoted', detail: { event_id: eventId, title: idea.title },
    })

    return Response.json({ data: { event_id: eventId } })
  } catch (err) {
    return errorResponse(err)
  }
}
