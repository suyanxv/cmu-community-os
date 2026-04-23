import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { errorResponse } from '@/lib/errors'

const CreateEventSchema = z.object({
  name: z.string().min(1),
  event_date: z.string().min(1),
  start_time: z.string().transform(v => v || null).nullable(),
  end_time: z.string().transform(v => v || null).nullable(),
  timezone: z.string().default('America/Los_Angeles'),
  location_name: z.string().optional().nullable(),
  location_address: z.string().optional().nullable(),
  location_url: z.string().optional().nullable(),
  is_virtual: z.boolean().default(false),
  description: z.string().optional().nullable(),
  speakers: z.array(z.object({ name: z.string(), title: z.string().optional(), bio: z.string().optional() })).optional().nullable(),
  agenda: z.string().optional().nullable(),
  sponsors: z.array(z.object({ name: z.string(), tier: z.string().optional() })).optional().nullable(),
  tone: z.string().default('professional-warm'),
  target_audience: z.string().optional().nullable(),
  channels: z.array(z.string()).default([]),
  rsvp_link: z.string().optional().nullable(),
  rsvp_deadline: z.string().optional().nullable(),
  max_capacity: z.number().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  notes: z.string().optional().nullable(),
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

    const rows = await sql`
      INSERT INTO events (
        org_id, created_by, name, event_date, start_time, end_time, timezone,
        location_name, location_address, location_url, is_virtual,
        description, speakers, agenda, sponsors,
        tone, target_audience, channels, rsvp_link, rsvp_deadline, max_capacity,
        tags, notes
      ) VALUES (
        ${ctx.orgId}, ${ctx.userId}, ${data.name}, ${data.event_date}, ${data.start_time},
        ${data.end_time ?? null}, ${data.timezone},
        ${data.location_name ?? null}, ${data.location_address ?? null}, ${data.location_url ?? null},
        ${data.is_virtual},
        ${data.description ?? null},
        ${data.speakers ? JSON.stringify(data.speakers) : null},
        ${data.agenda ?? null},
        ${data.sponsors ? JSON.stringify(data.sponsors) : null},
        ${data.tone}, ${data.target_audience ?? null},
        ${data.channels}, ${data.rsvp_link ?? null},
        ${data.rsvp_deadline ?? null}, ${data.max_capacity ?? null},
        ${data.tags}, ${data.notes ?? null}
      )
      RETURNING *
    `

    logActivity({ orgId: ctx.orgId, userId: ctx.userId, entityType: 'event', entityId: rows[0].id, action: 'created', detail: { name: data.name } })

    return Response.json({ data: rows[0] }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
