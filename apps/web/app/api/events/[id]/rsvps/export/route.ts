import { NextRequest } from 'next/server'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { errorResponse } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id: eventId } = await params

    const rsvps = await sql`
      SELECT name, email, phone, status, guest_count, notes, created_at
      FROM rsvps
      WHERE event_id = ${eventId} AND org_id = ${ctx.orgId}
      ORDER BY created_at ASC
    `

    const header = 'Name,Email,Phone,Status,Guests,Notes,RSVP Date\n'
    const rows = rsvps.map((r) =>
      [r.name, r.email ?? '', r.phone ?? '', r.status, r.guest_count, r.notes ?? '',
        new Date(r.created_at).toLocaleDateString()]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    ).join('\n')

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
