import { NextRequest } from 'next/server'
import { requireOrgMember, requireAdmin } from '@/lib/auth'
import { sql } from '@/lib/db'
import { errorResponse } from '@/lib/errors'

export async function GET() {
  try {
    const ctx = await requireOrgMember()
    const rows = await sql`SELECT * FROM organizations WHERE id = ${ctx.orgId}`
    return Response.json({ data: rows[0] })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const body = await req.json()
    const { name, settings } = body

    const rows = await sql`
      UPDATE organizations SET
        name       = COALESCE(${name ?? null}, name),
        settings   = CASE WHEN ${!!settings} THEN ${JSON.stringify(settings)} ELSE settings END,
        updated_at = NOW()
      WHERE id = ${ctx.orgId}
      RETURNING *
    `
    return Response.json({ data: rows[0] })
  } catch (err) {
    return errorResponse(err)
  }
}
