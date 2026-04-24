'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { TableRowSkeleton } from '@/components/ui/Skeleton'

interface CheckedInAttendee {
  id: string
  name: string
  email: string | null
  check_in_at: string
  source: string
  check_in_data: Record<string, string | boolean> | null
  // Legacy columns still present; prefer check_in_data
  graduation_year: string | null
  school: string | null
  how_heard: string | null
}

// "Was this person on the list before they walked in?"
// csv_import / manual / rsvp_form → had an RSVP, then attended
// check_in → didn't RSVP, walked in cold
function hadPriorRsvp(source: string | null | undefined): boolean {
  return !!source && source !== 'check_in'
}

interface FieldDef { id: string; label: string }

export default function AttendancePage() {
  const { id: eventId } = useParams<{ id: string }>()
  const [attendees, setAttendees] = useState<CheckedInAttendee[]>([])
  const [fields, setFields] = useState<FieldDef[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchAttendees = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/rsvps?status=confirmed`)
    if (res.ok) {
      const { data } = await res.json()
      const checked = (data as CheckedInAttendee[])
        .filter((a) => a.check_in_at)
        .sort((a, b) => b.check_in_at.localeCompare(a.check_in_at))
      setAttendees(checked)
    }
    setLoading(false)
  }, [eventId])

  // One-time fetch of the event's check-in field schema so we can label JSONB values
  useEffect(() => {
    fetch(`/api/events/${eventId}`)
      .then((r) => r.json())
      .then((d) => {
        const cfg = d?.data?.checkin_config as { fields?: FieldDef[] } | undefined
        if (cfg?.fields && Array.isArray(cfg.fields)) setFields(cfg.fields)
        else setFields([
          { id: 'graduation_year', label: 'Graduation Year' },
          { id: 'school',          label: 'School / Program' },
          { id: 'how_heard',       label: 'How Heard' },
        ])
      })
      .catch(() => {})
  }, [eventId])

  useEffect(() => { fetchAttendees() }, [fetchAttendees])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchAttendees, 10000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchAttendees])

  const getFieldValue = (a: CheckedInAttendee, id: string): string => {
    // Prefer check_in_data JSONB; fall back to legacy typed columns
    const fromJson = a.check_in_data?.[id]
    if (typeof fromJson === 'string') return fromJson
    if (typeof fromJson === 'boolean') return fromJson ? 'Yes' : 'No'
    if (id === 'graduation_year' && a.graduation_year) return a.graduation_year
    if (id === 'school' && a.school) return a.school
    if (id === 'how_heard' && a.how_heard) return a.how_heard
    return ''
  }

  const q = query.trim().toLowerCase()
  const filtered = q
    ? attendees.filter((a) => {
        if (a.name.toLowerCase().includes(q)) return true
        if (a.email?.toLowerCase().includes(q)) return true
        return fields.some((f) => getFieldValue(a, f.id).toLowerCase().includes(q))
      })
    : attendees

  const exportCsv = () => {
    window.location.href = `/api/events/${eventId}/rsvps/export`
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <Link href={`/events/${eventId}`} className="text-sm text-gray-500 hover:text-gray-700 mb-2 block">
        ← Back to Event
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-500 mt-1">
            Live list of checked-in attendees. Updates every 10 seconds.
          </p>
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-3xl font-bold text-sage-700">{attendees.length}</span>
          <span className="text-sm text-gray-500">checked in</span>
          {(() => {
            const rsvped = attendees.filter((a) => hadPriorRsvp(a.source)).length
            const walkIns = attendees.length - rsvped
            return (attendees.length > 0) ? (
              <span className="text-xs text-gray-400 ml-2">
                {rsvped} RSVPed · {walkIns} walk-in{walkIns === 1 ? '' : 's'}
              </span>
            ) : null
          })()}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search attendees…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="h-4 w-4"
          />
          Auto-refresh
        </label>
        <button
          onClick={fetchAttendees}
          className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-stone-50"
        >
          ↻ Refresh
        </button>
        <button
          onClick={exportCsv}
          className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-stone-50"
        >
          ⬇️ Export CSV
        </button>
      </div>

      {loading ? (
        <TableRowSkeleton count={5} />
      ) : attendees.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-lg font-medium text-gray-900">No check-ins yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Share the QR code from the event page so attendees can check themselves in.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No attendees match &ldquo;{query}&rdquo;
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Email</th>
                  {fields.map((f) => (
                    <th key={f.id} className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">{f.label}</th>
                  ))}
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((a) => {
                  const extras = fields.map((f) => ({ label: f.label, value: getFieldValue(a, f.id) })).filter((e) => e.value)
                  return (
                    <tr key={a.id} className="hover:bg-stone-50 align-top">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{a.name}</span>
                          {hadPriorRsvp(a.source) ? (
                            <span className="text-[10px] uppercase tracking-wide bg-sage-50 text-sage-700 border border-sage-200 px-1.5 py-0.5 rounded-full font-medium">
                              RSVPed
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase tracking-wide bg-butter-50 text-butter-700 border border-butter-200 px-1.5 py-0.5 rounded-full font-medium">
                              Walk-in
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 sm:hidden mt-0.5">{a.email}</div>
                        {extras.length > 0 && (
                          <div className="text-xs text-gray-500 lg:hidden mt-1 space-y-0.5">
                            {extras.map((e) => (
                              <div key={e.label}><span className="text-gray-400">{e.label}:</span> {e.value}</div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{a.email ?? '—'}</td>
                      {fields.map((f) => (
                        <td key={f.id} className="px-4 py-3 text-gray-600 hidden lg:table-cell text-xs">
                          {getFieldValue(a, f.id) || '—'}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right text-gray-400 text-xs whitespace-nowrap">
                        {new Date(a.check_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
