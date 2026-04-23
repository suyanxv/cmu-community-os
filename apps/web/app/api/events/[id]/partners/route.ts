import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { errorResponse } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

// List partners linked to this event (with partner detail columns)
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id: eventId } = await params

    const rows = await sql`
      SELECT
        ep.id, ep.partner_id, ep.role, ep.contribution, ep.confirmed,
        p.company_name, p.contact_name, p.email, p.type, p.tier, p.status
      FROM event_partners ep
      JOIN partners p ON p.id = ep.partner_id
      WHERE ep.event_id = ${eventId} AND ep.org_id = ${ctx.orgId}
      ORDER BY p.company_name ASC
    `
    return Response.json({ data: rows })
  } catch (err) {
    return errorResponse(err)
  }
}

const LinkSchema = z.object({
  partner_id: z.string().min(1),
  role: z.string().optional().nullable(),
  contribution: z.string().optional().nullable(),
  confirmed: z.boolean().optional().default(false),
})

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id: eventId } = await params
    const body = await req.json()
    const data = LinkSchema.parse(body)

    const rows = await sql`
      INSERT INTO event_partners (org_id, event_id, partner_id, role, contribution, confirmed)
      VALUES (${ctx.orgId}, ${eventId}, ${data.partner_id},
              ${data.role ?? null}, ${data.contribution ?? null}, ${data.confirmed ?? false})
      ON CONFLICT (event_id, partner_id) DO UPDATE SET
        role         = EXCLUDED.role,
        contribution = EXCLUDED.contribution,
        confirmed    = EXCLUDED.confirmed
      RETURNING *
    `

    logActivity({
      orgId: ctx.orgId, userId: ctx.userId,
      entityType: 'event', entityId: eventId,
      action: 'updated', detail: { linked_partner: data.partner_id },
    })

    return Response.json({ data: rows[0] }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
