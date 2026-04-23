'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, X } from 'lucide-react'

interface Suggestion {
  title: string
  description: string
  due_date: string
  priority: 'high' | 'medium' | 'low'
  selected: boolean
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-butter-100 text-butter-700',
  low: 'bg-sage-100 text-sage-700',
}

export default function GenerateRemindersButton({ eventId }: { eventId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])

  const generate = async () => {
    setOpen(true)
    setLoading(true)
    setError(null)
    setSuggestions([])

    const res = await fetch(`/api/events/${eventId}/reminders/generate`, { method: 'POST' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to generate reminders')
      setLoading(false)
      return
    }
    const { data } = await res.json()
    if (!data || data.length === 0) {
      setError('No reminders could be generated. Try adding more event details.')
    } else {
      setSuggestions(
        data.map((s: Omit<Suggestion, 'selected'>) => ({ ...s, selected: true }))
      )
    }
    setLoading(false)
  }

  const toggle = (i: number) =>
    setSuggestions((prev) => prev.map((s, idx) => idx === i ? { ...s, selected: !s.selected } : s))

  const update = <K extends keyof Suggestion>(i: number, key: K, value: Suggestion[K]) =>
    setSuggestions((prev) => prev.map((s, idx) => idx === i ? { ...s, [key]: value } : s))

  const saveSelected = async () => {
    const selected = suggestions.filter((s) => s.selected)
    if (selected.length === 0) return
    setSaving(true)

    for (const s of selected) {
      await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          title: s.title,
          description: s.description,
          due_date: s.due_date,
          priority: s.priority,
          ai_generated: true,
        }),
      })
    }

    setSaving(false)
    setOpen(false)
    setSuggestions([])
    router.push(`/reminders?event_id=${eventId}`)
    router.refresh()
  }

  const close = () => {
    if (saving) return
    setOpen(false)
    setSuggestions([])
    setError(null)
  }

  const selectedCount = suggestions.filter((s) => s.selected).length

  return (
    <>
      <button
        onClick={generate}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-sage-300 text-sage-700 bg-sage-50 rounded-lg hover:bg-sage-100"
      >
        <Sparkles className="w-4 h-4" strokeWidth={1.75} /> Suggest Reminders
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">AI-Suggested Reminders</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Review, edit, and pick which reminders to save to your event.
                </p>
              </div>
              <button onClick={close} disabled={saving} className="p-1.5 rounded-lg hover:bg-stone-100 disabled:opacity-50" aria-label="Close">
                <X className="w-5 h-5 text-gray-500" strokeWidth={1.75} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {loading && (
                <div className="text-center py-12">
                  <Sparkles className="w-8 h-8 text-sage-400 mx-auto mb-3 animate-pulse" strokeWidth={1.5} />
                  <p className="text-sm text-gray-500">Claude is drafting a reminder schedule…</p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {!loading && suggestions.map((s, i) => (
                <div
                  key={i}
                  className={`border rounded-xl p-4 transition-colors ${s.selected ? 'border-sage-300 bg-sage-50/50' : 'border-gray-200 opacity-60'}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={s.selected}
                      onChange={() => toggle(i)}
                      className="mt-1 h-4 w-4"
                    />
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={s.title}
                        onChange={(e) => update(i, 'title', e.target.value)}
                        disabled={!s.selected}
                        className="w-full font-medium text-gray-900 bg-transparent border-0 border-b border-transparent focus:border-sage-400 focus:outline-none disabled:opacity-50"
                      />
                      <textarea
                        value={s.description}
                        onChange={(e) => update(i, 'description', e.target.value)}
                        disabled={!s.selected}
                        rows={2}
                        className="w-full text-sm text-gray-600 bg-transparent border-0 focus:outline-none resize-none disabled:opacity-50"
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="date"
                          value={s.due_date.slice(0, 10)}
                          onChange={(e) => update(i, 'due_date', e.target.value)}
                          disabled={!s.selected}
                          className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sage-500 disabled:opacity-50"
                        />
                        <select
                          value={s.priority}
                          onChange={(e) => update(i, 'priority', e.target.value as Suggestion['priority'])}
                          disabled={!s.selected}
                          className={`text-xs px-2 py-1 rounded-full border-0 font-medium ${PRIORITY_COLORS[s.priority]} disabled:opacity-50`}
                        >
                          <option value="high">high</option>
                          <option value="medium">medium</option>
                          <option value="low">low</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between shrink-0 bg-stone-50">
              <p className="text-sm text-gray-500">
                {suggestions.length > 0 && `${selectedCount} of ${suggestions.length} selected`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={close}
                  disabled={saving}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSelected}
                  disabled={saving || selectedCount === 0 || loading}
                  className="px-4 py-2 text-sm text-white bg-sage-600 rounded-lg hover:bg-sage-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : `Add ${selectedCount} Reminder${selectedCount === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
