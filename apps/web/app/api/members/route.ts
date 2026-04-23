import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { errorResponse } from '@/lib/errors'

export async function GET() {
  try {
    const ctx = await requireOrgMember()

    const members = await sql`
      SELECT
        om.id, om.role, om.title, om.joined_at,
        u.id AS user_id, u.full_name, u.email, u.avatar_url
      FROM org_members om
      JOIN users u ON u.id = om.user_id
      WHERE om.org_id = ${ctx.orgId}
      ORDER BY om.joined_at ASC
    `
    return Response.json({ data: members, currentUserId: ctx.userId })
  } catch (err) {
    return errorResponse(err)
  }
}
