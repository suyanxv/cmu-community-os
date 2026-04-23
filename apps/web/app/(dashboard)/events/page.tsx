import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@/lib/db'
import { redirect } from 'next/navigation'

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

  // Auto-mark events past their end date as 'past' (idempotent; skips archived/already-past)
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
      COALESCE(end_date, event_date) AS effective_end_date,
      (SELECT COALESCE(SUM(guest_count), 0)::int FROM rsvps r WHERE r.event_id = events.id AND r.status = 'confirmed') AS rsvp_count
    FROM events
    WHERE org_id = ${orgId} AND status != 'archived'
    ORDER BY event_date DESC
    LIMIT 100
  ` as EventRow[]

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = rows
    .filter((e) => e.effective_end_date >= today)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
  const past = rows
    .filter((e) => e.effective_end_date < today)
    .sort((a, b) => b.event_date.localeCompare(a.event_date))

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
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <EventSection title="Upcoming" count={upcoming.length} events={upcoming} />
          )}
          {past.length > 0 && (
            <EventSection title="Past" count={past.length} events={past} dim />
          )}
        </div>
      )}
    </div>
  )
}

function EventSection({
  title,
  count,
  events,
  dim = false,
}: {
  title: string
  count: number
  events: EventRow[]
  dim?: boolean
}) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-3">
        {title} <span className="text-gray-400">· {count}</span>
      </h2>
      <div className="space-y-3">
        {events.map((event) => (
          <EventRowCard key={event.id} event={event} dim={dim} />
        ))}
      </div>
    </section>
  )
}

function EventRowCard({ event, dim }: { event: EventRow; dim: boolean }) {
  const statusStyle =
    event.status === 'published' ? 'bg-green-100 text-green-700'
    : event.status === 'draft'   ? 'bg-butter-100 text-butter-700'
    : event.status === 'past'    ? 'bg-stone-200 text-stone-600'
    : 'bg-gray-100 text-gray-600'

  const capacityPct = event.max_capacity && event.max_capacity > 0
    ? Math.min(100, Math.round((event.rsvp_count / event.max_capacity) * 100))
    : null

  const barColor =
    capacityPct === null ? ''
    : capacityPct >= 100 ? 'bg-red-500'
    : capacityPct >= 80  ? 'bg-butter-500'
    : 'bg-sage-500'

  return (
    <Link
      href={`/events/${event.id}`}
      className={`block bg-white border border-gray-200 rounded-xl p-5 hover:border-sage-300 hover:shadow-sm transition-all ${dim ? 'opacity-75 hover:opacity-100' : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900 truncate">{event.name}</h3>
          <p className="text-sm text-gray-500 mt-1">
            {new Date(event.event_date).toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
            {event.location_name ? ` · ${event.location_name}` : ''}
          </p>
          {event.channels && event.channels.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {event.channels.map((ch) => (
                <span key={ch} className="text-xs bg-stone-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {ch}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${statusStyle}`}>
            {event.status}
          </span>
          {capacityPct !== null ? (
            <div className="w-32">
              <div className="flex items-baseline justify-between text-xs text-gray-500 mb-1">
                <span className="font-medium text-gray-700">{event.rsvp_count}/{event.max_capacity}</span>
                <span>{capacityPct}%</span>
              </div>
              <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div className={`h-full ${barColor} transition-all`} style={{ width: `${capacityPct}%` }} />
              </div>
            </div>
          ) : (
            <span className="text-sm text-gray-500">{event.rsvp_count} guest{event.rsvp_count === 1 ? '' : 's'}</span>
          )}
        </div>
      </div>
    </Link>
  )
}
