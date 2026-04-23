import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@/lib/db'
import BroadcastsSection from '@/components/events/BroadcastsSection'
import CheckInCard from '@/components/events/CheckInCard'
import DeleteEventButton from '@/components/events/DeleteEventButton'
import DuplicateEventButton from '@/components/events/DuplicateEventButton'
import EventPartnersSection from '@/components/events/EventPartnersSection'
import EventStatusControl from '@/components/events/EventStatusControl'
import GenerateRemindersButton from '@/components/reminders/GenerateRemindersButton'
import ShareEventButton from '@/components/events/ShareEventButton'
import { FileText, Ticket, Bell } from 'lucide-react'
import { formatEventDate } from '@/lib/dates'

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
      (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = e.id AND r.check_in_at IS NOT NULL)::int AS checked_in_count,
      o.settings->'event_template_schema' AS template_schema
    FROM events e
    JOIN organizations o ON o.id = e.org_id
    WHERE e.id = ${id} AND e.org_id = ${orgId}
  `
  if (!events[0]) notFound()
  const event = events[0]

  // Fetch hosts in a separate, fault-tolerant query so a missing
  // event_hosts table (pre-migration) doesn't break the whole page.
  let hosts: Array<Record<string, unknown>> = []
  try {
    hosts = await sql`
      SELECT u.id AS user_id, u.full_name, u.email, u.avatar_url, om.title
      FROM event_hosts eh
      JOIN users u ON u.id = eh.user_id
      LEFT JOIN org_members om ON om.user_id = u.id AND om.org_id = ${orgId}
      WHERE eh.event_id = ${id} AND eh.org_id = ${orgId}
      ORDER BY u.full_name
    `
  } catch {
    hosts = []
  }
  event.hosts = hosts

  const content = await sql`
    SELECT DISTINCT ON (channel) channel, subject_line, body, character_count, created_at
    FROM generated_content
    WHERE event_id = ${id} AND org_id = ${orgId}
    ORDER BY channel, version DESC
  `

  const hasContent = content.length > 0

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Back link */}
      <Link href="/events" className="text-sm text-gray-500 hover:text-gray-700 mb-3 block">
        ← Back to Events
      </Link>

      {/* Title block */}
      <div className="mb-4">
        <div className="flex items-start gap-3 flex-wrap">
          {event.cover_emoji ? <span className="text-3xl leading-none" aria-hidden>{event.cover_emoji as string}</span> : null}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 break-words">{event.name}</h1>
              <EventStatusControl eventId={id} initialStatus={event.status} />
            </div>
            <p className="text-gray-500 mt-1 text-sm">
              {formatEventDate(event.event_date as string)}
              {event.start_time && ` · ${event.start_time}`}
              {event.location_name && ` · ${event.location_name}`}
            </p>
          </div>
        </div>
      </div>

      {/* Action bar — always wraps onto its own line(s) on mobile */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        <Link href={`/events/${id}/content`} className="inline-flex items-center px-4 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 font-medium">
          {hasContent ? 'View Content' : 'Add Content'}
        </Link>
        <Link href={`/events/${id}/edit`} className="inline-flex items-center px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50">
          Edit
        </Link>
        <GenerateRemindersButton eventId={id} />
        <DuplicateEventButton eventId={id} />
        <ShareEventButton eventId={id} />
        <DeleteEventButton eventId={id} eventName={event.name} />
      </div>

      {/* Quick stats */}
      <CapacityStats rsvpCount={event.rsvp_count} totalGuests={event.total_guests} maxCapacity={event.max_capacity} channels={event.channels as string[]} />

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Link href={`/events/${id}/content`} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-sage-300 hover:shadow-sm transition-all">
          <FileText className="w-5 h-5 text-sage-600 mb-2" strokeWidth={1.75} />
          <p className="font-medium text-gray-900">Generated Content</p>
          <p className="text-sm text-gray-500 mt-1">
            {hasContent ? `${content.length} channels ready` : 'Not generated yet'}
          </p>
        </Link>
        <Link href={`/events/${id}/rsvps`} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-sage-300 hover:shadow-sm transition-all">
          <Ticket className="w-5 h-5 text-sage-600 mb-2" strokeWidth={1.75} />
          <p className="font-medium text-gray-900">RSVP Management</p>
          <p className="text-sm text-gray-500 mt-1">{event.rsvp_count} confirmed</p>
        </Link>
        <Link href={`/reminders?event_id=${id}`} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-sage-300 hover:shadow-sm transition-all">
          <Bell className="w-5 h-5 text-sage-600 mb-2" strokeWidth={1.75} />
          <p className="font-medium text-gray-900">Reminders</p>
          <p className="text-sm text-gray-500 mt-1">View & manage tasks</p>
        </Link>
      </div>

      {/* Event details */}
      <EventDetails event={event} />

      {/* Check-in */}
      <CheckInCard eventId={id} checkedInCount={event.checked_in_count ?? 0} rsvpCount={event.rsvp_count ?? 0} />

      {/* Broadcasts (email + WhatsApp) */}
      <BroadcastsSection eventId={id} eventName={event.name as string} />

      {/* Partners linked to this event */}
      <EventPartnersSection eventId={id} />
    </div>
  )
}

interface SpeakerEntry { name?: string; title?: string; bio?: string }
interface SponsorEntry { name?: string; tier?: string }
interface HostEntry { user_id: string; full_name: string | null; email: string; avatar_url: string | null; title: string | null }

function CapacityStats({
  rsvpCount,
  totalGuests,
  maxCapacity,
  channels,
}: {
  rsvpCount: number
  totalGuests: number
  maxCapacity: number | null
  channels: string[]
}) {
  const pct = maxCapacity && maxCapacity > 0
    ? Math.min(100, Math.round((totalGuests / maxCapacity) * 100))
    : null
  const barColor =
    pct === null ? ''
    : pct >= 100 ? 'bg-red-500'
    : pct >= 80  ? 'bg-butter-500'
    : 'bg-sage-500'

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8">
      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
        <p className="text-[11px] sm:text-sm text-gray-500">Confirmed RSVPs</p>
        <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{rsvpCount}</p>
        {maxCapacity && (
          <p className="text-[10px] sm:text-xs text-gray-400 mt-1 truncate">of {maxCapacity}</p>
        )}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
        <p className="text-[11px] sm:text-sm text-gray-500">Total Guests</p>
        <div className="flex items-baseline gap-1 sm:gap-2 mt-1">
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{totalGuests}</p>
          {pct !== null && <p className={`text-xs sm:text-sm font-medium ${pct >= 100 ? 'text-red-500' : pct >= 80 ? 'text-butter-700' : 'text-sage-700'}`}>{pct}%</p>}
        </div>
        {pct !== null && (
          <div className="h-1 sm:h-1.5 bg-stone-100 rounded-full overflow-hidden mt-2">
            <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 min-w-0">
        <p className="text-[11px] sm:text-sm text-gray-500">Channels</p>
        <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{channels.length}</p>
        <p className="text-[10px] sm:text-xs text-gray-400 mt-1 truncate">{channels.join(', ') || 'None'}</p>
      </div>
    </div>
  )
}

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
  const hosts = (event.hosts ?? []) as HostEntry[]
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
        {hosts.length > 0 && (
          <DetailRow label="Hosted By">
            <div className="flex flex-wrap gap-2">
              {hosts.map((h) => {
                const name = h.full_name ?? h.email
                return (
                  <span key={h.user_id} className="inline-flex items-center gap-2 px-2 py-1 bg-sage-50 border border-sage-200 rounded-full text-xs">
                    {h.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={h.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                    ) : (
                      <span className="h-5 w-5 rounded-full bg-sage-200 text-sage-800 flex items-center justify-center text-[10px] font-medium">
                        {(name[0] ?? '?').toUpperCase()}
                      </span>
                    )}
                    <span className="text-sage-800 font-medium">{name}</span>
                    {h.title && <span className="text-sage-600">· {h.title}</span>}
                  </span>
                )
              })}
            </div>
          </DetailRow>
        )}
        <DetailRow label="Event Mode">{modeLabel}</DetailRow>

        {Array.isArray(event.co_hosts) && (event.co_hosts as string[]).length > 0 ? (
          <DetailRow label="Co-hosted With">
            <div className="flex flex-wrap gap-1">
              {(event.co_hosts as string[]).map((c) => (
                <span key={c} className="text-xs bg-butter-50 border border-butter-200 text-butter-700 px-2 py-0.5 rounded-full">
                  {c}
                </span>
              ))}
            </div>
          </DetailRow>
        ) : null}

        {event.end_date && String(event.end_date).slice(0, 10) !== String(event.event_date).slice(0, 10) ? (
          <DetailRow label="End Date">
            {formatEventDate(event.end_date as string)}
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
            {formatEventDate(event.rsvp_deadline as string, { year: 'numeric', month: 'long', day: 'numeric' })}
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
