import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { ApiError, errorResponse } from '@/lib/errors'
import { logActivity } from '@/lib/activity'

type Params = { params: Promise<{ id: string }> }

const UpdateIdeaSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  notes: z.string().optional().nullable(),
  target_season: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['open', 'planning', 'promoted', 'archived']).optional(),
})

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id } = await params
    const rows = await sql`
      SELECT i.*, e.name AS event_name, e.status AS event_status
      FROM event_ideas i
      LEFT JOIN events e ON e.id = i.converted_event_id
      WHERE i.id = ${id} AND i.org_id = ${ctx.orgId}
    `
    if (!rows[0]) throw new ApiError(404, 'Idea not found')
    return Response.json({ data: rows[0] })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id } = await params
    const body = await req.json()
    const data = UpdateIdeaSchema.parse(body)

    const rows = await sql`
      UPDATE event_ideas SET
        title         = COALESCE(${data.title ?? null}, title),
        notes         = CASE WHEN ${'notes' in data} THEN ${data.notes ?? null} ELSE notes END,
        target_season = CASE WHEN ${'target_season' in data} THEN ${data.target_season ?? null} ELSE target_season END,
        tags          = COALESCE(${data.tags ?? null}, tags),
        status        = COALESCE(${data.status ?? null}, status),
        updated_at    = NOW()
      WHERE id = ${id} AND org_id = ${ctx.orgId}
      RETURNING *
    `
    if (!rows[0]) throw new ApiError(404, 'Idea not found')

    logActivity({
      orgId: ctx.orgId, userId: ctx.userId,
      entityType: 'idea', entityId: id,
      action: 'updated', detail: {},
    })
    return Response.json({ data: rows[0] })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id } = await params
    await sql`DELETE FROM event_ideas WHERE id = ${id} AND org_id = ${ctx.orgId}`
    logActivity({
      orgId: ctx.orgId, userId: ctx.userId,
      entityType: 'idea', entityId: id,
      action: 'deleted', detail: {},
    })
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
