'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Check, Upload, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { TableRowSkeleton } from '@/components/ui/Skeleton'

interface Rsvp {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: 'confirmed' | 'waitlist' | 'cancelled'
  guest_count: number
  notes: string | null
  source: string | null
  check_in_at: string | null
  created_at: string
}

interface Summary { confirmed: number; waitlist: number; cancelled: number; total_guests: number }

export default function RsvpPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const toast = useToast()
  const [rsvps, setRsvps] = useState<Rsvp[]>([])
  const [summary, setSummary] = useState<Summary>({ confirmed: 0, waitlist: 0, cancelled: 0, total_guests: 0 })
  const [eventDate, setEventDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', guest_count: '1', notes: '', status: 'confirmed' })
  const [saving, setSaving] = useState(false)

  // Bulk import textarea state
  const [csvText, setCsvText] = useState('')
  const [importing, setImporting] = useState(false)

  const fetchRsvps = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/rsvps`)
    if (res.ok) {
      const data = await res.json()
      setRsvps(data.data)
      setSummary(data.summary)
    }
    setLoading(false)
  }, [eventId])

  // Pull event date once so we can decide whether to render "No-show" for
  // missed check-ins on past events.
  useEffect(() => {
    fetch(`/api/events/${eventId}`)
      .then((r) => r.json())
      .then((d) => setEventDate(d?.data?.event_date ? String(d.data.event_date).slice(0, 10) : null))
      .catch(() => {})
  }, [eventId])

  useEffect(() => { fetchRsvps() }, [fetchRsvps])

  const isPastEvent = useMemo(() => {
    if (!eventDate) return false
    return eventDate < new Date().toISOString().slice(0, 10)
  }, [eventDate])

  const addRsvp = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(`/api/events/${eventId}/rsvps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, guest_count: parseInt(form.guest_count) }),
    })
    if (res.ok) {
      toast.success(`${form.name} added to RSVPs`)
      setForm({ name: '', email: '', phone: '', guest_count: '1', notes: '', status: 'confirmed' })
      setShowForm(false)
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to add RSVP')
    }
    setSaving(false)
    await fetchRsvps()
  }

  const importCsv = async () => {
    if (!csvText.trim()) { toast.error('Paste some CSV first'); return }
    setImporting(true)
    const res = await fetch(`/api/events/${eventId}/rsvps/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: csvText }),
    })
    setImporting(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Import failed')
      return
    }
    const { imported, errors } = await res.json()
    if (imported === 0) {
      toast.error('No rows imported. Check that headers include at least Name.')
    } else if (errors && errors.length > 0) {
      toast.success(`${imported} RSVPs imported, ${errors.length} skipped`)
    } else {
      toast.success(`${imported} RSVPs imported`)
    }
    setCsvText('')
    setShowImport(false)
    await fetchRsvps()
  }

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/events/${eventId}/rsvps/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await fetchRsvps()
  }

  const deleteRsvp = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from the RSVP list?`)) return
    await fetch(`/api/events/${eventId}/rsvps/${id}`, { method: 'DELETE' })
    toast.success(`${name} removed`)
    await fetchRsvps()
  }

  const exportCsv = () => {
    window.location.href = `/api/events/${eventId}/rsvps/export`
  }

  const inputClass = 'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-sage-500'

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <div>
          <Link href={`/events/${eventId}`} className="text-sm text-gray-500 hover:text-gray-700 mb-2 block">
            ← Back to Event
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">RSVPs</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportCsv} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50">
            Export CSV
          </button>
          <button onClick={() => { setShowImport(true); setShowForm(false) }} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50 inline-flex items-center gap-1.5">
            <Upload className="w-4 h-4" strokeWidth={1.75} /> Import
          </button>
          <button onClick={() => { setShowForm(true); setShowImport(false) }} className="px-4 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700">
            + Add RSVP
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Confirmed', value: summary.confirmed, color: 'text-green-700' },
          { label: 'Waitlist', value: summary.waitlist, color: 'text-yellow-700' },
          { label: 'Cancelled', value: summary.cancelled, color: 'text-red-700' },
          { label: 'Total Guests', value: summary.total_guests, color: 'text-sage-700' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Add RSVP form */}
      {showForm && (
        <form onSubmit={addRsvp} className="bg-white border border-sage-200 rounded-xl p-5 mb-6 space-y-3">
          <h3 className="font-medium text-gray-900">Add RSVP</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input required placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
            <input type="number" min={1} placeholder="Guests" value={form.guest_count} onChange={(e) => setForm({ ...form, guest_count: e.target.value })} className={inputClass} />
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputClass}>
              <option value="confirmed">Confirmed</option>
              <option value="waitlist">Waitlist</option>
            </select>
          </div>
          <input placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass} />
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add RSVP'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Bulk paste import */}
      {showImport && (
        <div className="bg-white border border-sage-200 rounded-xl p-5 mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900 inline-flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-sage-600" strokeWidth={1.75} /> Bulk import RSVPs
            </h3>
            <button onClick={() => setShowImport(false)} className="text-gray-400 hover:text-gray-600 p-1">
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
          <p className="text-sm text-gray-500">
            Paste rows from a spreadsheet (Google Sheets, Excel) or CSV text. First row should be headers. Recognized columns: <code className="text-xs bg-stone-100 px-1 rounded">Name</code> (required), <code className="text-xs bg-stone-100 px-1 rounded">Email</code>, <code className="text-xs bg-stone-100 px-1 rounded">Phone</code>, <code className="text-xs bg-stone-100 px-1 rounded">Guests</code>, <code className="text-xs bg-stone-100 px-1 rounded">Status</code>, <code className="text-xs bg-stone-100 px-1 rounded">Notes</code>. Casing doesn&apos;t matter.
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={8}
            placeholder={'Name,Email,Guests\nJane Doe,jane@example.com,2\nJohn Smith,john@example.com,1'}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sage-500"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={importCsv}
              disabled={importing || !csvText.trim()}
              className="px-4 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 disabled:opacity-50"
            >
              {importing ? 'Importing…' : 'Import'}
            </button>
            <button onClick={() => { setShowImport(false); setCsvText('') }} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50">
              Cancel
            </button>
            {csvText && (
              <span className="text-xs text-gray-400 ml-auto">{csvText.split('\n').filter((l) => l.trim()).length - 1} data rows</span>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <TableRowSkeleton count={4} />
      ) : rsvps.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No RSVPs yet. Add one above or import a CSV.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-stone-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Guests</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Attendance</th>
                <th className="w-10 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rsvps.map((r) => (
                <tr key={r.id} className="hover:bg-stone-50 group">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-3 text-gray-500">{r.email ?? '-'}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{r.guest_count}</td>
                  <td className="px-4 py-3 text-center">
                    <select
                      value={r.status}
                      onChange={(e) => updateStatus(r.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-full border font-medium ${
                        r.status === 'confirmed' ? 'bg-green-50 border-green-200 text-green-700' :
                        r.status === 'waitlist' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                        'bg-red-50 border-red-200 text-red-700'
                      }`}
                    >
                      <option value="confirmed">Confirmed</option>
                      <option value="waitlist">Waitlist</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <AttendanceCell checkInAt={r.check_in_at} status={r.status} isPastEvent={isPastEvent} />
                  </td>
                  <td className="px-2 text-right">
                    <button
                      onClick={() => deleteRsvp(r.id, r.name)}
                      className="text-gray-300 hover:text-red-600 p-1.5 rounded transition-colors"
                      title="Remove RSVP"
                      aria-label={`Delete RSVP for ${r.name}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                      </svg>
                    </button>
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

function AttendanceCell({
  checkInAt,
  status,
  isPastEvent,
}: {
  checkInAt: string | null
  status: string
  isPastEvent: boolean
}) {
  if (checkInAt) {
    const t = new Date(checkInAt)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-sage-700">
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-sage-600 text-white">
          <Check className="w-3 h-3" strokeWidth={3} />
        </span>
        Checked in
        <span className="text-gray-400">·</span>
        <span className="text-gray-500">{t.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
      </span>
    )
  }
  if (isPastEvent && status === 'confirmed') {
    return (
      <span className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full font-medium">
        No-show
      </span>
    )
  }
  return <span className="text-xs text-gray-300">—</span>
}
