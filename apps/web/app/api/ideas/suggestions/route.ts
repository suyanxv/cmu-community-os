import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { errorResponse } from '@/lib/errors'
import { logActivity } from '@/lib/activity'
import { answerText, fieldsById, isIdeaField } from '@/lib/checkin-insights'
import type { TemplateField } from '@/lib/ai'

// Attendee event suggestions, harvested from check-in answers to
// "what events would you like to see?"-style fields. GET lists the ones
// not yet promoted or dismissed; POST promotes one into the Ideas backlog
// or dismisses it. Handled keys live in organizations.settings so this
// needs no new tables.

interface Suggestion {
  key: string          // `${rsvp_id}:${field_id}` — stable identity for handled-tracking
  text: string
  question: string
  attendee_name: string
  event_id: string
  event_name: string
  event_date: string
}

async function collectSuggestions(orgId: string): Promise<Suggestion[]> {
  const orgRows = await sql`SELECT settings->'handled_attendee_suggestions' AS handled FROM organizations WHERE id = ${orgId}`
  const handled = new Set<string>(Array.isArray(orgRows[0]?.handled) ? orgRows[0].handled as string[] : [])

  const rows = await sql`
    SELECT r.id AS rsvp_id, r.name AS attendee_name, r.check_in_data,
           e.id AS event_id, e.name AS event_name, e.checkin_config,
           to_char(e.event_date, 'YYYY-MM-DD') AS event_date
    FROM rsvps r
    JOIN events e ON e.id = r.event_id
    WHERE r.org_id = ${orgId}
      AND r.check_in_data IS NOT NULL AND r.check_in_data != '{}'::jsonb
    ORDER BY e.event_date DESC, r.created_at DESC
  `

  const suggestions: Suggestion[] = []
  for (const row of rows) {
    const fields = fieldsById(row.checkin_config as { fields?: TemplateField[] } | null)
    const answers = (row.check_in_data ?? {}) as Record<string, unknown>
    for (const [fieldId, raw] of Object.entries(answers)) {
      const field = fields.get(fieldId)
      if (!field || !isIdeaField(field)) continue
      const text = answerText(raw).trim()
      if (text.length < 3) continue
      const key = `${row.rsvp_id}:${fieldId}`
      if (handled.has(key)) continue
      suggestions.push({
        key,
        text,
        question: field.label,
        attendee_name: row.attendee_name as string,
        event_id: row.event_id as string,
        event_name: row.event_name as string,
        event_date: row.event_date as string,
      })
    }
  }
  return suggestions
}

async function markHandled(orgId: string, key: string) {
  await sql`
    UPDATE organizations
    SET settings = jsonb_set(
      COALESCE(settings, '{}'::jsonb),
      '{handled_attendee_suggestions}',
      (
        SELECT jsonb_agg(DISTINCT v)
        FROM jsonb_array_elements(
          COALESCE(settings->'handled_attendee_suggestions', '[]'::jsonb) || to_jsonb(${key}::text)
        ) AS v
      )
    )
    WHERE id = ${orgId}
  `
}

export async function GET() {
  try {
    const ctx = await requireOrgMember()
    const data = await collectSuggestions(ctx.orgId)
    return Response.json({ data })
  } catch (err) {
    return errorResponse(err)
  }
}

const ActionSchema = z.object({
  key: z.string().min(1).max(300),
  action: z.enum(['promote', 'dismiss']),
  title: z.string().min(1).max(200).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireOrgMember()
    const { key, action, title } = ActionSchema.parse(await req.json())

    if (action === 'dismiss') {
      await markHandled(ctx.orgId, key)
      return Response.json({ data: { dismissed: key } })
    }

    // Promote: find the suggestion (validates the key belongs to this org)
    const suggestions = await collectSuggestions(ctx.orgId)
    const s = suggestions.find((x) => x.key === key)
    if (!s) {
      return Response.json({ error: 'Suggestion not found (it may already be handled)' }, { status: 404 })
    }

    const ideaTitle = (title ?? s.text).slice(0, 200)
    const notes = `Suggested by ${s.attendee_name} at ${s.event_name} (check-in question: "${s.question}")`
    const rows = await sql`
      INSERT INTO event_ideas (org_id, title, notes, tags, status, created_by)
      VALUES (${ctx.orgId}, ${ideaTitle}, ${notes}, ${['attendee-suggestion']}, 'open', ${ctx.userId})
      RETURNING *
    `
    await markHandled(ctx.orgId, key)
    logActivity({
      orgId: ctx.orgId, userId: ctx.userId,
      entityType: 'idea', entityId: rows[0].id as string,
      action: 'created', detail: { name: ideaTitle, source: 'attendee_suggestion' },
    })
    return Response.json({ data: rows[0] }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
