import Link from 'next/link'
import { notFound } from 'next/navigation'
import { sql } from '@/lib/db'
import { formatEventDate } from '@/lib/dates'
import { ArrowLeft, Calendar, MapPin, Video, Clock, ExternalLink } from 'lucide-react'

type Params = { params: Promise<{ token: string; id: string }> }

// Public read-only event detail. Accessed via the org's share token.
// Shows only information the org has explicitly published — no RSVP rolls,
// no internal notes, no partner contact info.
export default async function PublicEventPage({ params }: Params) {
  const { token, id } = await params
  if (!token || token.length < 8) notFound()

  const orgs = await sql`
    SELECT id, name, settings->'public_contact' AS public_contact
    FROM organizations
    WHERE public_share_token = ${token}
  `
  if (!orgs[0]) notFound()
  const org = orgs[0]
  const contact = (org.public_contact ?? null) as { name: string | null; email: string | null } | null

  const rows = await sql`
    SELECT
      id, name, status, category, co_hosts, cover_emoji,
      to_char(event_date, 'YYYY-MM-DD') AS event_date,
      to_char(COALESCE(end_date, event_date), 'YYYY-MM-DD') AS end_date,
      start_time, end_time, timezone,
      location_name, location_address, location_url, event_mode,
      description, agenda, speakers, rsvp_link, rsvp_deadline
    FROM events
    WHERE id = ${id}
      AND org_id = ${org.id}
      AND status IN ('published', 'past', 'cancelled')
  `
  if (!rows[0]) notFound()
  const e = rows[0]

  const isCancelled = e.status === 'cancelled'
  const isPast = e.status === 'past'
  const speakers = Array.isArray(e.speakers) ? (e.speakers as Array<{ name: string; title?: string; bio?: string }>) : []
  const coHosts = Array.isArray(e.co_hosts) ? (e.co_hosts as string[]) : []

  const modeLabel = e.event_mode === 'virtual' ? 'Virtual' : e.event_mode === 'hybrid' ? 'Hybrid' : 'In-Person'
  const LocationIcon = e.event_mode === 'virtual' ? Video : MapPin
  const locationText = e.event_mode === 'virtual'
    ? 'Virtual'
    : [e.location_name, e.location_address].filter(Boolean).join(', ') || 'Location TBD'

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between flex-wrap gap-2">
          <Link href={`/c/${token}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" strokeWidth={1.75} /> {org.name as string}
          </Link>
          <div className="text-xs text-gray-400">
            <Link href="/" className="hover:text-gray-600">Powered by Quorum</Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Title */}
        <div className="mb-5">
          <div className="flex items-start gap-3 flex-wrap">
            {e.cover_emoji ? <span className="text-4xl leading-none" aria-hidden>{e.cover_emoji as string}</span> : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className={`text-2xl font-bold break-words ${isCancelled ? 'text-red-600 line-through' : 'text-gray-900'}`}>
                  {e.name as string}
                </h1>
                {isCancelled && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Cancelled</span>}
                {isPast && !isCancelled && <span className="text-xs bg-stone-200 text-stone-600 px-2 py-0.5 rounded-full font-medium">Past</span>}
              </div>
              {coHosts.length > 0 && (
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  <span className="text-xs text-gray-400">with</span>
                  {coHosts.map((c) => (
                    <span key={c} className="text-xs bg-butter-50 border border-butter-200 text-butter-700 px-2 py-0.5 rounded-full">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Key facts */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5 space-y-3">
          <div className="flex items-start gap-2.5 text-sm">
            <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" strokeWidth={1.75} />
            <div>
              <p className="font-medium text-gray-900">{formatEventDate(e.event_date as string)}</p>
              {e.end_date && (e.end_date as string).slice(0, 10) !== (e.event_date as string).slice(0, 10) && (
                <p className="text-xs text-gray-500">through {formatEventDate(e.end_date as string)}</p>
              )}
            </div>
          </div>

          {(e.start_time || e.end_time) && (
            <div className="flex items-center gap-2.5 text-sm">
              <Clock className="w-4 h-4 text-gray-400 shrink-0" strokeWidth={1.75} />
              <p className="text-gray-700">
                {e.start_time ? String(e.start_time).slice(0, 5) : ''}
                {e.end_time ? ` – ${String(e.end_time).slice(0, 5)}` : ''}
                {e.timezone ? <span className="text-gray-400"> {String(e.timezone).replace('America/', '')}</span> : null}
              </p>
            </div>
          )}

          <div className="flex items-start gap-2.5 text-sm">
            <LocationIcon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" strokeWidth={1.75} />
            <div className="min-w-0">
              <p className="text-gray-700">{locationText}</p>
              <p className="text-xs text-gray-400 mt-0.5">{modeLabel}</p>
              {e.location_url && (
                <a
                  href={e.location_url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-sage-700 hover:underline inline-flex items-center gap-1 mt-1 break-all"
                >
                  {e.event_mode === 'virtual' ? 'Join link' : 'Map / directions'}
                  <ExternalLink className="w-3 h-3" strokeWidth={1.75} />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* RSVP CTA */}
        {e.rsvp_link && !isCancelled && !isPast && (
          <a
            href={e.rsvp_link as string}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center bg-sage-600 text-white px-5 py-3 rounded-xl text-sm font-medium hover:bg-sage-700 mb-5"
          >
            RSVP →
          </a>
        )}

        {/* Description */}
        {e.description && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{e.description as string}</p>
          </div>
        )}

        {/* Agenda */}
        {e.agenda && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Agenda</h2>
            <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{e.agenda as string}</p>
          </div>
        )}

        {/* Speakers */}
        {speakers.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Speakers</h2>
            <div className="space-y-3">
              {speakers.map((s, i) => (
                <div key={i}>
                  <p className="text-sm font-medium text-gray-900">{s.name}</p>
                  {s.title && <p className="text-xs text-gray-500">{s.title}</p>}
                  {s.bio && <p className="text-sm text-gray-600 mt-1">{s.bio}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-xs text-gray-400 text-center">
        Curated by {org.name as string}.
        {contact?.email ? (
          <> For questions, reach out to{' '}
            {contact.name ? <span className="text-gray-500">{contact.name}</span> : null}
            {contact.name ? ' at ' : ''}
            <a href={`mailto:${contact.email}`} className="text-sage-700 hover:underline">{contact.email}</a>.
          </>
        ) : (
          <> For questions, reach out to the organizer directly.</>
        )}
      </footer>
    </div>
  )
}
