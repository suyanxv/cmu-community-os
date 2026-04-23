'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useToast } from '@/components/ui/Toast'
import { CardListSkeleton } from '@/components/ui/Skeleton'
import { CalendarDays, User, Sparkles, Check } from 'lucide-react'

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
  const toast = useToast()

  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', due_date: '', priority: 'medium', event_id: eventId ?? '' })
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('pending')
  const [query, setQuery] = useState('')

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

  const markDone = async (id: string, title: string) => {
    await fetch(`/api/reminders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    })
    toast.success(`"${title}" marked done`)
    await fetchReminders()
  }

  const addReminder = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, event_id: form.event_id || null }),
    })
    if (res.ok) {
      toast.success('Reminder added')
      setForm({ title: '', description: '', due_date: '', priority: 'medium', event_id: eventId ?? '' })
      setShowForm(false)
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to add reminder')
    }
    setSaving(false)
    await fetchReminders()
  }

  const inputClass = 'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-sage-500'

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Reminders {eventId && <span className="text-gray-400 text-lg">· Event</span>}
        </h1>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700">
          + Add Reminder
        </button>
      </div>

      {/* Search + filter tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reminders by title, description, event…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
          />
        </div>
        <div className="flex gap-1 bg-stone-100 p-1 rounded-lg w-fit">
          {(['pending', 'all', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${filter === f ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {showForm && (
        <form onSubmit={addReminder} className="bg-white border border-sage-200 rounded-xl p-5 mb-6 space-y-3">
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
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50">Cancel</button>
          </div>
        </form>
      )}

      <ReminderList
        reminders={reminders}
        loading={loading}
        query={query}
        filter={filter}
        markDone={markDone}
      />
    </div>
  )
}

function ReminderList({
  reminders, loading, query, filter, markDone,
}: {
  reminders: Reminder[]
  loading: boolean
  query: string
  filter: 'all' | 'pending' | 'done'
  markDone: (id: string, title: string) => void
}) {
  if (loading) return <CardListSkeleton count={4} />
  if (reminders.length === 0) return (
    <div className="text-center py-20">
      <p className="text-4xl mb-4">🔔</p>
      <p className="text-gray-500">{filter === 'pending' ? 'All caught up! No pending reminders.' : 'No reminders found.'}</p>
    </div>
  )

  const q = query.trim().toLowerCase()
  const filtered = q
    ? reminders.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        (r.description?.toLowerCase().includes(q) ?? false) ||
        (r.event_name?.toLowerCase().includes(q) ?? false) ||
        (r.assigned_to_name?.toLowerCase().includes(q) ?? false)
      )
    : reminders

  if (filtered.length === 0) return (
    <div className="text-center py-12">
      <p className="text-3xl mb-2">🔎</p>
      <p className="text-gray-500 text-sm">No reminders match &ldquo;{query}&rdquo;</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {filtered.map((r) => (
        <div key={r.id} className={`bg-white border rounded-xl p-4 flex items-start gap-4 ${r.status === 'done' ? 'opacity-60' : 'border-gray-200'}`}>
          <button
            onClick={() => r.status !== 'done' && markDone(r.id, r.title)}
            className={`mt-0.5 h-5 w-5 rounded-full border-2 flex-shrink-0 transition-colors ${
              r.status === 'done'
                ? 'bg-green-500 border-green-500'
                : 'border-gray-300 hover:border-sage-500'
            }`}
          >
            {r.status === 'done' && <Check className="w-3 h-3 text-white m-auto" strokeWidth={3} />}
          </button>
          <div className="flex-1 min-w-0">
            <p className={`font-medium text-gray-900 ${r.status === 'done' ? 'line-through' : ''}`}>{r.title}</p>
            {r.description && <p className="text-sm text-gray-500 mt-0.5">{r.description}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[r.priority]}`}>{r.priority}</span>
              {r.event_name && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <CalendarDays className="w-3 h-3" strokeWidth={1.75} /> {r.event_name}
                </span>
              )}
              {r.assigned_to_name && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <User className="w-3 h-3" strokeWidth={1.75} /> {r.assigned_to_name}
                </span>
              )}
              {r.ai_generated && (
                <span className="inline-flex items-center gap-1 text-xs text-sage-600">
                  <Sparkles className="w-3 h-3" strokeWidth={1.75} /> AI
                </span>
              )}
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
  )
}

export default function RemindersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Loading…</div>}>
      <RemindersContent />
    </Suspense>
  )
}
