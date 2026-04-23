import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { errorResponse } from '@/lib/errors'

type Params = { params: Promise<{ id: string; rsvpId: string }> }

const UpdateRsvpSchema = z.object({
  status: z.enum(['confirmed', 'waitlist', 'cancelled']).optional(),
  guest_count: z.number().int().min(1).optional(),
  notes: z.string().optional().nullable(),
})

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id: eventId, rsvpId } = await params
    const body = await req.json()
    const data = UpdateRsvpSchema.parse(body)

    const rows = await sql`
      UPDATE rsvps SET
        status      = COALESCE(${data.status ?? null}, status),
        guest_count = COALESCE(${data.guest_count ?? null}, guest_count),
        notes       = CASE WHEN ${'notes' in data} THEN ${data.notes ?? null} ELSE notes END,
        updated_at  = NOW()
      WHERE id = ${rsvpId} AND event_id = ${eventId} AND org_id = ${ctx.orgId}
      RETURNING *
    `
    return Response.json({ data: rows[0] })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id: eventId, rsvpId } = await params
    await sql`DELETE FROM rsvps WHERE id = ${rsvpId} AND event_id = ${eventId} AND org_id = ${ctx.orgId}`
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
