'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

interface Reminder {
  id: string
  title: string
  description: string | null
  due_date: string
  status: 'pending' | 'done' | 'snoozed'
  priority: 'high' | 'medium' | 'low'
  ai_generated: boolean
  assigned_to_name: string | null
  event_name: string | null
  event_id: string | null
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
}

function RemindersContent() {
  const searchParams = useSearchParams()
  const eventId = searchParams.get('event_id')

  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', due_date: '', priority: 'medium', event_id: eventId ?? '' })
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('pending')

  const fetchReminders = useCallback(async () => {
    const params = new URLSearchParams({ status: filter === 'all' ? '' : filter })
    if (eventId) params.set('event_id', eventId)
    const res = await fetch(`/api/reminders?${params}`)
    if (res.ok) {
      const { data } = await res.json()
      setReminders(data)
    }
    setLoading(false)
  }, [filter, eventId])

  useEffect(() => { fetchReminders() }, [fetchReminders])

  const markDone = async (id: string) => {
    await fetch(`/api/reminders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    })
    await fetchReminders()
  }

  const addReminder = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, event_id: form.event_id || null }),
    })
    setForm({ title: '', description: '', due_date: '', priority: 'medium', event_id: eventId ?? '' })
    setShowForm(false)
    setSaving(false)
    await fetchReminders()
  }

  const inputClass = 'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Reminders {eventId && <span className="text-gray-400 text-lg">· Event</span>}
        </h1>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          + Add Reminder
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {(['pending', 'all', 'done'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-sm rounded-md font-medium capitalize transition-colors ${filter === f ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {showForm && (
        <form onSubmit={addReminder} className="bg-white border border-indigo-200 rounded-xl p-5 mb-6 space-y-3">
          <h3 className="font-medium text-gray-900">Add Reminder</h3>
          <input required placeholder="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
          <textarea placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={inputClass} />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" required value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className={inputClass} />
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputClass}>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-8">Loading…</p>
      ) : reminders.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">🔔</p>
          <p className="text-gray-500">{filter === 'pending' ? 'All caught up! No pending reminders.' : 'No reminders found.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reminders.map((r) => (
            <div key={r.id} className={`bg-white border rounded-xl p-4 flex items-start gap-4 ${r.status === 'done' ? 'opacity-60' : 'border-gray-200'}`}>
              <button
                onClick={() => r.status !== 'done' && markDone(r.id)}
                className={`mt-0.5 h-5 w-5 rounded-full border-2 flex-shrink-0 transition-colors ${
                  r.status === 'done'
                    ? 'bg-green-500 border-green-500'
                    : 'border-gray-300 hover:border-indigo-500'
                }`}
              >
                {r.status === 'done' && <span className="text-white text-xs flex items-center justify-center">✓</span>}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-gray-900 ${r.status === 'done' ? 'line-through' : ''}`}>{r.title}</p>
                {r.description && <p className="text-sm text-gray-500 mt-0.5">{r.description}</p>}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[r.priority]}`}>{r.priority}</span>
                  {r.event_name && <span className="text-xs text-gray-400">📅 {r.event_name}</span>}
                  {r.assigned_to_name && <span className="text-xs text-gray-400">👤 {r.assigned_to_name}</span>}
                  {r.ai_generated && <span className="text-xs text-indigo-400">✨ AI</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-medium ${new Date(r.due_date) < new Date() && r.status !== 'done' ? 'text-red-500' : 'text-gray-500'}`}>
                  {new Date(r.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function RemindersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Loading…</div>}>
      <RemindersContent />
    </Suspense>
  )
}
