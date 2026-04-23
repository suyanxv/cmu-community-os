import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { errorResponse } from '@/lib/errors'

const CreateEventSchema = z.object({
  name: z.string().min(1),
  event_date: z.string().min(1),
  end_date: z.string().optional().nullable().transform(v => v || null),
  start_time: z.string().optional().nullable().transform(v => v || null),
  end_time: z.string().optional().nullable().transform(v => v || null),
  timezone: z.string().default('America/Los_Angeles'),
  location_name: z.string().optional().nullable().transform(v => v || null),
  location_address: z.string().optional().nullable().transform(v => v || null),
  location_url: z.string().optional().nullable().transform(v => v || null),
  is_virtual: z.boolean().default(false),
  event_mode: z.enum(['in_person', 'virtual', 'hybrid']).default('in_person'),
  description: z.string().optional().nullable().transform(v => v || null),
  speakers: z.array(z.object({ name: z.string(), title: z.string().optional(), bio: z.string().optional() })).optional().nullable(),
  agenda: z.string().optional().nullable().transform(v => v || null),
  sponsors: z.array(z.object({ name: z.string(), tier: z.string().optional() })).optional().nullable(),
  tone: z.string().default('professional-warm'),
  target_audience: z.string().optional().nullable().transform(v => v || null),
  channels: z.array(z.string()).default([]),
  rsvp_link: z.string().optional().nullable().transform(v => v || null),
  rsvp_deadline: z.string().optional().nullable().transform(v => v || null),
  max_capacity: z.number().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  notes: z.string().optional().nullable(),
  custom_fields: z.record(z.string(), z.any()).optional().default({}),
  checkin_config: z.record(z.string(), z.any()).optional().default({}),
})

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireOrgMember()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0')

    const events = await sql`
      SELECT
        e.id, e.name, e.status, e.event_date, e.start_time, e.end_time,
        e.timezone, e.location_name, e.channels, e.tone, e.created_at,
        (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = e.id AND r.status = 'confirmed')::int AS rsvp_count
      FROM events e
      WHERE e.org_id = ${ctx.orgId}
        ${status ? sql`AND e.status = ${status}` : sql``}
      ORDER BY e.event_date DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    return Response.json({ data: events })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireOrgMember()
    const body = await req.json()
    const data = CreateEventSchema.parse(body)

    // Force date strings to YYYY-MM-DD format — some clients send ISO timestamps
    // that would otherwise get timezone-shifted by Postgres DATE casting.
    const eventDate    = data.event_date    ? String(data.event_date).slice(0, 10) : null
    const endDate      = data.end_date      ? String(data.end_date).slice(0, 10) : null
    const rsvpDeadline = data.rsvp_deadline ? String(data.rsvp_deadline).slice(0, 10) : null

    const rows = await sql`
      INSERT INTO events (
        org_id, created_by, name, event_date, end_date, start_time, end_time, timezone,
        location_name, location_address, location_url, is_virtual, event_mode,
        description, speakers, agenda, sponsors,
        tone, target_audience, channels, rsvp_link, rsvp_deadline, max_capacity,
        tags, notes, custom_fields, checkin_config
      ) VALUES (
        ${ctx.orgId}, ${ctx.userId}, ${data.name},
        ${eventDate}::date,
        ${endDate}::date,
        ${data.start_time}, ${data.end_time ?? null}, ${data.timezone},
        ${data.location_name ?? null}, ${data.location_address ?? null}, ${data.location_url ?? null},
        ${data.is_virtual}, ${data.event_mode},
        ${data.description ?? null},
        ${data.speakers ? JSON.stringify(data.speakers) : null},
        ${data.agenda ?? null},
        ${data.sponsors ? JSON.stringify(data.sponsors) : null},
        ${data.tone}, ${data.target_audience ?? null},
        ${data.channels}, ${data.rsvp_link ?? null},
        ${rsvpDeadline}::date,
        ${data.max_capacity ?? null},
        ${data.tags}, ${data.notes ?? null},
        ${JSON.stringify(data.custom_fields ?? {})}::jsonb,
        ${JSON.stringify(data.checkin_config ?? {})}::jsonb
      )
      RETURNING *
    `

    logActivity({ orgId: ctx.orgId, userId: ctx.userId, entityType: 'event', entityId: rows[0].id, action: 'created', detail: { name: data.name } })

    return Response.json({ data: rows[0] }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
