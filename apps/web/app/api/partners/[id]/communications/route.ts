import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { errorResponse } from '@/lib/errors'

const CreateCommSchema = z.object({
  type: z.enum(['email', 'call', 'meeting', 'note']),
  direction: z.enum(['outbound', 'inbound']).optional().nullable(),
  subject: z.string().optional().nullable(),
  body: z.string().min(1),
  event_id: z.string().optional().nullable(),
  ai_drafted: z.boolean().default(false),
  sent_at: z.string().optional().nullable(),
})

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id: partnerId } = await params
    const body = await req.json()
    const data = CreateCommSchema.parse(body)

    const rows = await sql`
      INSERT INTO partner_communications (org_id, partner_id, event_id, type, direction, subject, body, ai_drafted, sent_at, created_by)
      VALUES (${ctx.orgId}, ${partnerId}, ${data.event_id ?? null}, ${data.type},
              ${data.direction ?? null}, ${data.subject ?? null}, ${data.body},
              ${data.ai_drafted}, ${data.sent_at ?? null}, ${ctx.userId})
      RETURNING *
    `
    return Response.json({ data: rows[0] }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
