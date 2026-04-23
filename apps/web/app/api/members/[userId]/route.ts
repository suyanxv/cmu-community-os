import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOrgMember, requireAdmin } from '@/lib/auth'
import { sql } from '@/lib/db'
import { ApiError, errorResponse } from '@/lib/errors'

type Params = { params: Promise<{ userId: string }> }

const UpdateSchema = z.object({
  role: z.enum(['admin', 'editor']).optional(),
  title: z.string().max(80).optional().nullable().transform((v) => (v === undefined ? undefined : v || null)),
})

/**
 * PATCH /api/members/:userId
 *  - Anyone can update their OWN title.
 *  - Only admins can change role or another member's title.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { userId } = await params
    const data = UpdateSchema.parse(await req.json())

    const isSelf = userId === ctx.userId
    const isAdmin = ctx.role === 'admin'

    if (data.role !== undefined && !isAdmin) {
      throw new ApiError(403, 'Only admins can change roles')
    }
    if (!isSelf && !isAdmin) {
      throw new ApiError(403, 'You can only update your own title')
    }

    // Prevent demoting the last admin
    if (data.role && data.role !== 'admin' && isSelf) {
      const adminCount = await sql`
        SELECT COUNT(*)::int AS count FROM org_members
        WHERE org_id = ${ctx.orgId} AND role = 'admin'
      `
      if (adminCount[0].count <= 1) {
        throw new ApiError(400, 'Cannot remove the last admin role')
      }
    }

    const rows = await sql`
      UPDATE org_members SET
        role  = COALESCE(${data.role ?? null}, role),
        title = CASE WHEN ${'title' in data} THEN ${data.title ?? null} ELSE title END
      WHERE org_id = ${ctx.orgId} AND user_id = ${userId}
      RETURNING id, role, title
    `

    if (!rows[0]) throw new ApiError(404, 'Member not found')
    return Response.json({ data: rows[0] })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAdmin()
    const { userId } = await params

    // Prevent removing the last admin
    const adminCount = await sql`
      SELECT COUNT(*)::int AS count FROM org_members
      WHERE org_id = ${ctx.orgId} AND role = 'admin'
    `
    const targetMember = await sql`
      SELECT role FROM org_members WHERE org_id = ${ctx.orgId} AND user_id = ${userId}
    `
    if (targetMember[0]?.role === 'admin' && adminCount[0].count <= 1) {
      throw new ApiError(400, 'Cannot remove the last admin')
    }

    await sql`DELETE FROM org_members WHERE org_id = ${ctx.orgId} AND user_id = ${userId}`
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
