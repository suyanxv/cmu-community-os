import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin, requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { errorResponse } from '@/lib/errors'

export interface ReminderTemplate {
  id: string
  title: string
  description?: string
  days_before: number   // e.g. 30 for "1 month before"; negative for "after"
  priority: 'high' | 'medium' | 'low'
}

const TemplateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(''),
  days_before: z.number().int().min(-365).max(365),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
})

const SaveSchema = z.object({
  templates: z.array(TemplateSchema),
})

export async function GET() {
  try {
    const ctx = await requireOrgMember()
    const rows = await sql`
      SELECT settings->'reminder_templates' AS templates
      FROM organizations WHERE id = ${ctx.orgId}
    `
    return Response.json({ data: rows[0]?.templates ?? [] })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const { templates } = SaveSchema.parse(await req.json())
    await sql`
      UPDATE organizations
      SET settings = jsonb_set(settings, '{reminder_templates}', ${JSON.stringify(templates)}::jsonb),
          updated_at = NOW()
      WHERE id = ${ctx.orgId}
    `
    return Response.json({ data: templates })
  } catch (err) {
    return errorResponse(err)
  }
}
