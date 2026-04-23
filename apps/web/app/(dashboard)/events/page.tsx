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
  status: string
  event_date: string
  start_time: string | null
  location_name: string | null
  channels: string[]
  rsvp_count: number
  max_capacity: number | null
  effective_end_date: string
}

export default async function EventsPage() {
  const { orgId: clerkOrgId } = await auth()
  if (!clerkOrgId) redirect('/sign-in')

  const orgId = await getOrgId(clerkOrgId)
  if (!orgId) return null

  // Auto-mark events past their end date as 'past' (idempotent)
  await sql`
    UPDATE events
    SET status = 'past', updated_at = NOW()
    WHERE org_id = ${orgId}
      AND COALESCE(end_date, event_date) < CURRENT_DATE
      AND status NOT IN ('past', 'archived')
  `

  const rows = await sql`
    SELECT
      id, name, status, event_date, start_time, location_name, channels, max_capacity,
      COALESCE(end_date, event_date)::text AS effective_end_date,
      (SELECT COALESCE(SUM(guest_count), 0)::int FROM rsvps r WHERE r.event_id = events.id AND r.status = 'confirmed') AS rsvp_count
    FROM events
    WHERE org_id = ${orgId} AND status != 'archived'
    ORDER BY event_date DESC
    LIMIT 100
  ` as EventRow[]

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
        <Link
          href="/events/new"
          className="bg-sage-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sage-700 transition-colors"
        >
          + New Event
        </Link>
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
