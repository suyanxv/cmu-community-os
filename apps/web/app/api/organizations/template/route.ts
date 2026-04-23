import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin, requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { parseEventTemplate } from '@/lib/ai'
import { logActivity } from '@/lib/activity'
import { errorResponse } from '@/lib/errors'

const ParseSchema = z.object({
  input: z.string().min(1),
})

// Parse pasted form content / URL into a field schema (admin only)
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const { input } = ParseSchema.parse(await req.json())
    const fields = await parseEventTemplate(input)
    return Response.json({ data: fields })
  } catch (err) {
    return errorResponse(err)
  }
}

// Save the parsed template schema to org settings (admin only)
const SaveSchema = z.object({
  fields: z.array(z.any()),
})

export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const { fields } = SaveSchema.parse(await req.json())

    await sql`
      UPDATE organizations
      SET settings = jsonb_set(settings, '{event_template_schema}', ${JSON.stringify(fields)}::jsonb),
          updated_at = NOW()
      WHERE id = ${ctx.orgId}
    `

    logActivity({ orgId: ctx.orgId, userId: ctx.userId, entityType: 'event', entityId: ctx.orgId, action: 'updated', detail: { type: 'template', count: fields.length } })
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}

// Clear the template (admin only) — reverts to default form
export async function DELETE() {
  try {
    const ctx = await requireAdmin()
    await sql`
      UPDATE organizations
      SET settings = settings - 'event_template_schema',
          updated_at = NOW()
      WHERE id = ${ctx.orgId}
    `
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}

// Anyone in the org can read the template (used by form renderer)
export async function GET() {
  try {
    const ctx = await requireOrgMember()
    const rows = await sql`
      SELECT settings->'event_template_schema' AS schema
      FROM organizations WHERE id = ${ctx.orgId}
    `
    return Response.json({ data: rows[0]?.schema ?? null })
  } catch (err) {
    return errorResponse(err)
  }
}
