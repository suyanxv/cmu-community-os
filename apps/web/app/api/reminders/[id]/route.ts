import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { errorResponse } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

const UpdateReminderSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  due_date: z.string().optional(),
  assigned_to: z.string().optional().nullable(),
  status: z.enum(['pending', 'done', 'snoozed']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
})

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id } = await params
    const body = await req.json()
    const data = UpdateReminderSchema.parse(body)

    const completedAt = data.status === 'done' ? new Date().toISOString() : undefined
    const completedBy = data.status === 'done' ? ctx.userId : undefined

    const rows = await sql`
      UPDATE reminders SET
        title        = COALESCE(${data.title ?? null}, title),
        description  = CASE WHEN ${'description' in data} THEN ${data.description ?? null} ELSE description END,
        due_date     = COALESCE(${data.due_date ?? null}, due_date),
        assigned_to  = CASE WHEN ${'assigned_to' in data} THEN ${data.assigned_to ?? null} ELSE assigned_to END,
        status       = COALESCE(${data.status ?? null}, status),
        priority     = COALESCE(${data.priority ?? null}, priority),
        completed_at = CASE WHEN ${!!completedAt} THEN ${completedAt ?? null} ELSE completed_at END,
        completed_by = CASE WHEN ${!!completedBy} THEN ${completedBy ?? null} ELSE completed_by END,
        updated_at   = NOW()
      WHERE id = ${id} AND org_id = ${ctx.orgId}
      RETURNING *
    `

    if (data.status === 'done') {
      logActivity({ orgId: ctx.orgId, userId: ctx.userId, entityType: 'reminder', entityId: id, action: 'completed' })
    }

    return Response.json({ data: rows[0] })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id } = await params
    await sql`DELETE FROM reminders WHERE id = ${id} AND org_id = ${ctx.orgId}`
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
