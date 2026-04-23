import { NextRequest } from 'next/server'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { ApiError, errorResponse } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id } = await params

    const rows = await sql`
      SELECT * FROM broadcasts WHERE id = ${id} AND org_id = ${ctx.orgId}
    `
    if (!rows[0]) throw new ApiError(404, 'Broadcast not found')

    let deliveries: Array<Record<string, unknown>> = []
    if (rows[0].channel === 'email') {
      deliveries = await sql`
        SELECT id, recipient_email, recipient_name, status, sent_at, opened_at, clicked_at, error
        FROM email_deliveries
        WHERE broadcast_id = ${id}
        ORDER BY sent_at DESC NULLS LAST, created_at DESC
      `
    }

    return Response.json({ data: rows[0], deliveries })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id } = await params
    await sql`DELETE FROM broadcasts WHERE id = ${id} AND org_id = ${ctx.orgId}`
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
