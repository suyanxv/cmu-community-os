import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { errorResponse } from '@/lib/errors'
import type { TemplateField } from '@/lib/ai'

// Distinct check-in form fields this org has used across past events,
// most recently used first. Powers the "quick add from past events"
// chips in the event form's check-in section. Fields the org dismissed
// (via DELETE below) are excluded.
export async function GET() {
  try {
    const ctx = await requireOrgMember()

    const orgRows = await sql`SELECT settings->'dismissed_checkin_field_ids' AS dismissed FROM organizations WHERE id = ${ctx.orgId}`
    const dismissed = new Set<string>(Array.isArray(orgRows[0]?.dismissed) ? orgRows[0].dismissed as string[] : [])

    const rows = await sql`
      SELECT checkin_config->'fields' AS fields
      FROM events
      WHERE org_id = ${ctx.orgId}
        AND jsonb_typeof(checkin_config->'fields') = 'array'
      ORDER BY created_at DESC
      LIMIT 50
    `

    const seen = new Map<string, TemplateField>()
    for (const row of rows) {
      const fields = row.fields as TemplateField[]
      for (const f of fields) {
        if (!f?.id || !f?.label || seen.has(f.id) || dismissed.has(f.id)) continue
        // Skip fields the organizer never renamed from the editor default —
        // they're noise, not something worth offering for reuse.
        if (f.label.trim() === 'New field') continue
        seen.set(f.id, f)
      }
    }

    return Response.json({ data: [...seen.values()] })
  } catch (err) {
    return errorResponse(err)
  }
}

const DismissSchema = z.object({
  id: z.string().min(1).max(200),
})

// Dismiss a field from the suggestions org-wide. Doesn't touch any event's
// saved checkin_config — only hides the chip from future suggestion lists.
export async function DELETE(req: NextRequest) {
  try {
    const ctx = await requireOrgMember()
    const { id } = DismissSchema.parse(await req.json())

    await sql`
      UPDATE organizations
      SET settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{dismissed_checkin_field_ids}',
        (
          SELECT jsonb_agg(DISTINCT v)
          FROM jsonb_array_elements(
            COALESCE(settings->'dismissed_checkin_field_ids', '[]'::jsonb) || to_jsonb(${id}::text)
          ) AS v
        )
      )
      WHERE id = ${ctx.orgId}
    `

    return Response.json({ data: { dismissed: id } })
  } catch (err) {
    return errorResponse(err)
  }
}
