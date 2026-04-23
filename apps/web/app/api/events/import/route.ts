import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { parseBulkEvents } from '@/lib/ai'
import { logActivity } from '@/lib/activity'
import { errorResponse } from '@/lib/errors'
import { applyReminderTemplates } from '@/lib/reminder-templates'

// Simple in-memory rate limiter: 5 parses per org per hour (each call uses Sonnet)
const parseLimits = new Map<string, { count: number; resetAt: number }>()
function checkParseLimit(orgId: string): boolean {
  const now = Date.now()
  const limit = parseLimits.get(orgId)
  if (!limit || now > limit.resetAt) {
    parseLimits.set(orgId, { count: 1, resetAt: now + 3_600_000 })
    return true
  }
  if (limit.count >= 5) return false
  limit.count++
  return true
}

const ParseSchema = z.object({
  input: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireOrgMember()

    if (!checkParseLimit(ctx.orgId)) {
      return Response.json(
        { error: 'Parse limit reached (5/hour). Try again later or save events one at a time.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { input } = ParseSchema.parse(body)

    // Resolve org name for better prompt context
    const orgRows = await sql`SELECT name FROM organizations WHERE id = ${ctx.orgId}`
    const orgName = (orgRows[0]?.name as string) ?? 'your organization'

    const events = await parseBulkEvents(input, orgName)
    return Response.json({ data: events })
  } catch (err) {
    return errorResponse(err)
  }
}

// Bulk save parsed events.
const SaveSchema = z.object({
  events: z.array(z.object({
    name: z.string().min(1),
    event_date: z.string().nullable(),
    end_date: z.string().nullable().optional(),
    start_time: z.string().nullable().optional(),
    end_time: z.string().nullable().optional(),
    timezone: z.string().default('America/Los_Angeles'),
    location_name: z.string().nullable().optional(),
    location_address: z.string().nullable().optional(),
    is_virtual: z.boolean().default(false),
    event_mode: z.enum(['in_person', 'virtual', 'hybrid']).default('in_person'),
    description: z.string().nullable().optional(),
    max_capacity: z.number().nullable().optional(),
    tags: z.array(z.string()).default([]),
    is_past: z.boolean().default(false),
  })),
})

export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireOrgMember()
    const body = await req.json()
    const { events } = SaveSchema.parse(body)

    // Require at least a name + date per event (skip invalid ones)
    const valid = events.filter((e) => e.name && e.event_date)

    const createdIds: string[] = []
    for (const e of valid) {
      const status = e.is_past ? 'past' : 'draft'
      const normalizedEventDate = e.event_date ? String(e.event_date).slice(0, 10) : null
      const normalizedEndDate   = e.end_date   ? String(e.end_date).slice(0, 10)   : null

      const rows = await sql`
        INSERT INTO events (
          org_id, created_by, name, status,
          event_date, end_date, start_time, end_time, timezone,
          location_name, location_address, is_virtual, event_mode,
          description, max_capacity, tags
        ) VALUES (
          ${ctx.orgId}, ${ctx.userId}, ${e.name}, ${status},
          ${normalizedEventDate}::date,
          ${normalizedEndDate}::date,
          ${e.start_time ?? null}, ${e.end_time ?? null}, ${e.timezone},
          ${e.location_name ?? null}, ${e.location_address ?? null},
          ${e.is_virtual}, ${e.event_mode},
          ${e.description ?? null}, ${e.max_capacity ?? null},
          ${e.tags ?? []}
        )
        RETURNING id
      `
      const newId = rows[0].id as string
      createdIds.push(newId)

      // Apply org-level reminder templates to each imported event too
      if (normalizedEventDate) {
        await applyReminderTemplates({
          orgId: ctx.orgId,
          eventId: newId,
          eventDate: normalizedEventDate,
          createdBy: ctx.userId,
        })
      }
    }

    logActivity({
      orgId: ctx.orgId, userId: ctx.userId,
      entityType: 'event', entityId: ctx.orgId,
      action: 'imported', detail: { imported: createdIds.length, requested: events.length },
    })

    return Response.json({
      data: {
        imported: createdIds.length,
        skipped: events.length - createdIds.length,
        ids: createdIds,
      },
    })
  } catch (err) {
    return errorResponse(err)
  }
}
