import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { sendEmail } from '@/lib/email'

// Daily cron: email each due, pending, not-yet-emailed reminder to its
// assignee (falling back to event hosts, then event creator). Idempotent —
// last_emailed_at is stamped after the first successful send.
//
// Protected by CRON_SECRET. Vercel's scheduler calls with
// `Authorization: Bearer <CRON_SECRET>` when run from vercel.json.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface DueReminder {
  id: string
  org_id: string
  event_id: string | null
  assigned_to: string | null
  title: string
  description: string | null
  due_date: string
  priority: string
  event_name: string | null
  org_name: string
  event_created_by: string | null
}

interface Recipient {
  email: string
  name: string | null
}

async function resolveRecipients(r: DueReminder): Promise<Recipient[]> {
  if (r.assigned_to) {
    const rows = await sql`
      SELECT full_name AS name, email FROM users WHERE id = ${r.assigned_to}
    `
    const user = rows[0]
    if (user?.email) return [{ email: user.email as string, name: (user.name as string) ?? null }]
  }

  if (r.event_id) {
    // All event hosts with email addresses.
    const hostRows = await sql`
      SELECT u.full_name AS name, u.email
      FROM event_hosts eh
      JOIN users u ON u.id = eh.user_id
      WHERE eh.event_id = ${r.event_id} AND u.email IS NOT NULL AND u.email <> ''
    `
    if (hostRows.length > 0) {
      return hostRows.map((h): Recipient => ({ email: h.email as string, name: (h.name as string) ?? null }))
    }
  }

  if (r.event_created_by) {
    const rows = await sql`
      SELECT full_name AS name, email FROM users WHERE id = ${r.event_created_by}
    `
    const user = rows[0]
    if (user?.email) return [{ email: user.email as string, name: (user.name as string) ?? null }]
  }

  return []
}

function buildSubject(r: DueReminder): string {
  const prefix = r.priority === 'high' ? '[High priority] ' : ''
  return `${prefix}Reminder: ${r.title}`
}

function buildBody(r: DueReminder, recipient: Recipient, appUrl: string): string {
  const greeting = recipient.name ? `Hi ${recipient.name.split(' ')[0]},` : 'Hi there,'
  const eventLine = r.event_name
    ? `This is tied to ${r.event_name}.`
    : 'This is an org-wide reminder.'
  const link = r.event_id ? `${appUrl}/events/${r.event_id}` : `${appUrl}/reminders`
  const dueDate = new Date(r.due_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const descriptionBlock = r.description ? `\n${r.description}\n` : ''

  return `${greeting}

${r.title} is due today (${dueDate}).
${descriptionBlock}
${eventLine}

Open in Quorum: ${link}

— ${r.org_name} on Quorum`
}

export async function POST(req: NextRequest) {
  return handle(req)
}
export async function GET(req: NextRequest) {
  return handle(req)
}

async function handle(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.RESEND_API_KEY) {
    // Don't error the cron — just report a skip so Vercel doesn't mark it failing.
    return Response.json({ ok: true, skipped: true, reason: 'RESEND_API_KEY not set' })
  }

  const due = (await sql`
    SELECT
      r.id, r.org_id, r.event_id, r.assigned_to, r.title, r.description,
      r.due_date::text AS due_date, r.priority,
      e.name AS event_name,
      e.created_by AS event_created_by,
      o.name AS org_name
    FROM reminders r
    JOIN organizations o ON o.id = r.org_id
    LEFT JOIN events e ON e.id = r.event_id
    WHERE r.status = 'pending'
      AND r.last_emailed_at IS NULL
      AND r.due_date::date <= CURRENT_DATE
    ORDER BY r.due_date ASC
    LIMIT 100
  `) as unknown as DueReminder[]

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cmu-community-os-pink.vercel.app'

  let sent = 0
  let skipped = 0
  let failed = 0
  const errors: Array<{ reminder_id: string; error: string }> = []

  for (const r of due) {
    const recipients = await resolveRecipients(r)
    if (recipients.length === 0) {
      skipped++
      // Mark as emailed anyway so we don't spin on it every day.
      await sql`UPDATE reminders SET last_emailed_at = NOW() WHERE id = ${r.id}`
      continue
    }

    let anySuccess = false
    for (const rcp of recipients) {
      const result = await sendEmail({
        to: rcp.email,
        subject: buildSubject(r),
        text: buildBody(r, rcp, appUrl),
        fromName: r.org_name,
      })
      if (result.ok) {
        anySuccess = true
      } else {
        errors.push({ reminder_id: r.id, error: result.error ?? 'send failed' })
      }
    }

    if (anySuccess) {
      // Conditional update guards against a concurrent cron instance: only
      // stamp if still NULL. Vercel Cron doesn't parallelize, but this is
      // cheap defense-in-depth.
      const claim = await sql`
        UPDATE reminders SET last_emailed_at = NOW()
        WHERE id = ${r.id} AND last_emailed_at IS NULL
        RETURNING id
      `
      if (claim.length > 0) sent++
      else skipped++ // another runner already stamped it
    } else {
      failed++
      // Don't stamp last_emailed_at — we'll retry tomorrow.
    }
  }

  return Response.json({
    ok: true,
    scanned: due.length,
    sent,
    skipped,
    failed,
    errors: errors.slice(0, 10),
  })
}
