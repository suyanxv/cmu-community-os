'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Rsvp {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: 'confirmed' | 'waitlist' | 'cancelled'
  guest_count: number
  notes: string | null
  created_at: string
}

interface Summary { confirmed: number; waitlist: number; cancelled: number; total_guests: number }

export default function RsvpPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const [rsvps, setRsvps] = useState<Rsvp[]>([])
  const [summary, setSummary] = useState<Summary>({ confirmed: 0, waitlist: 0, cancelled: 0, total_guests: 0 })
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', guest_count: '1', notes: '', status: 'confirmed' })
  const [saving, setSaving] = useState(false)

  const fetchRsvps = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/rsvps`)
    if (res.ok) {
      const data = await res.json()
      setRsvps(data.data)
      setSummary(data.summary)
    }
    setLoading(false)
  }, [eventId])

  useEffect(() => { fetchRsvps() }, [fetchRsvps])

  const addRsvp = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await fetch(`/api/events/${eventId}/rsvps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, guest_count: parseInt(form.guest_count) }),
    })
    setForm({ name: '', email: '', phone: '', guest_count: '1', notes: '', status: 'confirmed' })
    setShowForm(false)
    setSaving(false)
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

  const exportCsv = () => {
    window.location.href = `/api/events/${eventId}/rsvps/export`
  }

  const inputClass = 'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href={`/events/${eventId}`} className="text-sm text-gray-500 hover:text-gray-700 mb-2 block">
            ← Back to Event
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">RSVPs</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Export CSV
          </button>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            + Add RSVP
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Confirmed', value: summary.confirmed, color: 'text-green-700' },
          { label: 'Waitlist', value: summary.waitlist, color: 'text-yellow-700' },
          { label: 'Cancelled', value: summary.cancelled, color: 'text-red-700' },
          { label: 'Total Guests', value: summary.total_guests, color: 'text-indigo-700' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Add RSVP form */}
      {showForm && (
        <form onSubmit={addRsvp} className="bg-white border border-indigo-200 rounded-xl p-5 mb-6 space-y-3">
          <h3 className="font-medium text-gray-900">Add RSVP</h3>
          <div className="grid grid-cols-2 gap-3">
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
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add RSVP'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-center text-gray-400 py-8">Loading…</p>
      ) : rsvps.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No RSVPs yet. Add one above or import a CSV.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Guests</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rsvps.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
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
                  <td className="px-4 py-3 text-gray-400">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
