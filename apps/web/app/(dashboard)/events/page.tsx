import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@/lib/db'
import { redirect } from 'next/navigation'

async function getOrgId(clerkOrgId: string): Promise<string | null> {
  const rows = await sql`SELECT id FROM organizations WHERE clerk_org_id = ${clerkOrgId}`
  return rows[0]?.id ?? null
}

export default async function EventsPage() {
  const { orgId: clerkOrgId } = await auth()
  if (!clerkOrgId) redirect('/sign-in')

  const orgId = await getOrgId(clerkOrgId)
  const events = orgId
    ? await sql`
        SELECT id, name, status, event_date, start_time, location_name, channels,
               (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = events.id AND r.status = 'confirmed') AS rsvp_count
        FROM events
        WHERE org_id = ${orgId} AND status != 'archived'
        ORDER BY event_date DESC
        LIMIT 50
      `
    : []

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
        <Link
          href="/events/new"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          + New Event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">📅</p>
          <p className="text-lg font-medium text-gray-900">No events yet</p>
          <p className="text-gray-500 mt-1 mb-6">Create your first event to get started</p>
          <Link
            href="/events/new"
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            Create Event
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">{event.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(event.event_date).toLocaleDateString('en-US', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                    })}
                    {event.location_name ? ` · ${event.location_name}` : ''}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {(event.channels as string[]).map((ch) => (
                      <span key={ch} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {ch}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">{event.rsvp_count} RSVPs</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    event.status === 'published' ? 'bg-green-100 text-green-700' :
                    event.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {event.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
