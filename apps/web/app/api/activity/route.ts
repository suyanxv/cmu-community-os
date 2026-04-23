import { NextRequest } from 'next/server'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { errorResponse } from '@/lib/errors'

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireOrgMember()
    const { searchParams } = new URL(req.url)
    const entityType = searchParams.get('entity_type')
    const entityId = searchParams.get('entity_id')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

    const activity = await sql`
      SELECT al.*, u.full_name AS user_name, u.avatar_url
      FROM activity_log al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.org_id = ${ctx.orgId}
        ${entityType ? sql`AND al.entity_type = ${entityType}` : sql``}
        ${entityId ? sql`AND al.entity_id = ${entityId}` : sql``}
      ORDER BY al.created_at DESC
      LIMIT ${limit}
    `
    return Response.json({ data: activity })
  } catch (err) {
    return errorResponse(err)
  }
}
