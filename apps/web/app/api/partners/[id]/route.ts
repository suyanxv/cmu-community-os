import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOrgMember, requireAdmin } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { ApiError, errorResponse } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

const UpdatePartnerSchema = z.object({
  company_name: z.string().min(1).optional(),
  contact_name: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  linkedin_url: z.string().url().optional().nullable(),
  website: z.string().url().optional().nullable(),
  type: z.enum(['sponsor', 'venue', 'media', 'co_host', 'other']).optional(),
  tier: z.string().optional().nullable(),
  status: z.enum(['prospect', 'active', 'past', 'declined']).optional(),
  notes: z.string().optional().nullable(),
})

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id } = await params

    const partner = await sql`SELECT * FROM partners WHERE id = ${id} AND org_id = ${ctx.orgId}`
    if (!partner[0]) throw new ApiError(404, 'Partner not found')

    const comms = await sql`
      SELECT pc.*, e.name AS event_name
      FROM partner_communications pc
      LEFT JOIN events e ON e.id = pc.event_id
      WHERE pc.partner_id = ${id} AND pc.org_id = ${ctx.orgId}
      ORDER BY pc.created_at DESC
      LIMIT 50
    `

    const eventLinks = await sql`
      SELECT ep.*, e.name AS event_name, e.event_date
      FROM event_partners ep
      JOIN events e ON e.id = ep.event_id
      WHERE ep.partner_id = ${id} AND ep.org_id = ${ctx.orgId}
      ORDER BY e.event_date DESC
    `

    return Response.json({ data: { ...partner[0], communications: comms, events: eventLinks } })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id } = await params
    const body = await req.json()
    const data = UpdatePartnerSchema.parse(body)

    const rows = await sql`
      UPDATE partners SET
        company_name  = COALESCE(${data.company_name ?? null}, company_name),
        contact_name  = CASE WHEN ${'contact_name' in data} THEN ${data.contact_name ?? null} ELSE contact_name END,
        email         = CASE WHEN ${'email' in data} THEN ${data.email ?? null} ELSE email END,
        phone         = CASE WHEN ${'phone' in data} THEN ${data.phone ?? null} ELSE phone END,
        linkedin_url  = CASE WHEN ${'linkedin_url' in data} THEN ${data.linkedin_url ?? null} ELSE linkedin_url END,
        website       = CASE WHEN ${'website' in data} THEN ${data.website ?? null} ELSE website END,
        type          = COALESCE(${data.type ?? null}, type),
        tier          = CASE WHEN ${'tier' in data} THEN ${data.tier ?? null} ELSE tier END,
        status        = COALESCE(${data.status ?? null}, status),
        notes         = CASE WHEN ${'notes' in data} THEN ${data.notes ?? null} ELSE notes END,
        updated_at    = NOW()
      WHERE id = ${id} AND org_id = ${ctx.orgId}
      RETURNING *
    `

    logActivity({ orgId: ctx.orgId, userId: ctx.userId, entityType: 'partner', entityId: id, action: 'updated' })
    return Response.json({ data: rows[0] })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAdmin()
    const { id } = await params
    await sql`DELETE FROM partners WHERE id = ${id} AND org_id = ${ctx.orgId}`
    logActivity({ orgId: ctx.orgId, userId: ctx.userId, entityType: 'partner', entityId: id, action: 'deleted' })
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
