import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { errorResponse } from '@/lib/errors'

const CreateReminderSchema = z.object({
  event_id: z.string().optional().nullable(),
  assigned_to: z.string().optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  due_date: z.string(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  ai_generated: z.boolean().default(false),
})

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireOrgMember()
    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get('event_id')
    const assignedToMe = searchParams.get('assigned_to') === 'me'
    const status = searchParams.get('status')
    const dueBefore = searchParams.get('due_before')

    const reminders = await sql`
      SELECT rem.*, u.full_name AS assigned_to_name, e.name AS event_name
      FROM reminders rem
      LEFT JOIN users u ON u.id = rem.assigned_to
      LEFT JOIN events e ON e.id = rem.event_id
      WHERE rem.org_id = ${ctx.orgId}
        ${eventId ? sql`AND rem.event_id = ${eventId}` : sql``}
        ${assignedToMe ? sql`AND rem.assigned_to = ${ctx.userId}` : sql``}
        ${status ? sql`AND rem.status = ${status}` : sql``}
        ${dueBefore ? sql`AND rem.due_date <= ${dueBefore}` : sql``}
      ORDER BY rem.due_date ASC
    `
    return Response.json({ data: reminders })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireOrgMember()
    const body = await req.json()
    const data = CreateReminderSchema.parse(body)

    const rows = await sql`
      INSERT INTO reminders (org_id, event_id, assigned_to, title, description, due_date, priority, ai_generated, created_by)
      VALUES (${ctx.orgId}, ${data.event_id ?? null}, ${data.assigned_to ?? null},
              ${data.title}, ${data.description ?? null}, ${data.due_date},
              ${data.priority}, ${data.ai_generated}, ${ctx.userId})
      RETURNING *
    `
    logActivity({ orgId: ctx.orgId, userId: ctx.userId, entityType: 'reminder', entityId: rows[0].id, action: 'created' })
    return Response.json({ data: rows[0] }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
