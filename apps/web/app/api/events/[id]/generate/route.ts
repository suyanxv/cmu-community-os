import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { generateChannelContent, type Channel } from '@/lib/ai'
import { logActivity } from '@/lib/activity'
import { ApiError, errorResponse } from '@/lib/errors'

const GenerateSchema = z.object({
  channels: z.array(z.enum(['whatsapp', 'email', 'instagram', 'linkedin', 'luma'])).min(1),
  regenerate: z.boolean().optional().default(false),
})

// Simple in-memory rate limiter: 10 generations per org per hour
const rateLimits = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(orgId: string): boolean {
  const now = Date.now()
  const limit = rateLimits.get(orgId)
  if (!limit || now > limit.resetAt) {
    rateLimits.set(orgId, { count: 1, resetAt: now + 3_600_000 })
    return true
  }
  if (limit.count >= 10) return false
  limit.count++
  return true
}

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id: eventId } = await params

    if (!checkRateLimit(ctx.orgId)) {
      return Response.json({ error: 'Generation limit reached (10/hour). Try again later.' }, { status: 429 })
    }

    // Fetch event + org name
    const eventRows = await sql`
      SELECT e.*, o.name AS org_name
      FROM events e
      JOIN organizations o ON o.id = e.org_id
      WHERE e.id = ${eventId} AND e.org_id = ${ctx.orgId}
    `
    if (!eventRows[0]) throw new ApiError(404, 'Event not found')
    const event = eventRows[0]

    // Fetch hosts separately (fault-tolerant)
    try {
      const hostRows = await sql`
        SELECT COALESCE(u.full_name, u.email) AS name, om.title
        FROM event_hosts eh
        JOIN users u ON u.id = eh.user_id
        LEFT JOIN org_members om ON om.user_id = u.id AND om.org_id = ${ctx.orgId}
        WHERE eh.event_id = ${eventId} AND eh.org_id = ${ctx.orgId}
      `
      event.hosts = hostRows
    } catch {
      event.hosts = []
    }

    const body = await req.json()
    const { channels } = GenerateSchema.parse(body)

    const results = await generateChannelContent(
      {
        name: event.name,
        event_date: event.event_date,
        end_date: event.end_date,
        start_time: event.start_time,
        end_time: event.end_time,
        timezone: event.timezone,
        location_name: event.location_name,
        location_address: event.location_address,
        location_url: event.location_url,
        is_virtual: event.is_virtual,
        event_mode: event.event_mode,
        description: event.description,
        speakers: event.speakers,
        hosts: event.hosts,
        agenda: event.agenda,
        sponsors: event.sponsors,
        tone: event.tone,
        target_audience: event.target_audience,
        rsvp_link: event.rsvp_link,
        rsvp_deadline: event.rsvp_deadline,
        max_capacity: event.max_capacity,
        custom_fields: event.custom_fields,
        org_name: event.org_name,
      },
      channels as Channel[]
    )

    // Store results — increment version on regeneration
    const stored = []
    for (const result of results) {
      const versionRows = await sql`
        SELECT COALESCE(MAX(version), 0) AS max_version
        FROM generated_content
        WHERE event_id = ${eventId} AND channel = ${result.channel}
      `
      const nextVersion = (versionRows[0].max_version as number) + 1

      const inserted = await sql`
        INSERT INTO generated_content (
          org_id, event_id, channel, version,
          subject_line, body, character_count,
          model, prompt_tokens, output_tokens, cached
        ) VALUES (
          ${ctx.orgId}, ${eventId}, ${result.channel}, ${nextVersion},
          ${result.subject_line}, ${result.body}, ${result.character_count},
          'claude-sonnet-4-6', ${result.prompt_tokens}, ${result.output_tokens}, ${result.cached}
        )
        RETURNING *
      `
      stored.push(inserted[0])
    }

    logActivity({
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityType: 'content',
      entityId: eventId,
      action: 'generated',
      detail: { channels },
    })

    return Response.json({ data: stored })
  } catch (err) {
    return errorResponse(err)
  }
}
