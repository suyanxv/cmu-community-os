import { NextRequest } from 'next/server'
import Papa from 'papaparse'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { errorResponse } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

// Accepts EITHER a multipart upload (form field "file") or a JSON body
// ({ csv: "<raw csv text>" }). The JSON path is used by the textarea-paste
// flow on the RSVP page so users don't have to download/save a file first.
async function readCsvText(req: NextRequest): Promise<string | { error: string }> {
  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => null)
    const csv = body?.csv
    if (typeof csv !== 'string' || csv.trim().length === 0) {
      return { error: 'No csv text provided' }
    }
    return csv
  }

  // Default: multipart form upload
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return { error: 'No file provided' }
  return await file.text()
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id: eventId } = await params

    const result = await readCsvText(req)
    if (typeof result !== 'string') {
      return Response.json({ error: result.error }, { status: 400 })
    }
    const text = result

    // PapaParse handles both comma- and tab-separated input automatically when
    // delimiter is left blank (auto-detect). Sheets pastes are tab-separated.
    const { data, errors } = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    })

    if (errors.length > 0) {
      return Response.json({ error: 'CSV parse error', details: errors }, { status: 400 })
    }

    // Header lookup is case-insensitive and handles common variants. Returns
    // the first non-empty value across the candidate keys.
    const pick = (row: Record<string, string>, ...keys: string[]): string => {
      const lowered = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]))
      for (const key of keys) {
        const v = lowered[key.toLowerCase()]
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
      }
      return ''
    }

    let imported = 0
    const parseErrors: string[] = []

    for (const [i, row] of data.entries()) {
      const name = pick(row, 'name', 'full name', 'attendee', 'attendee name', 'guest', 'guest name')
      if (!name) {
        parseErrors.push(`Row ${i + 2}: missing name`)
        continue
      }

      const email = pick(row, 'email', 'email address', 'e-mail') || null
      const phone = pick(row, 'phone', 'phone number', 'mobile', 'cell') || null
      const guestCountRaw = pick(row, 'guest_count', 'guests', 'guest count', '#', 'count')
      const guestCount = parseInt(guestCountRaw || '1') || 1
      const statusRaw = pick(row, 'status').toLowerCase()
      const status = (['confirmed', 'waitlist', 'cancelled'].includes(statusRaw) ? statusRaw : 'confirmed') as 'confirmed' | 'waitlist' | 'cancelled'
      const notes = pick(row, 'notes', 'comment', 'comments') || null

      await sql`
        INSERT INTO rsvps (org_id, event_id, name, email, phone, status, guest_count, notes, source)
        VALUES (${ctx.orgId}, ${eventId}, ${name}, ${email}, ${phone}, ${status}, ${guestCount}, ${notes}, 'csv_import')
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
