import { NextRequest } from 'next/server'
import Papa from 'papaparse'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { errorResponse } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id: eventId } = await params

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

    const text = await file.text()
    const { data, errors } = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    })

    if (errors.length > 0) {
      return Response.json({ error: 'CSV parse error', details: errors }, { status: 400 })
    }

    let imported = 0
    const parseErrors: string[] = []

    for (const [i, row] of data.entries()) {
      const name = row['name'] || row['Name'] || row['Full Name'] || ''
      if (!name) {
        parseErrors.push(`Row ${i + 2}: missing name`)
        continue
      }

      const email = row['email'] || row['Email'] || null
      const guestCount = parseInt(row['guest_count'] || row['Guests'] || '1') || 1
      const status = (['confirmed', 'waitlist', 'cancelled'].includes(row['status'] ?? '') ? row['status'] : 'confirmed') as 'confirmed' | 'waitlist' | 'cancelled'

      await sql`
        INSERT INTO rsvps (org_id, event_id, name, email, status, guest_count, source)
        VALUES (${ctx.orgId}, ${eventId}, ${name}, ${email}, ${status}, ${guestCount}, 'csv_import')
        ON CONFLICT DO NOTHING
      `
      imported++
    }

    logActivity({
      orgId: ctx.orgId, userId: ctx.userId, entityType: 'rsvp', entityId: eventId,
      action: 'imported', detail: { imported, errors: parseErrors.length },
    })

    return Response.json({ imported, errors: parseErrors })
  } catch (err) {
    return errorResponse(err)
  }
}
