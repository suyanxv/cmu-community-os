'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { TableRowSkeleton } from '@/components/ui/Skeleton'

interface CheckedInAttendee {
  id: string
  name: string
  email: string | null
  graduation_year: string | null
  school: string | null
  how_heard: string | null
  whatsapp_joined: boolean | null
  check_in_at: string
  source: string
}

export default function AttendancePage() {
  const { id: eventId } = useParams<{ id: string }>()
  const [attendees, setAttendees] = useState<CheckedInAttendee[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchAttendees = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/rsvps?status=confirmed`)
    if (res.ok) {
      const { data } = await res.json()
      // Filter for rows that have check_in_at (actual attendees)
      const checked = (data as CheckedInAttendee[])
        .filter((a) => a.check_in_at)
        .sort((a, b) => b.check_in_at.localeCompare(a.check_in_at))
      setAttendees(checked)
    }
    setLoading(false)
  }, [eventId])

  useEffect(() => { fetchAttendees() }, [fetchAttendees])

  // Auto-refresh every 10 seconds while checked-in page is open
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchAttendees, 10000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchAttendees])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? attendees.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        (a.email?.toLowerCase().includes(q) ?? false) ||
        (a.school?.toLowerCase().includes(q) ?? false) ||
        (a.graduation_year?.toLowerCase().includes(q) ?? false)
      )
    : attendees

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
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
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-sage-700">{attendees.length}</span>
          <span className="text-sm text-gray-500">checked in</span>
        </div>
      </div>

      {/* Search + controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, school, year…"
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
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">School / Year</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Source</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {a.name}
                    <div className="text-xs text-gray-400 sm:hidden mt-0.5">{a.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{a.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell text-xs">
                    {[a.school, a.graduation_year].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                    <span className="text-xs bg-stone-100 px-2 py-0.5 rounded-full">
                      {a.source === 'check_in' ? 'Self check-in' : a.source.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs whitespace-nowrap">
                    {new Date(a.check_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
