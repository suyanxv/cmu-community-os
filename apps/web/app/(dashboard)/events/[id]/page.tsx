import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@/lib/db'
import DeleteEventButton from '@/components/events/DeleteEventButton'

type Params = { params: Promise<{ id: string }> }

async function getOrgId(clerkOrgId: string) {
  const rows = await sql`SELECT id FROM organizations WHERE clerk_org_id = ${clerkOrgId}`
  return rows[0]?.id ?? null
}

export default async function EventDetailPage({ params }: Params) {
  const { id } = await params
  const { orgId: clerkOrgId } = await auth()
  if (!clerkOrgId) notFound()

  const orgId = await getOrgId(clerkOrgId)
  if (!orgId) notFound()

  const events = await sql`
    SELECT e.*,
      (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = e.id AND r.status = 'confirmed')::int AS rsvp_count,
      (SELECT COALESCE(SUM(guest_count), 0) FROM rsvps r WHERE r.event_id = e.id AND r.status = 'confirmed')::int AS total_guests
    FROM events e
    WHERE e.id = ${id} AND e.org_id = ${orgId}
  `
  if (!events[0]) notFound()
  const event = events[0]

  const content = await sql`
    SELECT DISTINCT ON (channel) channel, subject_line, body, character_count, created_at
    FROM generated_content
    WHERE event_id = ${id} AND org_id = ${orgId}
    ORDER BY channel, version DESC
  `

  const hasContent = content.length > 0

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link href="/events" className="text-sm text-gray-500 hover:text-gray-700 mb-2 block">
            ← Back to Events
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
          <p className="text-gray-500 mt-1">
            {new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {event.start_time && ` · ${event.start_time}`}
            {event.location_name && ` · ${event.location_name}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <DeleteEventButton eventId={id} eventName={event.name} />
          <Link href={`/events/${id}/edit`} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Edit
          </Link>
          <Link href={`/events/${id}/content`} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            {hasContent ? 'View Content' : 'Generate Content'}
          </Link>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500">Confirmed RSVPs</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{event.rsvp_count}</p>
          {event.max_capacity && (
            <p className="text-xs text-gray-400 mt-1">of {event.max_capacity} capacity</p>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500">Total Guests</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{event.total_guests}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500">Channels</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{(event.channels as string[]).length}</p>
          <p className="text-xs text-gray-400 mt-1">{(event.channels as string[]).join(', ')}</p>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-4">
        <Link href={`/events/${id}/content`} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all">
          <p className="text-lg mb-1">✍️</p>
          <p className="font-medium text-gray-900">Generated Content</p>
          <p className="text-sm text-gray-500 mt-1">
            {hasContent ? `${content.length} channels ready` : 'Not generated yet'}
          </p>
        </Link>
        <Link href={`/events/${id}/rsvps`} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all">
          <p className="text-lg mb-1">🎟️</p>
          <p className="font-medium text-gray-900">RSVP Management</p>
          <p className="text-sm text-gray-500 mt-1">{event.rsvp_count} confirmed</p>
        </Link>
        <Link href={`/reminders?event_id=${id}`} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all">
          <p className="text-lg mb-1">🔔</p>
          <p className="font-medium text-gray-900">Reminders</p>
          <p className="text-sm text-gray-500 mt-1">View & manage tasks</p>
        </Link>
      </div>
    </div>
  )
}
