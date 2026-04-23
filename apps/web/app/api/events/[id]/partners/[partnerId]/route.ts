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

    // Fetch the row first so we know the role + partner name. If the row
    // was linked as a co_host, we also scrub the name from events.co_hosts
    // to avoid leaving a zombie chip on the event detail page.
    const existing = await sql`
      SELECT ep.role, p.company_name
      FROM event_partners ep
      JOIN partners p ON p.id = ep.partner_id
      WHERE ep.event_id = ${eventId} AND ep.partner_id = ${partnerId} AND ep.org_id = ${ctx.orgId}
    `

    await sql`
      DELETE FROM event_partners
      WHERE event_id = ${eventId} AND partner_id = ${partnerId} AND org_id = ${ctx.orgId}
    `

    if (existing[0]?.role === 'co_host' && existing[0].company_name) {
      const companyName = existing[0].company_name as string
      await sql`
        UPDATE events
        SET co_hosts = ARRAY(
          SELECT unnest(co_hosts) AS ch WHERE LOWER(ch) <> LOWER(${companyName})
        )
        WHERE id = ${eventId} AND org_id = ${ctx.orgId}
      `
    }

    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
