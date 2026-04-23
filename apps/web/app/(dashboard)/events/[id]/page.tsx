import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@/lib/db'
import DeleteEventButton from '@/components/events/DeleteEventButton'
import DuplicateEventButton from '@/components/events/DuplicateEventButton'
import EventPartnersSection from '@/components/events/EventPartnersSection'
import GenerateRemindersButton from '@/components/reminders/GenerateRemindersButton'
import ShareEventButton from '@/components/events/ShareEventButton'

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
      (SELECT COALESCE(SUM(guest_count), 0) FROM rsvps r WHERE r.event_id = e.id AND r.status = 'confirmed')::int AS total_guests,
      o.settings->'event_template_schema' AS template_schema
    FROM events e
    JOIN organizations o ON o.id = e.org_id
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
          <ShareEventButton eventId={id} />
          <DuplicateEventButton eventId={id} />
          <GenerateRemindersButton eventId={id} />
          <Link href={`/events/${id}/edit`} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50">
            Edit
          </Link>
          <Link href={`/events/${id}/content`} className="px-4 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700">
            {hasContent ? 'View Content' : 'Add Content'}
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Link href={`/events/${id}/content`} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-sage-300 hover:shadow-sm transition-all">
          <p className="text-lg mb-1">✍️</p>
          <p className="font-medium text-gray-900">Generated Content</p>
          <p className="text-sm text-gray-500 mt-1">
            {hasContent ? `${content.length} channels ready` : 'Not generated yet'}
          </p>
        </Link>
        <Link href={`/events/${id}/rsvps`} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-sage-300 hover:shadow-sm transition-all">
          <p className="text-lg mb-1">🎟️</p>
          <p className="font-medium text-gray-900">RSVP Management</p>
          <p className="text-sm text-gray-500 mt-1">{event.rsvp_count} confirmed</p>
        </Link>
        <Link href={`/reminders?event_id=${id}`} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-sage-300 hover:shadow-sm transition-all">
          <p className="text-lg mb-1">🔔</p>
          <p className="font-medium text-gray-900">Reminders</p>
          <p className="text-sm text-gray-500 mt-1">View & manage tasks</p>
        </Link>
      </div>

      {/* Event details */}
      <EventDetails event={event} />

      {/* Partners linked to this event */}
      <EventPartnersSection eventId={id} />
    </div>
  )
}

interface SpeakerEntry { name?: string; title?: string; bio?: string }
interface SponsorEntry { name?: string; tier?: string }

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-3 border-b border-gray-100 last:border-b-0">
      <dt className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">{label}</dt>
      <dd className="text-sm text-gray-900 whitespace-pre-wrap">{children}</dd>
    </div>
  )
}

function humanize(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function EventDetails({ event }: { event: Record<string, unknown> }) {
  const modeLabel = event.event_mode === 'virtual' ? 'Virtual' : event.event_mode === 'hybrid' ? 'Hybrid' : 'In-Person'
  const speakers = (event.speakers ?? []) as SpeakerEntry[]
  const sponsors = (event.sponsors ?? []) as SponsorEntry[]
  const customFields = (event.custom_fields ?? {}) as Record<string, unknown>
  const templateSchema = (event.template_schema ?? null) as Array<{ id: string; label: string }> | null

  // Build a map of field id → label from template schema for humanized labels
  const labelMap = new Map<string, string>()
  if (Array.isArray(templateSchema)) {
    for (const f of templateSchema) labelMap.set(f.id, f.label)
  }

  const hasCustomFields = customFields && Object.keys(customFields).length > 0
  const hasSpeakers = speakers.length > 0
  const hasSponsors = sponsors.length > 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-2">Event Info</h2>
      <dl>
        <DetailRow label="Event Mode">{modeLabel}</DetailRow>

        {event.end_date && String(event.end_date) !== String(event.event_date) ? (
          <DetailRow label="End Date">
            {new Date(event.end_date as string).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </DetailRow>
        ) : null}

        {event.end_time ? <DetailRow label="End Time">{String(event.end_time)}</DetailRow> : null}

        {event.timezone ? <DetailRow label="Timezone">{String(event.timezone)}</DetailRow> : null}

        {event.location_address ? <DetailRow label="Address">{String(event.location_address)}</DetailRow> : null}
        {event.location_url ? (
          <DetailRow label={event.event_mode === 'virtual' ? 'Meeting Link' : 'Venue Link'}>
            <a href={String(event.location_url)} target="_blank" rel="noopener noreferrer" className="text-sage-600 hover:underline break-all">
              {String(event.location_url)}
            </a>
          </DetailRow>
        ) : null}

        {event.description ? <DetailRow label="Description">{String(event.description)}</DetailRow> : null}
        {event.agenda ? <DetailRow label="Agenda">{String(event.agenda)}</DetailRow> : null}

        {hasSpeakers ? (
          <DetailRow label="Speakers">
            <div className="space-y-1">
              {speakers.map((s, i) => (
                <div key={i}>
                  <span className="font-medium">{s.name}</span>
                  {s.title ? <span className="text-gray-500"> — {s.title}</span> : null}
                  {s.bio ? <p className="text-gray-600 text-xs mt-0.5">{s.bio}</p> : null}
                </div>
              ))}
            </div>
          </DetailRow>
        ) : null}

        {hasSponsors ? (
          <DetailRow label="Sponsors">
            {sponsors.map((s) => `${s.name}${s.tier ? ` [${s.tier}]` : ''}`).join(', ')}
          </DetailRow>
        ) : null}

        {event.target_audience ? <DetailRow label="Target Audience">{String(event.target_audience)}</DetailRow> : null}
        {event.tone ? <DetailRow label="Tone">{humanize(String(event.tone))}</DetailRow> : null}

        {event.rsvp_link ? (
          <DetailRow label="RSVP Link">
            <a href={String(event.rsvp_link)} target="_blank" rel="noopener noreferrer" className="text-sage-600 hover:underline break-all">
              {String(event.rsvp_link)}
            </a>
          </DetailRow>
        ) : null}
        {event.rsvp_deadline ? (
          <DetailRow label="RSVP Deadline">
            {new Date(event.rsvp_deadline as string).toLocaleDateString()}
          </DetailRow>
        ) : null}

        {event.max_capacity ? <DetailRow label="Max Capacity">{String(event.max_capacity)}</DetailRow> : null}

        {Array.isArray(event.tags) && event.tags.length > 0 ? (
          <DetailRow label="Tags">
            <div className="flex flex-wrap gap-1">
              {(event.tags as string[]).map((t) => (
                <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          </DetailRow>
        ) : null}

        {event.notes ? <DetailRow label="Internal Notes">{String(event.notes)}</DetailRow> : null}

        {/* Custom fields from org template */}
        {hasCustomFields ? Object.entries(customFields).map(([key, value]) => {
          if (value === null || value === undefined || value === '') return null
          const label = labelMap.get(key) ?? humanize(key)
          const display = typeof value === 'object' ? JSON.stringify(value) : String(value)
          return (
            <DetailRow key={key} label={label}>{display}</DetailRow>
          )
        }) : null}
      </dl>
    </div>
  )
}
