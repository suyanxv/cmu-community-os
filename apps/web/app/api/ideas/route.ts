import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { errorResponse } from '@/lib/errors'
import { logActivity } from '@/lib/activity'

const CreateIdeaSchema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().optional().nullable().transform((v) => v || null),
  target_season: z.string().optional().nullable().transform((v) => v || null),
  tags: z.array(z.string()).optional().default([]),
  status: z.enum(['open', 'planning', 'promoted', 'archived']).optional().default('open'),
})

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireOrgMember()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const rows = await sql`
      SELECT
        i.*,
        u.full_name AS created_by_name,
        e.id AS event_id, e.name AS event_name, e.status AS event_status
      FROM event_ideas i
      LEFT JOIN users u ON u.id = i.created_by
      LEFT JOIN events e ON e.id = i.converted_event_id
      WHERE i.org_id = ${ctx.orgId}
        ${status ? sql`AND i.status = ${status}` : sql``}
      ORDER BY
        CASE i.status WHEN 'open' THEN 0 WHEN 'planning' THEN 1 WHEN 'promoted' THEN 2 ELSE 3 END,
        i.updated_at DESC
    `
    return Response.json({ data: rows })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireOrgMember()
    const body = await req.json()
    const data = CreateIdeaSchema.parse(body)

    const rows = await sql`
      INSERT INTO event_ideas (org_id, title, notes, target_season, tags, status, created_by)
      VALUES (${ctx.orgId}, ${data.title}, ${data.notes}, ${data.target_season}, ${data.tags}, ${data.status}, ${ctx.userId})
      RETURNING *
    `
    logActivity({
      orgId: ctx.orgId, userId: ctx.userId,
      entityType: 'idea', entityId: rows[0].id as string,
      action: 'created', detail: { title: data.title },
    })
    return Response.json({ data: rows[0] }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
