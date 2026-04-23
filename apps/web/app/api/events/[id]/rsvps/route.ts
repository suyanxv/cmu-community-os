import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { errorResponse } from '@/lib/errors'

const CreateRsvpSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  status: z.enum(['confirmed', 'waitlist', 'cancelled']).default('confirmed'),
  guest_count: z.number().int().min(1).default(1),
  notes: z.string().optional().nullable(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id: eventId } = await params
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const rsvps = await sql`
      SELECT *
      FROM rsvps
      WHERE event_id = ${eventId} AND org_id = ${ctx.orgId}
        ${status ? sql`AND status = ${status}` : sql``}
      ORDER BY created_at DESC
    `

    const summary = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
        COUNT(*) FILTER (WHERE status = 'waitlist')::int  AS waitlist,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
        COALESCE(SUM(guest_count) FILTER (WHERE status = 'confirmed'), 0)::int AS total_guests
      FROM rsvps
      WHERE event_id = ${eventId} AND org_id = ${ctx.orgId}
    `

    return Response.json({ data: rsvps, summary: summary[0] })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id: eventId } = await params
    const body = await req.json()
    const data = CreateRsvpSchema.parse(body)

    const rows = await sql`
      INSERT INTO rsvps (org_id, event_id, name, email, phone, status, guest_count, notes)
      VALUES (${ctx.orgId}, ${eventId}, ${data.name}, ${data.email ?? null}, ${data.phone ?? null},
              ${data.status}, ${data.guest_count}, ${data.notes ?? null})
      RETURNING *
    `

    logActivity({ orgId: ctx.orgId, userId: ctx.userId, entityType: 'rsvp', entityId: rows[0].id, action: 'created', detail: { name: data.name } })
    return Response.json({ data: rows[0] }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
