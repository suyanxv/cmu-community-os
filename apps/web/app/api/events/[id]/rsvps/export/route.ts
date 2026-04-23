import { NextRequest } from 'next/server'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { errorResponse } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

interface FieldDef { id: string; label: string }

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return `"${s.replace(/"/g, '""')}"`
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id: eventId } = await params

    // Pull event's check-in field schema so the CSV has a column per configured field
    const eventRow = await sql`
      SELECT checkin_config FROM events WHERE id = ${eventId} AND org_id = ${ctx.orgId}
    `
    const checkinFields = ((eventRow[0]?.checkin_config as { fields?: FieldDef[] } | null)?.fields ?? []) as FieldDef[]

    const rsvps = await sql`
      SELECT name, email, phone, status, guest_count, notes, created_at, check_in_at,
             check_in_data, graduation_year, school, how_heard
      FROM rsvps
      WHERE event_id = ${eventId} AND org_id = ${ctx.orgId}
      ORDER BY created_at ASC
    `

    const extraHeaders = checkinFields.map((f) => f.label)
    const header = [
      'Name', 'Email', 'Phone', 'Status', 'Guests',
      'Checked In At',
      ...extraHeaders,
      'Notes', 'RSVP Date',
    ].join(',') + '\n'

    const rows = rsvps.map((r) => {
      const data = (r.check_in_data as Record<string, string | boolean> | null) ?? {}
      const extras = checkinFields.map((f) => {
        const fromJson = data[f.id]
        if (typeof fromJson === 'string') return fromJson
        if (typeof fromJson === 'boolean') return fromJson ? 'Yes' : 'No'
        if (f.id === 'graduation_year' && r.graduation_year) return r.graduation_year
        if (f.id === 'school' && r.school) return r.school
        if (f.id === 'how_heard' && r.how_heard) return r.how_heard
        return ''
      })
      return [
        csvEscape(r.name),
        csvEscape(r.email ?? ''),
        csvEscape(r.phone ?? ''),
        csvEscape(r.status),
        csvEscape(r.guest_count),
        csvEscape(r.check_in_at ? new Date(r.check_in_at as string).toLocaleString() : ''),
        ...extras.map(csvEscape),
        csvEscape(r.notes ?? ''),
        csvEscape(new Date(r.created_at as string).toLocaleDateString()),
      ].join(',')
    }).join('\n')

    return new Response(header + rows, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="rsvps-${eventId}.csv"`,
      },
    })
  } catch (err) {
    return errorResponse(err)
  }
}
