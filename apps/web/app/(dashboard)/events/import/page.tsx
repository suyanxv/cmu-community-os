'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, CheckCircle2, XCircle, CalendarClock } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface ParsedEvent {
  name: string
  event_date: string | null
  end_date: string | null
  start_time: string | null
  end_time: string | null
  timezone: string
  location_name: string | null
  location_address: string | null
  is_virtual: boolean
  event_mode: 'in_person' | 'virtual' | 'hybrid'
  description: string | null
  max_capacity: number | null
  tags: string[]
  is_past: boolean
  source_line: string | null
  // UI state
  selected: boolean
}

export default function ImportEventsPage() {
  const router = useRouter()
  const toast = useToast()
  const [input, setInput] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<ParsedEvent[]>([])

  const parseInput = async () => {
    setParsing(true)
    setError(null)
    setEvents([])
    const res = await fetch('/api/events/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    })
    setParsing(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Could not parse input')
      return
    }
    const { data } = await res.json()
    if (!Array.isArray(data) || data.length === 0) {
      setError('No events could be extracted from that input. Try adding more detail (dates, titles).')
      return
    }
    setEvents(data.map((e: Omit<ParsedEvent, 'selected'>) => ({ ...e, selected: true })))
  }

  const updateEvent = <K extends keyof ParsedEvent>(i: number, key: K, value: ParsedEvent[K]) =>
    setEvents((prev) => prev.map((e, idx) => (idx === i ? { ...e, [key]: value } : e)))

  const toggleSelected = (i: number) => updateEvent(i, 'selected', !events[i].selected)

  const selectAll = (v: boolean) => setEvents((prev) => prev.map((e) => ({ ...e, selected: v })))

  const saveAll = async () => {
    const toSave = events.filter((e) => e.selected && e.name && e.event_date)
    if (toSave.length === 0) {
      toast.error('Select at least one event with a name and date')
      return
    }
    setSaving(true)
    const res = await fetch('/api/events/import', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: toSave.map((e) => ({
          name: e.name,
          event_date: e.event_date,
          end_date: e.end_date,
          start_time: e.start_time,
          end_time: e.end_time,
          timezone: e.timezone,
          location_name: e.location_name,
          location_address: e.location_address,
          is_virtual: e.is_virtual,
          event_mode: e.event_mode,
          description: e.description,
          max_capacity: e.max_capacity,
          tags: e.tags,
          is_past: e.is_past,
        })),
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to save events')
      return
    }
    const { data } = await res.json()
    const skipped = data.skipped > 0 ? ` (${data.skipped} skipped — missing name or date)` : ''
    toast.success(`${data.imported} event${data.imported === 1 ? '' : 's'} imported${skipped}`)
    router.push('/events')
  }

  const selectedCount = events.filter((e) => e.selected).length
  const pastCount = events.filter((e) => e.is_past).length
  const upcomingCount = events.filter((e) => !e.is_past).length

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <Link href="/events" className="text-sm text-gray-500 hover:text-gray-700 mb-2 block">
        ← Back to Events
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Import Events</h1>
      <p className="text-sm text-gray-500 mb-6">
        Paste a CSV, a list, or free-text description of past or upcoming events. Claude will split them
        into separate events, pull out dates, locations, and descriptions. Missing fields stay blank for you to fill in later.
      </p>

      {events.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 space-y-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={10}
            placeholder={`Examples:

• CSV: "Name, Date, Location\\nAlumni Mixer, 2024-02-15, Amazon Doppler\\nSpeaker Series, 2024-03-10, Zoom"

• Free text: "We had a mixer on Feb 15 2024 at Amazon Doppler (60 people), a speaker series on Zoom March 10 2024, and an annual gala planned for December 2025"

• Bullet list: "- Jan 5 2025 — Alumni Coffee at Starbucks Pioneer Square\\n- Feb 20 2025 — Networking Mixer, Google Seattle"`}
            className="w-full px-4 py-3 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
          />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs text-gray-400">
              {input.length} characters · Parsing uses Claude Sonnet (5 parses/hour limit)
            </p>
            <button
              onClick={parseInput}
              disabled={parsing || !input.trim()}
              className="inline-flex items-center gap-2 bg-sage-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-sage-700 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" strokeWidth={1.75} />
              {parsing ? 'Parsing with AI…' : 'Parse Events'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="bg-sage-50 border border-sage-200 rounded-xl p-4 mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-lg font-bold text-sage-700">{events.length}</span>
                <span className="text-gray-600 ml-1">extracted</span>
              </div>
              {upcomingCount > 0 && (
                <div>
                  <span className="font-semibold text-gray-900">{upcomingCount}</span>
                  <span className="text-gray-600 ml-1">upcoming</span>
                </div>
              )}
              {pastCount > 0 && (
                <div>
                  <span className="font-semibold text-gray-900">{pastCount}</span>
                  <span className="text-gray-600 ml-1">past</span>
                </div>
              )}
              <div className="text-gray-400">·</div>
              <div>
                <span className="font-semibold text-sage-700">{selectedCount}</span>
                <span className="text-gray-600 ml-1">selected</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => selectAll(true)}  className="text-xs text-gray-600 hover:text-gray-900 underline">Select all</button>
              <button onClick={() => selectAll(false)} className="text-xs text-gray-600 hover:text-gray-900 underline">Deselect all</button>
              <button
                onClick={() => { setEvents([]); setInput('') }}
                className="text-xs text-gray-600 hover:text-gray-900 underline ml-2"
              >
                Start over
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {events.map((e, i) => (
              <div
                key={i}
                className={`bg-white border rounded-xl p-4 ${e.selected ? 'border-sage-300' : 'border-gray-200 opacity-60'}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={e.selected}
                    onChange={() => toggleSelected(i)}
                    className="mt-1.5 h-4 w-4 shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start gap-2 flex-wrap">
                      <input
                        type="text"
                        value={e.name}
                        onChange={(ev) => updateEvent(i, 'name', ev.target.value)}
                        disabled={!e.selected}
                        className="flex-1 min-w-0 font-medium text-gray-900 border-0 border-b border-transparent focus:border-sage-400 focus:outline-none bg-transparent"
                        placeholder="Event name"
                      />
                      {e.is_past ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-stone-200 text-stone-600 px-2 py-0.5 rounded-full">
                          <CalendarClock className="w-3 h-3" strokeWidth={1.75} /> Past
                        </span>
                      ) : e.event_date ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-sage-100 text-sage-700 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" strokeWidth={1.75} /> Upcoming
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-butter-100 text-butter-700 px-2 py-0.5 rounded-full">
                          <XCircle className="w-3 h-3" strokeWidth={1.75} /> No date
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <label className="flex flex-col">
                        <span className="text-gray-400 mb-0.5">Start date</span>
                        <input
                          type="date"
                          value={e.event_date ?? ''}
                          onChange={(ev) => updateEvent(i, 'event_date', ev.target.value || null)}
                          disabled={!e.selected}
                          className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sage-500"
                        />
                      </label>
                      <label className="flex flex-col">
                        <span className="text-gray-400 mb-0.5">Start time</span>
                        <input
                          type="time"
                          value={e.start_time ?? ''}
                          onChange={(ev) => updateEvent(i, 'start_time', ev.target.value || null)}
                          disabled={!e.selected}
                          className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sage-500"
                        />
                      </label>
                      <label className="flex flex-col">
                        <span className="text-gray-400 mb-0.5">Location</span>
                        <input
                          type="text"
                          value={e.location_name ?? ''}
                          onChange={(ev) => updateEvent(i, 'location_name', ev.target.value || null)}
                          disabled={!e.selected}
                          placeholder="Venue / city / Zoom"
                          className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sage-500"
                        />
                      </label>
                    </div>

                    {e.description && (
                      <p className="text-xs text-gray-500 line-clamp-2">{e.description}</p>
                    )}

                    {e.source_line && e.source_line !== e.name && (
                      <p className="text-[11px] text-gray-300 italic truncate">
                        From: &ldquo;{e.source_line}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 mt-6 pb-8">
            <button
              onClick={() => { setEvents([]); setInput('') }}
              disabled={saving}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50 disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={saveAll}
              disabled={saving || selectedCount === 0}
              className="px-6 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 disabled:opacity-50 font-medium"
            >
              {saving ? 'Saving…' : `Import ${selectedCount} Event${selectedCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
