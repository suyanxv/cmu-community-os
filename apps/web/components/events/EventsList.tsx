'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, MapPin, Video, Users as UsersIcon, Trash2, X, CheckSquare } from 'lucide-react'
import { formatEventDate, localToday } from '@/lib/dates'
import { useToast } from '@/components/ui/Toast'

interface EventHost {
  user_id: string
  name: string
  avatar_url: string | null
}

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
  tags: string[]
  rsvp_count: number
  max_capacity: number | null
  effective_end_date: string
  hosts: EventHost[]
}

type FilterTab = 'all' | 'upcoming' | 'past' | 'draft'

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past',     label: 'Past' },
  { id: 'draft',    label: 'Drafts' },
]

export default function EventsList({ events }: { events: EventRow[] }) {
  const router = useRouter()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<FilterTab>('all')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const today = localToday()

  // Distinct tags across the fetched events, sorted alphabetically
  const allTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of events) {
      for (const t of e.tags ?? []) {
        counts.set(t, (counts.get(t) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }))
  }, [events])

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const deleteSelected = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    if (!confirm(`Permanently delete ${ids.length} event${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    setDeleting(true)
    const res = await fetch('/api/events/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setDeleting(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to delete events')
      return
    }
    const { data } = await res.json()
    toast.success(`Deleted ${data.deleted} event${data.deleted === 1 ? '' : 's'}`)
    exitSelectMode()
    router.refresh()
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return events.filter((e) => {
      // Tab filter
      if (tab === 'upcoming' && e.effective_end_date < today) return false
      if (tab === 'past' && e.effective_end_date >= today) return false
      if (tab === 'draft' && e.status !== 'draft') return false
      // Tag filter: AND across active tags (event must have all selected)
      if (activeTags.size > 0) {
        const eventTags = new Set(e.tags ?? [])
        for (const t of activeTags) if (!eventTags.has(t)) return false
      }
      // Text filter
      if (!q) return true
      return (
        e.name.toLowerCase().includes(q) ||
        (e.location_name?.toLowerCase().includes(q) ?? false) ||
        e.channels.some((ch) => ch.includes(q)) ||
        (e.tags ?? []).some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [events, query, tab, today, activeTags])

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
      {/* Select-mode toolbar */}
      {selectMode && (
        <div className="mb-4 flex items-center justify-between gap-3 bg-sage-50 border border-sage-200 rounded-lg px-4 py-2.5">
          <p className="text-sm text-sage-800">
            <span className="font-medium">{selectedIds.size}</span> selected
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={deleteSelected}
              disabled={deleting || selectedIds.size === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.75} />
              {deleting ? 'Deleting…' : `Delete ${selectedIds.size}`}
            </button>
            <button
              onClick={exitSelectMode}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-stone-100 disabled:opacity-50"
            >
              <X className="w-4 h-4" strokeWidth={1.75} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search + tabs + select */}
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
        {!selectMode && (
          <button
            onClick={() => setSelectMode(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-stone-50"
            title="Select multiple events"
          >
            <CheckSquare className="w-3.5 h-3.5" strokeWidth={1.75} /> Select
          </button>
        )}
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-4 -mt-1">
          <span className="text-xs text-gray-500 mr-1">Tags:</span>
          {allTags.map(({ tag, count }) => {
            const active = activeTags.has(tag)
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${
                  active
                    ? 'bg-sage-100 border-sage-400 text-sage-800'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-sage-300'
                }`}
              >
                {tag}
                <span className="text-gray-400">{count}</span>
              </button>
            )
          })}
          {activeTags.size > 0 && (
            <button
              onClick={() => setActiveTags(new Set())}
              className="text-xs text-gray-500 hover:text-gray-700 underline ml-1"
            >
              clear
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">🔎</p>
          <p className="text-gray-500">
            {query ? `No events match "${query}"` : `No ${tab === 'all' ? '' : tab} events`}
          </p>
        </div>
      ) : tab === 'all' ? (
        <div className="space-y-6">
          {upcoming.length > 0 && <EventSection title="Upcoming" events={upcoming} selectMode={selectMode} selectedIds={selectedIds} onToggle={toggleSelected} />}
          {past.length > 0 && <EventSection title="Past" events={past} dim selectMode={selectMode} selectedIds={selectedIds} onToggle={toggleSelected} />}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {(tab === 'past' ? past : tab === 'draft' ? drafts : upcoming).map((event) => (
            <EventRowCard
              key={event.id}
              event={event}
              dim={tab === 'past'}
              selectMode={selectMode}
              selected={selectedIds.has(event.id)}
              onToggle={toggleSelected}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface SectionProps {
  title: string
  events: EventRow[]
  dim?: boolean
  selectMode: boolean
  selectedIds: Set<string>
  onToggle: (id: string) => void
}

function EventSection({ title, events, dim = false, selectMode, selectedIds, onToggle }: SectionProps) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-2">
        {title} <span className="text-gray-400">· {events.length}</span>
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {events.map((event) => (
          <EventRowCard
            key={event.id}
            event={event}
            dim={dim}
            selectMode={selectMode}
            selected={selectedIds.has(event.id)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </section>
  )
}

interface CardProps {
  event: EventRow
  dim: boolean
  selectMode: boolean
  selected: boolean
  onToggle: (id: string) => void
}

function EventRowCard({ event, dim, selectMode, selected, onToggle }: CardProps) {
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

  const cardClass = `relative block w-full text-left bg-white border rounded-xl p-4 transition-all ${
    selected ? 'border-sage-500 ring-2 ring-sage-200' : 'border-gray-200 hover:border-sage-300 hover:shadow-sm'
  } ${dim ? 'opacity-75 hover:opacity-100' : ''}`

  const cardBody = (
    <>
      {selectMode && (
        <div className={`absolute top-3 right-3 h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 ${
          selected ? 'border-sage-500 bg-sage-500' : 'border-gray-300 bg-white'
        }`}>
          {selected && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      )}
      <div className={`flex items-start justify-between gap-3 ${selectMode ? 'pr-7' : ''}`}>
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
          {event.hosts && event.hosts.length > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <div className="flex -space-x-1.5 shrink-0">
                {event.hosts.slice(0, 3).map((h) =>
                  h.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={h.user_id} src={h.avatar_url} alt="" className="h-5 w-5 rounded-full border border-white object-cover" />
                  ) : (
                    <span key={h.user_id} className="h-5 w-5 rounded-full border border-white bg-sage-100 text-sage-700 flex items-center justify-center text-[10px] font-medium">
                      {(h.name[0] ?? '?').toUpperCase()}
                    </span>
                  )
                )}
              </div>
              <span className="truncate">
                {event.hosts.length === 1
                  ? event.hosts[0].name
                  : event.hosts.length === 2
                    ? `${event.hosts[0].name} & ${event.hosts[1].name}`
                    : `${event.hosts[0].name} & ${event.hosts.length - 1} others`}
              </span>
            </div>
          )}
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
    </>
  )

  if (selectMode) {
    return (
      <button
        type="button"
        onClick={() => onToggle(event.id)}
        className={cardClass}
      >
        {cardBody}
      </button>
    )
  }

  return (
    <Link href={`/events/${event.id}`} className={cardClass}>
      {cardBody}
    </Link>
  )
}
