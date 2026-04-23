'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, MapPin, Video, Users as UsersIcon } from 'lucide-react'
import { formatEventDate, localToday } from '@/lib/dates'

interface EventRow {
  id: string
  name: string
  status: string
  event_date: string
  start_time: string | null
  location_name: string | null
  location_address: string | null
  event_mode: 'in_person' | 'virtual' | 'hybrid'
  channels: string[]
  rsvp_count: number
  max_capacity: number | null
  effective_end_date: string
}

type FilterTab = 'all' | 'upcoming' | 'past' | 'draft'

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past',     label: 'Past' },
  { id: 'draft',    label: 'Drafts' },
]

export default function EventsList({ events }: { events: EventRow[] }) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<FilterTab>('all')
  const today = localToday()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return events.filter((e) => {
      // Tab filter
      if (tab === 'upcoming' && e.effective_end_date < today) return false
      if (tab === 'past' && e.effective_end_date >= today) return false
      if (tab === 'draft' && e.status !== 'draft') return false
      // Text filter
      if (!q) return true
      return (
        e.name.toLowerCase().includes(q) ||
        (e.location_name?.toLowerCase().includes(q) ?? false) ||
        e.channels.some((ch) => ch.includes(q))
      )
    })
  }, [events, query, tab, today])

  // Group upcoming + past sections only when viewing "All"
  const upcoming = tab === 'all'
    ? filtered.filter((e) => e.effective_end_date >= today).sort((a, b) => a.event_date.localeCompare(b.event_date))
    : tab === 'upcoming'
      ? filtered.sort((a, b) => a.event_date.localeCompare(b.event_date))
      : []
  const past = tab === 'all'
    ? filtered.filter((e) => e.effective_end_date < today).sort((a, b) => b.event_date.localeCompare(a.event_date))
    : tab === 'past'
      ? filtered.sort((a, b) => b.event_date.localeCompare(a.event_date))
      : []
  const drafts = tab === 'draft' ? filtered.sort((a, b) => b.event_date.localeCompare(a.event_date)) : []

  const tabCounts: Record<FilterTab, number> = {
    all: events.length,
    upcoming: events.filter((e) => e.effective_end_date >= today).length,
    past: events.filter((e) => e.effective_end_date < today).length,
    draft: events.filter((e) => e.status === 'draft').length,
  }

  return (
    <div>
      {/* Search + tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events by name, location, channel…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
          />
        </div>
        <div className="flex gap-1 bg-stone-100 p-1 rounded-lg w-fit">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                tab === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t.label} <span className="text-gray-400">{tabCounts[t.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">🔎</p>
          <p className="text-gray-500">
            {query ? `No events match "${query}"` : `No ${tab === 'all' ? '' : tab} events`}
          </p>
        </div>
      ) : tab === 'all' ? (
        <div className="space-y-6">
          {upcoming.length > 0 && <EventSection title="Upcoming" events={upcoming} />}
          {past.length > 0 && <EventSection title="Past" events={past} dim />}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {(tab === 'past' ? past : tab === 'draft' ? drafts : upcoming).map((event) => (
            <EventRowCard key={event.id} event={event} dim={tab === 'past'} />
          ))}
        </div>
      )}
    </div>
  )
}

function EventSection({ title, events, dim = false }: { title: string; events: EventRow[]; dim?: boolean }) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-2">
        {title} <span className="text-gray-400">· {events.length}</span>
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {events.map((event) => <EventRowCard key={event.id} event={event} dim={dim} />)}
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

  // Build the location text honestly across all event modes
  const mode = event.event_mode ?? 'in_person'
  const locationText =
    mode === 'virtual'
      ? 'Virtual'
      : [event.location_name, event.location_address].filter(Boolean).join(' · ') ||
        (mode === 'hybrid' ? 'Hybrid' : 'Location TBD')
  const LocationIcon = mode === 'virtual' ? Video : MapPin

  return (
    <Link
      href={`/events/${event.id}`}
      className={`block bg-white border border-gray-200 rounded-xl p-4 hover:border-sage-300 hover:shadow-sm transition-all ${dim ? 'opacity-75 hover:opacity-100' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 truncate">{event.name}</h3>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${statusStyle}`}>
              {event.status}
            </span>
          </div>
          <p className="flex items-center gap-1.5 text-sm text-gray-500">
            <CalendarDays className="w-3.5 h-3.5 text-gray-400 shrink-0" strokeWidth={1.75} />
            <span className="truncate">{formatEventDate(event.event_date)}</span>
          </p>
          <p className="flex items-center gap-1.5 text-sm text-gray-500">
            <LocationIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" strokeWidth={1.75} />
            <span className="truncate">{locationText}</span>
            {mode === 'hybrid' && <span className="text-[11px] bg-lavender-100 text-lavender-700 px-1.5 py-0.5 rounded">Hybrid</span>}
          </p>
          {event.channels && event.channels.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              {event.channels.map((ch) => (
                <span key={ch} className="text-[11px] bg-stone-100 text-gray-600 px-1.5 py-0.5 rounded">
                  {ch}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          {capacityPct !== null ? (
            <div className="w-28">
              <div className="flex items-baseline justify-between text-xs text-gray-500 mb-1">
                <span className="font-medium text-gray-700">{event.rsvp_count}/{event.max_capacity}</span>
                <span>{capacityPct}%</span>
              </div>
              <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div className={`h-full ${barColor} transition-all`} style={{ width: `${capacityPct}%` }} />
              </div>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm text-gray-500">
              <UsersIcon className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.75} />
              {event.rsvp_count}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
