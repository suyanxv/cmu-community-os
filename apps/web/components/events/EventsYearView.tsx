'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface YearEvent {
  id: string
  name: string
  cover_emoji: string | null
  event_date: string
  effective_end_date: string
  status: string
  category: 'internal' | 'partnered' | 'external'
  co_hosts: string[]
  location_name: string | null
  rsvp_count: number
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Category colors match CMU SF spreadsheet convention:
//   internal  → sage    (their default white cells → our brand green tint)
//   partnered → butter  (their yellow cells for co-hosted events)
//   external  → lavender (attending a 3rd-party event — distinct from both above)
// Cancelled events override to red-strikethrough regardless of category.
const CATEGORY_CLASSES: Record<string, string> = {
  internal:  'bg-sage-50 border-sage-200 hover:border-sage-400',
  partnered: 'bg-butter-50 border-butter-200 hover:border-butter-400',
  external:  'bg-lavender-50 border-lavender-200 hover:border-lavender-400',
}

const STATUS_TEXT_CLASS: Record<string, string> = {
  cancelled: 'line-through text-red-500',
  past:      'text-gray-500',
  draft:     'text-gray-700 italic',
  published: 'text-gray-900',
}

function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

interface YearViewProps {
  events: YearEvent[]
  /** Override the link target for each event card. Defaults to /events/[id]. */
  hrefFor?: (eventId: string) => string
}

export default function EventsYearView({ events, hrefFor }: YearViewProps) {
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const buildHref = hrefFor ?? ((id: string) => `/events/${id}`)

  const eventsByMonth = useMemo(() => {
    const buckets: YearEvent[][] = Array.from({ length: 12 }, () => [])
    for (const e of events) {
      const d = parseLocalDate(e.event_date)
      if (d.getFullYear() !== viewYear) continue
      buckets[d.getMonth()].push(e)
    }
    for (const b of buckets) {
      b.sort((a, z) => a.event_date.localeCompare(z.event_date))
    }
    return buckets
  }, [events, viewYear])

  const totalThisYear = eventsByMonth.reduce((s, b) => s + b.length, 0)
  const partneredCount = eventsByMonth.flat().filter((e) => e.category === 'partnered').length

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="text-base font-semibold text-gray-900">{viewYear}</h2>
          <p className="text-xs text-gray-500">
            {totalThisYear} event{totalThisYear === 1 ? '' : 's'}
            {partneredCount > 0 && ` · ${partneredCount} partnered`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewYear(now.getFullYear())}
            className="px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-stone-50"
          >
            This year
          </button>
          <button
            onClick={() => setViewYear(viewYear - 1)}
            aria-label="Previous year"
            className="p-1.5 text-gray-600 border border-gray-300 rounded-md hover:bg-stone-50"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <button
            onClick={() => setViewYear(viewYear + 1)}
            aria-label="Next year"
            className="p-1.5 text-gray-600 border border-gray-300 rounded-md hover:bg-stone-50"
          >
            <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-xs text-gray-500 mb-3 flex-wrap">
        <LegendDot className="bg-sage-200" label="Internal" />
        <LegendDot className="bg-butter-200" label="Partnered" />
        <LegendDot className="bg-lavender-200" label="External" />
        <span className="text-red-500 line-through">Cancelled</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {MONTHS.map((name, idx) => (
          <MonthCard
            key={name}
            name={name}
            isCurrent={viewYear === now.getFullYear() && idx === now.getMonth()}
            events={eventsByMonth[idx]}
            buildHref={buildHref}
          />
        ))}
      </div>
    </div>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block w-2.5 h-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  )
}

function MonthCard({
  name, isCurrent, events, buildHref,
}: {
  name: string; isCurrent: boolean; events: YearEvent[]; buildHref: (id: string) => string
}) {
  return (
    <div className={`border rounded-xl overflow-hidden bg-white ${isCurrent ? 'border-sage-400' : 'border-gray-200'}`}>
      <div className={`px-3 py-2 border-b text-sm font-semibold ${isCurrent ? 'bg-sage-50 text-sage-800 border-sage-200' : 'bg-stone-50 text-gray-700 border-gray-100'}`}>
        {name}
        {events.length > 0 && (
          <span className="text-xs font-normal text-gray-400 ml-1.5">· {events.length}</span>
        )}
      </div>
      <ul className="p-2 space-y-1.5 min-h-[60px]">
        {events.length === 0 ? (
          <li className="text-xs text-gray-300 px-1 py-1">—</li>
        ) : (
          events.map((e) => <EventLine key={e.id} e={e} buildHref={buildHref} />)
        )}
      </ul>
    </div>
  )
}

function EventLine({ e, buildHref }: { e: YearEvent; buildHref: (id: string) => string }) {
  const day = parseLocalDate(e.event_date).getDate()
  const categoryCls = CATEGORY_CLASSES[e.category] ?? CATEGORY_CLASSES.internal
  const textCls = STATUS_TEXT_CLASS[e.status] ?? STATUS_TEXT_CLASS.published
  const isCancelled = e.status === 'cancelled'

  return (
    <li>
      <Link
        href={buildHref(e.id)}
        className={`block text-xs border rounded-md px-2 py-1.5 transition-colors ${categoryCls} ${isCancelled ? 'opacity-70' : ''}`}
      >
        <div className="flex items-start gap-1.5">
          <span className="text-gray-500 font-medium shrink-0 tabular-nums">{day}</span>
          {e.cover_emoji && <span className="shrink-0" aria-hidden>{e.cover_emoji}</span>}
          <span className={`leading-snug flex-1 min-w-0 ${textCls}`}>
            {e.name}
            {e.co_hosts.length > 0 && (
              <span className="text-butter-700 font-normal"> · w/ {e.co_hosts.join(', ')}</span>
            )}
          </span>
        </div>
      </Link>
    </li>
  )
}
