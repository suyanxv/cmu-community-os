import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOrgMember, requireAdmin } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { ApiError, errorResponse } from '@/lib/errors'

const UpdateEventSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['draft', 'published', 'past', 'cancelled', 'archived']).optional(),
  category: z.enum(['internal', 'partnered', 'external']).optional(),
  event_date: z.string().optional(),
  end_date: z.string().optional().nullable(),
  start_time: z.string().optional(),
  end_time: z.string().optional().nullable(),
  event_mode: z.enum(['in_person', 'virtual', 'hybrid']).optional(),
  timezone: z.string().optional(),
  location_name: z.string().optional().nullable(),
  location_address: z.string().optional().nullable(),
  location_url: z.string().optional().nullable(),
  is_virtual: z.boolean().optional(),
  description: z.string().optional().nullable(),
  speakers: z.array(z.any()).optional().nullable(),
  agenda: z.string().optional().nullable(),
  sponsors: z.array(z.any()).optional().nullable(),
  tone: z.string().optional(),
  target_audience: z.string().optional().nullable(),
  channels: z.array(z.string()).optional(),
  rsvp_link: z.string().optional().nullable(),
  rsvp_deadline: z.string().optional().nullable(),
  max_capacity: z.number().optional().nullable(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional().nullable(),
  custom_fields: z.record(z.string(), z.any()).optional(),
  checkin_config: z.record(z.string(), z.any()).optional(),
  host_user_ids: z.array(z.string().uuid()).optional(),
  cover_emoji: z.string().max(8).optional().nullable(),
})

type Params = { params: Promise<{ id: string }> }

