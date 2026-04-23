'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Speaker = { name: string; title: string; bio: string }
type Sponsor = { name: string; tier: string }

interface EventFormData {
  name: string
  event_date: string
  start_time: string
  end_time: string
  timezone: string
  location_name: string
  location_address: string
  location_url: string
  is_virtual: boolean
  description: string
  speakers: Speaker[]
  agenda: string
  sponsors: Sponsor[]
  tone: string
  target_audience: string
  channels: string[]
  rsvp_link: string
  rsvp_deadline: string
  max_capacity: string
  tags: string
  notes: string
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

const defaultValues: EventFormData = {
  name: '',
  event_date: '',
  start_time: '',
  end_time: '',
  timezone: 'America/Los_Angeles',
  location_name: '',
  location_address: '',
  location_url: '',
  is_virtual: false,
  description: '',
  speakers: [],
  agenda: '',
  sponsors: [],
  tone: 'professional-warm',
  target_audience: '',
  channels: ['whatsapp', 'email'],
  rsvp_link: '',
  rsvp_deadline: '',
  max_capacity: '',
  tags: '',
  notes: '',
}

interface EventFormProps {
  initialValues?: Partial<EventFormData>
  eventId?: string
}

export default function EventForm({ initialValues, eventId }: EventFormProps) {
  const router = useRouter()
  const [form, setForm] = useState<EventFormData>({ ...defaultValues, ...initialValues })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof EventFormData, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }))

  const toggleChannel = (ch: string) => {
    set('channels', form.channels.includes(ch)
      ? form.channels.filter((c) => c !== ch)
      : [...form.channels, ch])
  }

  const addSpeaker = () => set('speakers', [...form.speakers, { name: '', title: '', bio: '' }])
  const updateSpeaker = (i: number, field: keyof Speaker, value: string) => {
    const updated = [...form.speakers]
    updated[i] = { ...updated[i], [field]: value }
    set('speakers', updated)
  }
  const removeSpeaker = (i: number) => set('speakers', form.speakers.filter((_, idx) => idx !== i))

  const addSponsor = () => set('sponsors', [...form.sponsors, { name: '', tier: '' }])
  const updateSponsor = (i: number, field: keyof Sponsor, value: string) => {
    const updated = [...form.sponsors]
    updated[i] = { ...updated[i], [field]: value }
    set('sponsors', updated)
  }
  const removeSponsor = (i: number) => set('sponsors', form.sponsors.filter((_, idx) => idx !== i))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      ...form,
      max_capacity: form.max_capacity ? parseInt(form.max_capacity) : null,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    }

    const res = await fetch(eventId ? `/api/events/${eventId}` : '/api/events', {
      method: eventId ? 'PATCH' : 'POST',
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
    router.push(`/events/${eventId ?? data.id}`)
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'
  const sectionClass = 'bg-white rounded-xl border border-gray-200 p-6 space-y-4'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className={sectionClass}>
        <h2 className="text-base font-semibold text-gray-900">Event Details</h2>
        <div>
          <label className={labelClass}>Event Name *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="CMU Seattle Alumni Mixer"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Date *</label>
            <input type="date" required value={form.event_date} onChange={(e) => set('event_date', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Timezone</label>
            <select value={form.timezone} onChange={(e) => set('timezone', e.target.value)} className={inputClass}>
              {TIMEZONE_OPTIONS.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Start Time *</label>
            <input type="time" required value={form.start_time} onChange={(e) => set('start_time', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>End Time</label>
            <input type="time" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Location */}
      <div className={sectionClass}>
        <h2 className="text-base font-semibold text-gray-900">Location</h2>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_virtual"
            checked={form.is_virtual}
            onChange={(e) => set('is_virtual', e.target.checked)}
            className="h-4 w-4 text-indigo-600 rounded"
          />
          <label htmlFor="is_virtual" className="text-sm text-gray-700">Virtual event</label>
        </div>
        {!form.is_virtual && (
          <>
            <div>
              <label className={labelClass}>Venue Name</label>
              <input type="text" value={form.location_name} onChange={(e) => set('location_name', e.target.value)} placeholder="Amazon Doppler Building" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Address</label>
              <input type="text" value={form.location_address} onChange={(e) => set('location_address', e.target.value)} placeholder="2031 7th Ave, Seattle, WA 98121" className={inputClass} />
            </div>
          </>
        )}
        <div>
          <label className={labelClass}>{form.is_virtual ? 'Meeting Link' : 'Google Maps / Venue URL'}</label>
          <input type="url" value={form.location_url} onChange={(e) => set('location_url', e.target.value)} placeholder="https://" className={inputClass} />
        </div>
      </div>

      {/* Content */}
      <div className={sectionClass}>
        <h2 className="text-base font-semibold text-gray-900">Event Content</h2>
        <div>
          <label className={labelClass}>Description</label>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={4}
            placeholder="What's this event about? Who should attend? What will they experience?"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Agenda</label>
          <textarea
            value={form.agenda}
            onChange={(e) => set('agenda', e.target.value)}
            rows={3}
            placeholder="6:00 PM – Doors open&#10;6:30 PM – Keynote&#10;7:30 PM – Networking"
            className={inputClass}
          />
        </div>
      </div>

      {/* Speakers */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Speakers / Guests</h2>
          <button type="button" onClick={addSpeaker} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            + Add Speaker
          </button>
        </div>
        {form.speakers.map((s, i) => (
          <div key={i} className="border border-gray-100 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Speaker {i + 1}</span>
              <button type="button" onClick={() => removeSpeaker(i)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="Full Name *" value={s.name} onChange={(e) => updateSpeaker(i, 'name', e.target.value)} className={inputClass} />
              <input type="text" placeholder="Title / Role" value={s.title} onChange={(e) => updateSpeaker(i, 'title', e.target.value)} className={inputClass} />
            </div>
            <textarea placeholder="Brief bio (optional)" value={s.bio} onChange={(e) => updateSpeaker(i, 'bio', e.target.value)} rows={2} className={inputClass} />
          </div>
        ))}
      </div>

      {/* Sponsors */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Sponsors</h2>
          <button type="button" onClick={addSponsor} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            + Add Sponsor
          </button>
        </div>
        {form.sponsors.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <input type="text" placeholder="Company Name" value={s.name} onChange={(e) => updateSponsor(i, 'name', e.target.value)} className={inputClass} />
            <input type="text" placeholder="Tier (Gold, Silver…)" value={s.tier} onChange={(e) => updateSponsor(i, 'tier', e.target.value)} className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button type="button" onClick={() => removeSponsor(i)} className="text-red-500 hover:text-red-700 text-sm">✕</button>
          </div>
        ))}
      </div>

      {/* AI Generation Settings */}
      <div className={sectionClass}>
        <h2 className="text-base font-semibold text-gray-900">Content Generation Settings</h2>
        <div>
          <label className={labelClass}>Tone</label>
          <div className="flex gap-3">
            {TONE_OPTIONS.map((t) => (
              <label key={t.id} className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border text-sm ${form.tone === t.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                <input type="radio" name="tone" value={t.id} checked={form.tone === t.id} onChange={() => set('tone', t.id)} className="sr-only" />
                {t.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass}>Target Audience</label>
          <input type="text" value={form.target_audience} onChange={(e) => set('target_audience', e.target.value)} placeholder="CMU alumni, 25-40, tech professionals in Seattle" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Generate content for</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {CHANNEL_OPTIONS.map((ch) => (
              <label key={ch.id} className={`cursor-pointer px-3 py-1.5 rounded-full border text-sm font-medium ${form.channels.includes(ch.id) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                <input type="checkbox" checked={form.channels.includes(ch.id)} onChange={() => toggleChannel(ch.id)} className="sr-only" />
                {ch.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* RSVP */}
      <div className={sectionClass}>
        <h2 className="text-base font-semibold text-gray-900">RSVP</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>RSVP Link</label>
            <input type="url" value={form.rsvp_link} onChange={(e) => set('rsvp_link', e.target.value)} placeholder="https://lu.ma/your-event" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>RSVP Deadline</label>
            <input type="date" value={form.rsvp_deadline} onChange={(e) => set('rsvp_deadline', e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Max Capacity</label>
          <input type="number" value={form.max_capacity} onChange={(e) => set('max_capacity', e.target.value)} placeholder="100" className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      {/* Notes */}
      <div className={sectionClass}>
        <h2 className="text-base font-semibold text-gray-900">Internal Notes</h2>
        <div>
          <label className={labelClass}>Tags (comma-separated)</label>
          <input type="text" value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="networking, mixer, annual" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Notes (internal only, not used in AI generation)</label>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} placeholder="Parking info, vendor contacts, to-dos…" className={inputClass} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pb-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : eventId ? 'Save Changes' : 'Create Event'}
        </button>
      </div>
    </form>
  )
}
