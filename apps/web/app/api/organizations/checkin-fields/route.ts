import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { errorResponse } from '@/lib/errors'
import type { TemplateField } from '@/lib/ai'

// Distinct check-in form fields this org has used across past events,
// most recently used first. Powers the "quick add from past events"
// chips in the event form's check-in section.
export async function GET() {
  try {
    const ctx = await requireOrgMember()

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
        if (!f?.id || !f?.label || seen.has(f.id)) continue
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
