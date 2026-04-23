import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { generatePartnerEmailDraft } from '@/lib/ai'
import { ApiError, errorResponse } from '@/lib/errors'

const DraftEmailSchema = z.object({
  event_id: z.string().optional().nullable(),
  purpose: z.string().min(1),
  tone: z.string().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id: partnerId } = await params

    const partner = await sql`SELECT * FROM partners WHERE id = ${partnerId} AND org_id = ${ctx.orgId}`
    if (!partner[0]) throw new ApiError(404, 'Partner not found')

    const org = await sql`SELECT name FROM organizations WHERE id = ${ctx.orgId}`
    const body = await req.json()
    const data = DraftEmailSchema.parse(body)

    let eventName: string | null = null
    if (data.event_id) {
      const ev = await sql`SELECT name FROM events WHERE id = ${data.event_id} AND org_id = ${ctx.orgId}`
      eventName = ev[0]?.name ?? null
    }

    const draft = await generatePartnerEmailDraft({
      orgName: org[0].name,
      partnerCompany: partner[0].company_name,
      partnerContact: partner[0].contact_name,
      eventName,
      purpose: data.purpose,
      tone: data.tone,
    })

    return Response.json({ data: draft })
  } catch (err) {
    return errorResponse(err)
  }
}
