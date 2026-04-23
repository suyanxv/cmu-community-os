import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { errorResponse } from '@/lib/errors'

const CreatePartnerSchema = z.object({
  company_name: z.string().min(1),
  contact_name: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  linkedin_url: z.string().url().optional().nullable(),
  website: z.string().url().optional().nullable(),
  type: z.enum(['sponsor', 'venue', 'media', 'co_host', 'other']).default('sponsor'),
  tier: z.string().optional().nullable(),
  status: z.enum(['prospect', 'active', 'past', 'declined']).default('prospect'),
  notes: z.string().optional().nullable(),
})

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireOrgMember()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')

    const partners = await sql`
      SELECT *
      FROM partners
      WHERE org_id = ${ctx.orgId}
        ${status ? sql`AND status = ${status}` : sql``}
        ${type ? sql`AND type = ${type}` : sql``}
      ORDER BY company_name ASC
    `
    return Response.json({ data: partners })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireOrgMember()
    const body = await req.json()
    const data = CreatePartnerSchema.parse(body)

    const rows = await sql`
      INSERT INTO partners (org_id, company_name, contact_name, email, phone, linkedin_url, website, type, tier, status, notes, created_by)
      VALUES (${ctx.orgId}, ${data.company_name}, ${data.contact_name ?? null}, ${data.email ?? null},
              ${data.phone ?? null}, ${data.linkedin_url ?? null}, ${data.website ?? null},
              ${data.type}, ${data.tier ?? null}, ${data.status}, ${data.notes ?? null}, ${ctx.userId})
      RETURNING *
    `

    logActivity({ orgId: ctx.orgId, userId: ctx.userId, entityType: 'partner', entityId: rows[0].id, action: 'created' })
    return Response.json({ data: rows[0] }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
