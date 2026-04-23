'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Mail, Calendar as CalIcon, Check, UserCircle } from 'lucide-react'
import { CardListSkeleton } from '@/components/ui/Skeleton'
import { formatEventDate } from '@/lib/dates'

interface AttendeeEvent {
  event_id: string
  event_name: string
  event_date: string
  status: string
  check_in_at: string | null
}

interface Attendee {
  key: string
  name: string
  email: string | null
  rsvp_count: number
  check_in_count: number
  last_check_in: string | null
  last_rsvp: string | null
  events: AttendeeEvent[]
}

export default function AttendeesPage() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Debounce query to avoid hammering the server
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250)
    return () => clearTimeout(t)
  }, [query])

  const fetchAttendees = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/attendees?q=${encodeURIComponent(debouncedQuery)}`)
    if (res.ok) {
      const { data } = await res.json()
      setAttendees(data ?? [])
    }
    setLoading(false)
  }, [debouncedQuery])

  useEffect(() => { fetchAttendees() }, [fetchAttendees])

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Attendees</h1>
        <p className="text-sm text-gray-500 mt-1">
          Unique people from your RSVPs and check-ins. Search by name or email.
        </p>
      </div>

      <div className="relative max-w-md mb-5">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name or email…"
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
        />
      </div>

      {loading ? (
        <CardListSkeleton count={4} />
      ) : attendees.length === 0 ? (
        <div className="text-center py-16">
          <UserCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-gray-500">
            {debouncedQuery
              ? `No attendees match "${debouncedQuery}"`
              : 'No attendees yet — add RSVPs to events to populate this list.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {attendees.map((a) => {
            const isOpen = expanded.has(a.key)
            return (
              <div key={a.key} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleExpand(a.key)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-stone-50"
                >
                  <div className="h-10 w-10 rounded-full bg-sage-100 text-sage-700 flex items-center justify-center text-sm font-medium shrink-0">
                    {(a.name[0] ?? '?').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{a.name}</p>
                    {a.email && (
                      <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                        <Mail className="w-3 h-3" strokeWidth={1.75} /> {a.email}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0">
                    <span className="inline-flex items-center gap-1">
                      <CalIcon className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.75} />
                      {a.rsvp_count} RSVP{a.rsvp_count === 1 ? '' : 's'}
                    </span>
                    {a.check_in_count > 0 && (
                      <span className="inline-flex items-center gap-1 text-sage-700">
                        <Check className="w-3.5 h-3.5" strokeWidth={2} />
                        {a.check_in_count} check-in{a.check_in_count === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 p-3 space-y-1 bg-stone-50/50">
                    {a.events.map((ev) => (
                      <Link
                        key={`${a.key}-${ev.event_id}`}
                        href={`/events/${ev.event_id}`}
                        className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-white rounded"
                      >
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          ev.status === 'published' ? 'bg-green-500'
                          : ev.status === 'draft'   ? 'bg-butter-500'
                          : 'bg-stone-400'
                        }`} />
                        <span className="flex-1 truncate text-gray-800">{ev.event_name}</span>
                        <span className="text-xs text-gray-500">{formatEventDate(ev.event_date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        {ev.check_in_at && (
                          <Check className="w-3.5 h-3.5 text-sage-600" strokeWidth={2} />
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
