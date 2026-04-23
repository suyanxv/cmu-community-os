import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { errorResponse } from '@/lib/errors'

const BulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
})

// Admin only — matches the single-event DELETE permission
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const { ids } = BulkDeleteSchema.parse(await req.json())

    const res = await sql`
      DELETE FROM events
      WHERE org_id = ${ctx.orgId}
        AND id = ANY(${ids}::uuid[])
      RETURNING id
    `
    const deleted = res.map((r) => r.id as string)

    for (const id of deleted) {
      logActivity({ orgId: ctx.orgId, userId: ctx.userId, entityType: 'event', entityId: id, action: 'deleted' })
    }

    return Response.json({ data: { deleted: deleted.length, ids: deleted } })
  } catch (err) {
    return errorResponse(err)
  }
}
