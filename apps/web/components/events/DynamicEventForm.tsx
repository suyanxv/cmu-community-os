'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TemplateField } from '@/lib/ai'

interface DynamicEventFormProps {
  schema: TemplateField[]
}

type CoreValues = {
  name: string
  event_date: string
  end_date: string
  start_time: string
  end_time: string
  timezone: string
  event_mode: 'in_person' | 'virtual' | 'hybrid'
  tone: string
  channels: string[]
  rsvp_link: string
}

const CHANNEL_OPTIONS = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'email', label: 'Email' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'luma', label: 'Luma' },
]

const TONE_OPTIONS = [
  { id: 'professional-warm', label: 'Professional & Warm' },
  { id: 'casual', label: 'Casual' },
  { id: 'formal', label: 'Formal' },
]

const TIMEZONE_OPTIONS = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Anchorage',
  'Pacific/Honolulu',
]

export default function DynamicEventForm({ schema }: DynamicEventFormProps) {
  const router = useRouter()
  const [core, setCore] = useState<CoreValues>({
    name: '',
    event_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    timezone: 'America/Los_Angeles',
    event_mode: 'in_person',
    tone: 'professional-warm',
    channels: ['whatsapp', 'email'],
    rsvp_link: '',
  })
  const [custom, setCustom] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'
  const sectionClass = 'bg-white rounded-xl border border-gray-200 p-4 sm:p-6 space-y-4'

  const setCoreField = <K extends keyof CoreValues>(key: K, value: CoreValues[K]) =>
    setCore((c) => ({ ...c, [key]: value }))

  const setCustomField = (key: string, value: unknown) =>
    setCustom((c) => ({ ...c, [key]: value }))

  const toggleChannel = (ch: string) =>
    setCoreField('channels', core.channels.includes(ch)
      ? core.channels.filter((c) => c !== ch)
      : [...core.channels, ch])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      ...core,
      // Map description from custom if present
      description: (custom['description'] as string) ?? '',
      custom_fields: custom,
    }

    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to save event')
      setSaving(false)
      return
    }

    const data = await res.json()
    router.push(`/events/${data.data.id}`)
  }

  const renderField = (field: TemplateField) => {
    const value = (custom[field.id] ?? '') as string

    if (field.type === 'textarea') {
      return (
        <textarea
          required={field.required}
          value={value}
          onChange={(e) => setCustomField(field.id, e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={inputClass}
        />
      )
    }

    if (field.type === 'select') {
      return (
        <select
          required={field.required}
          value={value}
          onChange={(e) => setCustomField(field.id, e.target.value)}
          className={inputClass}
        >
          <option value="">Select…</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    }

    return (
      <input
        type={field.type}
        required={field.required}
        value={value}
        onChange={(e) => setCustomField(field.id, e.target.value)}
        placeholder={field.placeholder}
        className={inputClass}
      />
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Core fields — always required for AI generation to work */}
      <div className={sectionClass}>
        <h2 className="text-base font-semibold text-gray-900">Event Details</h2>
        <div>
          <label className={labelClass}>Event Name *</label>
          <input type="text" required value={core.name} onChange={(e) => setCoreField('name', e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Start Date *</label>
            <input type="date" required value={core.event_date} onChange={(e) => setCoreField('event_date', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>End Date</label>
            <input type="date" value={core.end_date} onChange={(e) => setCoreField('end_date', e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Start Time</label>
            <input type="time" value={core.start_time} onChange={(e) => setCoreField('start_time', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>End Time</label>
            <input type="time" value={core.end_time} onChange={(e) => setCoreField('end_time', e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Timezone</label>
          <select value={core.timezone} onChange={(e) => setCoreField('timezone', e.target.value)} className={inputClass}>
            {TIMEZONE_OPTIONS.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Event Mode</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'in_person' as const, label: 'In-Person' },
              { id: 'virtual' as const, label: 'Virtual' },
              { id: 'hybrid' as const, label: 'Hybrid' },
            ].map((m) => (
              <label key={m.id} className={`cursor-pointer px-3 py-1.5 rounded-full border text-sm font-medium ${core.event_mode === m.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'}`}>
                <input type="radio" checked={core.event_mode === m.id} onChange={() => setCoreField('event_mode', m.id)} className="sr-only" />
                {m.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Custom fields from template */}
      {schema.length > 0 && (
        <div className={sectionClass}>
          <h2 className="text-base font-semibold text-gray-900">Event Information</h2>
          {schema.map((field) => (
            <div key={field.id}>
              <label className={labelClass}>
                {field.label}{field.required ? ' *' : ''}
              </label>
              {renderField(field)}
              {field.help && <p className="text-xs text-gray-400 mt-1">{field.help}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Generation settings */}
      <div className={sectionClass}>
        <h2 className="text-base font-semibold text-gray-900">Content Generation Settings</h2>
        <div>
          <label className={labelClass}>Tone</label>
          <div className="flex flex-wrap gap-2">
            {TONE_OPTIONS.map((t) => (
              <label key={t.id} className={`cursor-pointer px-3 py-1.5 rounded-full border text-sm font-medium ${core.tone === t.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'}`}>
                <input type="radio" checked={core.tone === t.id} onChange={() => setCoreField('tone', t.id)} className="sr-only" />
                {t.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass}>Channels</label>
          <div className="flex flex-wrap gap-2">
            {CHANNEL_OPTIONS.map((ch) => (
              <label key={ch.id} className={`cursor-pointer px-3 py-1.5 rounded-full border text-sm font-medium ${core.channels.includes(ch.id) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'}`}>
                <input type="checkbox" checked={core.channels.includes(ch.id)} onChange={() => toggleChannel(ch.id)} className="sr-only" />
                {ch.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass}>RSVP Link</label>
          <input type="url" value={core.rsvp_link} onChange={(e) => setCoreField('rsvp_link', e.target.value)} placeholder="https://lu.ma/your-event" className={inputClass} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pb-8">
        <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Create Event'}
        </button>
      </div>
    </form>
  )
}
