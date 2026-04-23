import { sql } from '@/lib/db'

interface ReminderTemplate {
  id: string
  title: string
  description?: string
  days_before: number
  priority: 'high' | 'medium' | 'low'
}

/**
 * Apply org-level reminder templates to a newly-created event.
 *
 * For each template:
 *   - due_date = event_date - days_before
 *   - If due_date is in the future → insert as pending
 *   - If due_date is in the past → insert as done, with a "[Not applicable]" prefix
 *
 * Non-fatal: errors are logged but swallowed so event creation isn't blocked.
 */
export async function applyReminderTemplates(params: {
  orgId: string
  eventId: string
  eventDate: string   // YYYY-MM-DD
  createdBy: string
}): Promise<void> {
  try {
    const orgRows = await sql`
      SELECT settings->'reminder_templates' AS templates
      FROM organizations WHERE id = ${params.orgId}
    `
    const templates = (orgRows[0]?.templates as ReminderTemplate[] | null) ?? []
    if (templates.length === 0) return

    const [y, m, d] = params.eventDate.slice(0, 10).split('-').map(Number)
    if (!y || !m || !d) return
    const eventMs = Date.UTC(y, m - 1, d)
    const now = new Date()
    const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

    for (const tpl of templates) {
      if (!tpl.title) continue
      const dueMs = eventMs - tpl.days_before * 86_400_000
      const dueDate = new Date(dueMs).toISOString().slice(0, 10)
      const isPastDue = dueMs < todayMs
      const status = isPastDue ? 'done' : 'pending'
      const description = isPastDue
        ? `[Not applicable — due date was already past at event creation] ${tpl.description ?? ''}`.trim()
        : (tpl.description ?? null)

      await sql`
        INSERT INTO reminders (
          org_id, event_id, assigned_to, title, description, due_date,
          status, completed_at, priority, ai_generated, created_by
        ) VALUES (
          ${params.orgId}, ${params.eventId}, ${null},
          ${tpl.title}, ${description || null},
          ${dueDate}::date,
          ${status},
          ${isPastDue ? new Date().toISOString() : null},
          ${tpl.priority ?? 'medium'},
          ${false},
          ${params.createdBy}
        )
      `
    }
  } catch (err) {
    console.error('Failed to apply reminder templates:', err)
  }
}
