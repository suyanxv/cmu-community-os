import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { sql } from '@/lib/db'
import { ApiError, errorResponse } from '@/lib/errors'

type Params = { params: Promise<{ userId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAdmin()
    const { userId } = await params
    const { role } = z.object({ role: z.enum(['admin', 'editor']) }).parse(await req.json())

    await sql`
      UPDATE org_members SET role = ${role}
      WHERE org_id = ${ctx.orgId} AND user_id = ${userId}
    `
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAdmin()
    const { userId } = await params

    // Prevent removing the last admin
    if (userId === ctx.userId) {
      const adminCount = await sql`
        SELECT COUNT(*)::int AS count FROM org_members
        WHERE org_id = ${ctx.orgId} AND role = 'admin'
      `
      if (adminCount[0].count <= 1) {
        throw new ApiError(400, 'Cannot remove the last admin')
      }
    }

    await sql`DELETE FROM org_members WHERE org_id = ${ctx.orgId} AND user_id = ${userId}`
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
