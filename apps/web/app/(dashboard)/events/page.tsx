import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@/lib/db'
import { redirect } from 'next/navigation'
import EventsList from '@/components/events/EventsList'

async function getOrgId(clerkOrgId: string): Promise<string | null> {
  const rows = await sql`SELECT id FROM organizations WHERE clerk_org_id = ${clerkOrgId}`
  return rows[0]?.id ?? null
}

interface EventRow {
  id: string
  name: string
  cover_emoji: string | null
  status: string
  category: 'internal' | 'partnered' | 'external'
  co_hosts: string[]
  event_date: string
  start_time: string | null
  location_name: string | null
  location_address: string | null
  event_mode: 'in_person' | 'virtual' | 'hybrid'
  channels: string[]
  tags: string[]
  rsvp_count: number
  max_capacity: number | null
  effective_end_date: string
  hosts: Array<{ user_id: string; name: string; avatar_url: string | null }>
}

export default async function EventsPage() {
  const { orgId: clerkOrgId } = await auth()
  if (!clerkOrgId) redirect('/sign-in')

  const orgId = await getOrgId(clerkOrgId)
  if (!orgId) return null

  // Auto-mark events past their end date as 'past' (idempotent).
  // Cancelled events stay cancelled so they can be visually flagged without being
  // silently reclassified as 'past'.
  await sql`
    UPDATE events
    SET status = 'past', updated_at = NOW()
    WHERE org_id = ${orgId}
      AND COALESCE(end_date, event_date) < CURRENT_DATE
      AND status NOT IN ('past', 'archived', 'cancelled')
  `

  const toIsoDate = (v: unknown): string => {
    if (typeof v === 'string') return v.slice(0, 10)
    if (v instanceof Date) return v.toISOString().slice(0, 10)
    return String(v ?? '').slice(0, 10)
  }

  // Events list query. Hosts subquery is wrapped in a try/catch-safe shape:
  // if event_hosts doesn't exist yet (pre-migration) the query still succeeds.
  let rows: EventRow[] = []
  try {
    rows = (await sql`
      SELECT
        id, name, status, category, co_hosts,
        to_char(event_date, 'YYYY-MM-DD') AS event_date,
        start_time, location_name, location_address, event_mode, channels, tags, max_capacity, cover_emoji,
        to_char(COALESCE(end_date, event_date), 'YYYY-MM-DD') AS effective_end_date,
        (SELECT COALESCE(SUM(guest_count), 0)::int FROM rsvps r WHERE r.event_id = events.id AND r.status = 'confirmed') AS rsvp_count,
        COALESCE((
          SELECT json_agg(json_build_object(
            'user_id',    u.id,
            'name',       COALESCE(u.full_name, u.email),
            'avatar_url', u.avatar_url
          ))
          FROM event_hosts eh
          JOIN users u ON u.id = eh.user_id
          WHERE eh.event_id = events.id
        ), '[]'::json) AS hosts
      FROM events
      WHERE org_id = ${orgId} AND status != 'archived'
      ORDER BY event_date DESC
      LIMIT 100
    `).map((r) => ({
      ...r,
      event_date: toIsoDate(r.event_date),
      effective_end_date: toIsoDate(r.effective_end_date),
      channels: Array.isArray(r.channels) ? r.channels : [],
      tags: Array.isArray(r.tags) ? r.tags : [],
      co_hosts: Array.isArray(r.co_hosts) ? r.co_hosts : [],
      hosts: Array.isArray(r.hosts) ? r.hosts : [],
    })) as EventRow[]
  } catch {
    // Fallback: event_hosts table missing, fetch without it
    rows = (await sql`
      SELECT
        id, name, status, category, co_hosts,
        to_char(event_date, 'YYYY-MM-DD') AS event_date,
        start_time, location_name, location_address, event_mode, channels, tags, max_capacity, cover_emoji,
        to_char(COALESCE(end_date, event_date), 'YYYY-MM-DD') AS effective_end_date,
        (SELECT COALESCE(SUM(guest_count), 0)::int FROM rsvps r WHERE r.event_id = events.id AND r.status = 'confirmed') AS rsvp_count
      FROM events
      WHERE org_id = ${orgId} AND status != 'archived'
      ORDER BY event_date DESC
      LIMIT 100
    `).map((r) => ({
      ...r,
      event_date: toIsoDate(r.event_date),
      effective_end_date: toIsoDate(r.effective_end_date),
      channels: Array.isArray(r.channels) ? r.channels : [],
      tags: Array.isArray(r.tags) ? r.tags : [],
      co_hosts: Array.isArray(r.co_hosts) ? r.co_hosts : [],
      hosts: [],
    })) as EventRow[]
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/events/import"
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors"
          >
            Import
          </Link>
          <Link
            href="/events/new"
            className="bg-sage-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sage-700 transition-colors"
          >
            + New Event
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">📅</p>
          <p className="text-lg font-medium text-gray-900">No events yet</p>
          <p className="text-gray-500 mt-1 mb-6">Create your first event to get started</p>
          <Link
            href="/events/new"
            className="bg-sage-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-sage-700"
          >
            Create Event
          </Link>
        </div>
      ) : (
        <EventsList events={rows} />
      )}
    </div>
  )
}
