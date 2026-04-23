import Link from 'next/link'
import { notFound } from 'next/navigation'
import { sql } from '@/lib/db'
import EventsYearView from '@/components/events/EventsYearView'

type Params = { params: Promise<{ token: string }> }

interface PublicEvent {
  id: string
  name: string
  cover_emoji: string | null
  event_date: string
  effective_end_date: string
  status: string
  category: 'internal' | 'partnered' | 'external'
  co_hosts: string[]
  location_name: string | null
  start_time: string | null
  rsvp_link: string | null
  event_mode: string
}

// Minimal layout — no sidebar, no auth. This page is embedded in emails,
// Slack messages, or opened on a board member's phone. Keep it focused.
export default async function PublicCalendarPage({ params }: Params) {
  const { token } = await params
  if (!token || token.length < 8) notFound()

  const orgs = await sql`
    SELECT id, name FROM organizations WHERE public_share_token = ${token}
  `
  if (!orgs[0]) notFound()
  const org = orgs[0]

  const rows = await sql`
    SELECT
      id, name, status, category, co_hosts, cover_emoji,
      to_char(event_date, 'YYYY-MM-DD') AS event_date,
      to_char(COALESCE(end_date, event_date), 'YYYY-MM-DD') AS effective_end_date,
      start_time, location_name, event_mode, rsvp_link
    FROM events
    WHERE org_id = ${org.id}
      AND status IN ('published', 'past', 'cancelled')
    ORDER BY event_date DESC
    LIMIT 200
  `

  const events: PublicEvent[] = rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    cover_emoji: (r.cover_emoji as string) ?? null,
    event_date: r.event_date as string,
    effective_end_date: r.effective_end_date as string,
    status: r.status as string,
    category: ((r.category as string) ?? 'internal') as 'internal' | 'partnered' | 'external',
    co_hosts: Array.isArray(r.co_hosts) ? (r.co_hosts as string[]) : [],
    location_name: (r.location_name as string) ?? null,
    start_time: (r.start_time as string) ?? null,
    rsvp_link: (r.rsvp_link as string) ?? null,
    event_mode: (r.event_mode as string) ?? 'in_person',
  }))

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between flex-wrap gap-2">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-medium">Events calendar</p>
            <h1 className="text-xl font-bold text-gray-900 truncate">{org.name as string}</h1>
          </div>
          <div className="text-xs text-gray-400 shrink-0">
            <Link href="/" className="hover:text-gray-600">Powered by Quorum</Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <PublicYearView events={events} token={token} />
      </main>

      <footer className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-xs text-gray-400">
        Read-only view. Events are curated by {org.name as string}. For questions or to RSVP, reach out to the organizer directly.
      </footer>
    </div>
  )
}

// Thin wrapper — the shared year view expects `rsvp_count` + `location_name`
// on its items. We don't expose RSVP counts publicly, so we pass 0 and drop it
// from the source props only where shown (YearView doesn't render it anyway in
// the month grid).
function PublicYearView({ events, token }: { events: PublicEvent[]; token: string }) {
  const mapped = events.map((e) => ({
    id: e.id,
    name: e.name,
    cover_emoji: e.cover_emoji,
    event_date: e.event_date,
    effective_end_date: e.effective_end_date,
    status: e.status,
    category: e.category,
    co_hosts: e.co_hosts,
    location_name: e.location_name,
    rsvp_count: 0,
  }))

  if (events.length === 0) {
    return (
      <div className="text-center py-20 bg-white border border-gray-200 rounded-xl">
        <p className="text-4xl mb-3">📅</p>
        <p className="text-lg font-medium text-gray-900">No events published yet</p>
        <p className="text-sm text-gray-500 mt-1">Check back soon.</p>
      </div>
    )
  }

  return <EventsYearView events={mapped} hrefFor={(id) => `/c/${token}/events/${id}`} />
}
