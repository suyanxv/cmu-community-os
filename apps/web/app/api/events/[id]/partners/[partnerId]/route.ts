import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { errorResponse } from '@/lib/errors'

type Params = { params: Promise<{ id: string; partnerId: string }> }

const UpdateSchema = z.object({
  role: z.string().optional().nullable(),
  contribution: z.string().optional().nullable(),
  confirmed: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id: eventId, partnerId } = await params
    const body = await req.json()
    const data = UpdateSchema.parse(body)

    const rows = await sql`
      UPDATE event_partners SET
        role         = CASE WHEN ${'role' in data} THEN ${data.role ?? null} ELSE role END,
        contribution = CASE WHEN ${'contribution' in data} THEN ${data.contribution ?? null} ELSE contribution END,
        confirmed    = COALESCE(${data.confirmed ?? null}, confirmed)
      WHERE event_id = ${eventId} AND partner_id = ${partnerId} AND org_id = ${ctx.orgId}
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
    const { id: eventId, partnerId } = await params
    await sql`
      DELETE FROM event_partners
      WHERE event_id = ${eventId} AND partner_id = ${partnerId} AND org_id = ${ctx.orgId}
    `
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