async function getEvent(eventId: string, orgId: string) {
  const rows = await sql`
    SELECT e.*,
      (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = e.id AND r.status = 'confirmed')::int AS rsvp_count,
      (SELECT COUNT(*) FROM partners p JOIN event_partners ep ON ep.partner_id = p.id WHERE ep.event_id = e.id)::int AS partner_count,
      (SELECT COUNT(*) FROM reminders rem WHERE rem.event_id = e.id AND rem.status = 'pending')::int AS pending_reminders
    FROM events e
    WHERE e.id = ${eventId} AND e.org_id = ${orgId}
  `
  return rows[0] ?? null
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id } = await params
    const event = await getEvent(id, ctx.orgId)
    if (!event) throw new ApiError(404, 'Event not found')
    return Response.json({ data: event })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id } = await params
    const event = await getEvent(id, ctx.orgId)
    if (!event) throw new ApiError(404, 'Event not found')

    const body = await req.json()
    const data = UpdateEventSchema.parse(body)

    // Normalize date strings to YYYY-MM-DD before casting to date
    const eventDate    = data.event_date    ? String(data.event_date).slice(0, 10) : null
    const endDate      = 'end_date' in data && data.end_date ? String(data.end_date).slice(0, 10) : null
    const rsvpDeadline = 'rsvp_deadline' in data && data.rsvp_deadline ? String(data.rsvp_deadline).slice(0, 10) : null

    const rows = await sql`
      UPDATE events SET
        name             = COALESCE(${data.name ?? null}, name),
        status           = COALESCE(${data.status ?? null}, status),
        event_date       = COALESCE(${eventDate}::date, event_date),
        start_time       = COALESCE(${data.start_time ?? null}, start_time),
        end_time         = CASE WHEN ${('end_time' in data)} THEN ${data.end_time ?? null} ELSE end_time END,
        timezone         = COALESCE(${data.timezone ?? null}, timezone),
        location_name    = CASE WHEN ${'location_name' in data} THEN ${data.location_name ?? null} ELSE location_name END,
        location_address = CASE WHEN ${'location_address' in data} THEN ${data.location_address ?? null} ELSE location_address END,
        location_url     = CASE WHEN ${'location_url' in data} THEN ${data.location_url ?? null} ELSE location_url END,
        is_virtual       = COALESCE(${data.is_virtual ?? null}, is_virtual),
        description      = CASE WHEN ${'description' in data} THEN ${data.description ?? null} ELSE description END,
        speakers         = CASE WHEN ${'speakers' in data} THEN ${data.speakers ? JSON.stringify(data.speakers) : null} ELSE speakers END,
        agenda           = CASE WHEN ${'agenda' in data} THEN ${data.agenda ?? null} ELSE agenda END,
        sponsors         = CASE WHEN ${'sponsors' in data} THEN ${data.sponsors ? JSON.stringify(data.sponsors) : null} ELSE sponsors END,
        tone             = COALESCE(${data.tone ?? null}, tone),
        target_audience  = CASE WHEN ${'target_audience' in data} THEN ${data.target_audience ?? null} ELSE target_audience END,
        channels         = COALESCE(${data.channels ?? null}, channels),
        rsvp_link        = CASE WHEN ${'rsvp_link' in data} THEN ${data.rsvp_link ?? null} ELSE rsvp_link END,
        rsvp_deadline    = CASE WHEN ${'rsvp_deadline' in data} THEN ${rsvpDeadline}::date ELSE rsvp_deadline END,
        max_capacity     = CASE WHEN ${'max_capacity' in data} THEN ${data.max_capacity ?? null} ELSE max_capacity END,
        tags             = COALESCE(${data.tags ?? null}, tags),
        notes            = CASE WHEN ${'notes' in data} THEN ${data.notes ?? null} ELSE notes END,
        event_mode       = COALESCE(${data.event_mode ?? null}, event_mode),
        end_date         = CASE WHEN ${'end_date' in data} THEN ${endDate}::date ELSE end_date END,
        custom_fields    = CASE WHEN ${'custom_fields' in data} THEN ${JSON.stringify(data.custom_fields ?? {})}::jsonb ELSE custom_fields END,
        checkin_config   = CASE WHEN ${'checkin_config' in data} THEN ${JSON.stringify(data.checkin_config ?? {})}::jsonb ELSE checkin_config END,
        cover_emoji      = CASE WHEN ${'cover_emoji' in data} THEN ${data.cover_emoji ?? null} ELSE cover_emoji END,
        category         = COALESCE(${data.category ?? null}, category),
        updated_at       = NOW()
      WHERE id = ${id} AND org_id = ${ctx.orgId}
      RETURNING *
    `

    // Sync hosts if the caller explicitly sent host_user_ids
    if ('host_user_ids' in data && data.host_user_ids !== undefined) {
      const nextIds = data.host_user_ids
      if (nextIds.length === 0) {
        throw new ApiError(400, 'An event must have at least one host')
      }
      // Remove any host not in the new set
      await sql`
        DELETE FROM event_hosts
        WHERE event_id = ${id} AND org_id = ${ctx.orgId}
          AND user_id != ALL(${nextIds}::uuid[])
      `
      // Insert new hosts (verify each is an actual org member)
      for (const uid of nextIds) {
        await sql`
          INSERT INTO event_hosts (org_id, event_id, user_id)
          SELECT ${ctx.orgId}, ${id}, ${uid}
          WHERE EXISTS (
            SELECT 1 FROM org_members WHERE org_id = ${ctx.orgId} AND user_id = ${uid}
          )
          ON CONFLICT (event_id, user_id) DO NOTHING
        `
      }
      // Guard against all requested ids being invalid (would leave 0 hosts)
      const countAfter = await sql`SELECT COUNT(*)::int AS n FROM event_hosts WHERE event_id = ${id}`
      if (countAfter[0].n === 0) {
        throw new ApiError(400, 'None of the selected hosts are members of this org')
      }
    }

    logActivity({ orgId: ctx.orgId, userId: ctx.userId, entityType: 'event', entityId: id, action: 'updated' })
    return Response.json({ data: rows[0] })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAdmin()
    const { id } = await params
    await sql`DELETE FROM events WHERE id = ${id} AND org_id = ${ctx.orgId}`
    logActivity({ orgId: ctx.orgId, userId: ctx.userId, entityType: 'event', entityId: id, action: 'deleted' })
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
