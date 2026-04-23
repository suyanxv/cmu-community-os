'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import type { TemplateField } from '@/lib/ai'
import CheckInFieldsEditor from '@/components/events/CheckInFieldsEditor'
import HostsSelector from '@/components/events/HostsSelector'
import PartnerCombobox from '@/components/events/PartnerCombobox'

type Speaker = { name: string; title: string; bio: string }
type Sponsor = { name: string; tier: string }

interface EventFormData {
  name: string
  cover_emoji: string
  event_date: string
  end_date: string
  start_time: string
  end_time: string
  timezone: string
  location_name: string
  location_address: string
  location_url: string
  is_virtual: boolean
  event_mode: 'in_person' | 'virtual' | 'hybrid'
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
  checkin_whatsapp_url: string
  checkin_welcome_message: string
  checkin_fields: TemplateField[]
  host_user_ids: string[]
  category: 'internal' | 'partnered' | 'external'
  co_hosts: string[]
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
  cover_emoji: '',
  event_date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  timezone: 'America/Los_Angeles',
  location_name: '',
  location_address: '',
  location_url: '',
  is_virtual: false,
  event_mode: 'in_person',
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
  checkin_whatsapp_url: '',
  checkin_welcome_message: '',
  checkin_fields: [
    { id: 'graduation_year', label: 'Graduation Year',            type: 'text', required: false, placeholder: '2020' },
    { id: 'school',          label: 'School / Program',           type: 'text', required: false, placeholder: 'Tepper, SCS, Heinz, …' },
    { id: 'how_heard',       label: 'How did you hear about us?', type: 'text', required: false, placeholder: 'WhatsApp, friend, email…' },
  ],
  host_user_ids: [],
  category: 'internal',
  co_hosts: [],
}

interface EventFormProps {
  initialValues?: Partial<EventFormData>
  eventId?: string
  /** Template schema for org-level custom fields. If provided, a "Custom Fields" section is rendered. */
  customFields?: TemplateField[]
  /** Pre-filled values for custom fields (used on edit). */
  initialCustomValues?: Record<string, unknown>
}

export default function EventForm({ initialValues, eventId, customFields, initialCustomValues }: EventFormProps) {
  const router = useRouter()
  const toast = useToast()
  const [form, setForm] = useState<EventFormData>({ ...defaultValues, ...initialValues })
  const [customValues, setCustomValues] = useState<Record<string, unknown>>(initialCustomValues ?? {})
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setCustomValue = (id: string, value: unknown) =>
    setCustomValues((prev) => ({ ...prev, [id]: value }))

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
      co_hosts: form.co_hosts,
      custom_fields: customFields && customFields.length > 0 ? customValues : {},
      checkin_config: {
        ...(form.checkin_whatsapp_url    ? { whatsapp_url:    form.checkin_whatsapp_url }    : {}),
        ...(form.checkin_welcome_message ? { welcome_message: form.checkin_welcome_message } : {}),
        fields: form.checkin_fields,
      },
    }

    const res = await fetch(eventId ? `/api/events/${eventId}` : '/api/events', {
      method: eventId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json()
      if (Array.isArray(data.fields) && data.fields.length > 0) {
        const list = data.fields.map((f: { label: string; message: string }) => `• ${f.label}: ${f.message}`).join('\n')
        setError(`Please fix the following:\n${list}`)
      } else {
        setError(data.error ?? 'Failed to save event')
      }
      setSaving(false)
      return
    }

    const data = await res.json()
    const savedId = eventId ?? data.data.id

    // Auto-generate content for the selected channels (fire and forget on edit,
    // awaited on create so the user lands on the content page with it ready)
    if (!eventId && form.channels.length > 0) {
      setGenerating(true)
      try {
        await fetch(`/api/events/${savedId}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channels: form.channels }),
        })
        toast.success('Event created and content generated')
      } catch {
        toast.error('Event created, but content generation failed. Try again from the Content page.')
      }
      router.push(`/events/${savedId}/content`)
      return
    }

    toast.success(eventId ? 'Event updated' : 'Event created')
    router.push(`/events/${savedId}`)
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'
  const sectionClass = 'bg-white rounded-xl border border-gray-200 p-4 sm:p-6 space-y-4'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm whitespace-pre-line">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className={sectionClass}>
        <h2 className="text-base font-semibold text-gray-900">Event Details</h2>
        <div className="flex items-end gap-3">
          <div className="shrink-0">
            <label className={labelClass}>Cover</label>
            <EmojiPicker value={form.cover_emoji} onChange={(v) => set('cover_emoji', v)} />
          </div>
          <div className="flex-1">
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
        </div>
        <div>
          <label className={labelClass}>Category</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'internal' as const,  label: 'Internal',   hint: 'Org is running it' },
              { id: 'partnered' as const, label: 'Partnered',  hint: 'Co-hosted with another org' },
              { id: 'external' as const,  label: 'External',   hint: "Attending a 3rd-party event" },
            ].map((c) => (
              <label key={c.id} className={`cursor-pointer px-3 py-1.5 rounded-full border text-sm font-medium ${form.category === c.id ? 'border-sage-500 bg-sage-50 text-sage-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`} title={c.hint}>
                <input type="radio" name="category" value={c.id} checked={form.category === c.id} onChange={() => set('category', c.id)} className="sr-only" />
                {c.label}
              </label>
            ))}
          </div>
        </div>
        {(form.category === 'partnered' || form.co_hosts.length > 0) && (
          <div>
            <label className={labelClass}>Co-hosted with</label>
            <PartnerCombobox
              value={form.co_hosts}
              onChange={(next) => set('co_hosts', next)}
              placeholder="Stanford Alumni, MITCNC, UPenn Alumni…"
            />
            <p className="text-xs text-gray-400 mt-1">
              Pick from existing partners or type a new name to create one. New entries are saved to your Partners CRM as co-host type.
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Start Date *</label>
            <input type="date" required value={form.event_date} onChange={(e) => set('event_date', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>End Date</label>
            <input type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} className={inputClass} />
            <p className="text-xs text-gray-400 mt-1">Leave blank for single-day events</p>
          </div>
        </div>
        <div>
          <label className={labelClass}>Timezone</label>
          <select value={form.timezone} onChange={(e) => set('timezone', e.target.value)} className={inputClass}>
            {TIMEZONE_OPTIONS.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <div>
          <label className={labelClass}>Event Mode</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'in_person' as const, label: 'In-Person' },
              { id: 'virtual' as const, label: 'Virtual' },
              { id: 'hybrid' as const, label: 'Hybrid' },
            ].map((m) => (
              <label key={m.id} className={`cursor-pointer px-3 py-1.5 rounded-full border text-sm font-medium ${form.event_mode === m.id ? 'border-sage-500 bg-sage-50 text-sage-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                <input type="radio" name="event_mode" value={m.id} checked={form.event_mode === m.id} onChange={() => { set('event_mode', m.id); set('is_virtual', m.id === 'virtual') }} className="sr-only" />
                {m.label}
              </label>
            ))}
          </div>
        </div>
        {form.event_mode !== 'virtual' && (
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
          <label className={labelClass}>
            {form.event_mode === 'virtual' ? 'Meeting Link' : form.event_mode === 'hybrid' ? 'Virtual Attendance Link' : 'Google Maps / Venue URL'}
          </label>
          <input type="url" value={form.location_url} onChange={(e) => set('location_url', e.target.value)} placeholder="https://" className={inputClass} />
        </div>
      </div>

      {/* Hosts */}
      <div className={sectionClass}>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Hosts</h2>
          <p className="text-xs text-gray-500 mt-1">
            Team members running or representing this event (shown as &ldquo;hosted by&rdquo;). Select any number.
          </p>
        </div>
        <HostsSelector
          selectedIds={form.host_user_ids}
          onChange={(ids) => set('host_user_ids', ids)}
          defaultToCurrentUser={!eventId}
        />
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

      {/* Custom fields (from org template) */}
      {customFields && customFields.length > 0 && (
        <div className={sectionClass}>
          <h2 className="text-base font-semibold text-gray-900">Custom Fields</h2>
          <p className="text-xs text-gray-500 -mt-2">
            Fields from your organization&apos;s event template. Edit the template in Settings.
          </p>
          {customFields.map((field) => (
            <CustomFieldRow
              key={field.id}
              field={field}
              value={(customValues[field.id] ?? '') as string}
              onChange={(v) => setCustomValue(field.id, v)}
              inputClass={inputClass}
              labelClass={labelClass}
            />
          ))}
        </div>
      )}

      {/* Speakers */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Speakers / Guests</h2>
          <button type="button" onClick={addSpeaker} className="text-sm text-sage-600 hover:text-sage-700 font-medium">
            + Add Speaker
          </button>
        </div>
        {form.speakers.map((s, i) => (
          <div key={i} className="border border-gray-100 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Speaker {i + 1}</span>
              <button type="button" onClick={() => removeSpeaker(i)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <button type="button" onClick={addSponsor} className="text-sm text-sage-600 hover:text-sage-700 font-medium">
            + Add Sponsor
          </button>
        </div>
        {form.sponsors.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <input type="text" placeholder="Company Name" value={s.name} onChange={(e) => updateSponsor(i, 'name', e.target.value)} className={inputClass} />
            <input type="text" placeholder="Tier (Gold, Silver…)" value={s.tier} onChange={(e) => updateSponsor(i, 'tier', e.target.value)} className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500" />
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
              <label key={t.id} className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border text-sm ${form.tone === t.id ? 'border-sage-500 bg-sage-50 text-sage-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
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
              <label key={ch.id} className={`cursor-pointer px-3 py-1.5 rounded-full border text-sm font-medium ${form.channels.includes(ch.id) ? 'border-sage-500 bg-sage-50 text-sage-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <input type="number" value={form.max_capacity} onChange={(e) => set('max_capacity', e.target.value)} placeholder="100" className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500" />
        </div>
      </div>

      {/* Check-in */}
      <div className={sectionClass}>
        <h2 className="text-base font-semibold text-gray-900">Day-of Check-in</h2>
        <p className="text-xs text-gray-500 -mt-2">
          Attendees scan a QR code at the event to check themselves in. The QR is generated automatically — configure what they see below.
        </p>
        <div>
          <label className={labelClass}>WhatsApp Community Link (optional)</label>
          <input
            type="url"
            value={form.checkin_whatsapp_url}
            onChange={(e) => set('checkin_whatsapp_url', e.target.value)}
            placeholder="https://chat.whatsapp.com/…"
            className={inputClass}
          />
          <p className="text-xs text-gray-400 mt-1">Shown on the thank-you screen after check-in.</p>
        </div>
        <div>
          <label className={labelClass}>Welcome Message (optional)</label>
          <textarea
            value={form.checkin_welcome_message}
            onChange={(e) => set('checkin_welcome_message', e.target.value)}
            rows={2}
            placeholder="Welcome! Fill this out to get your wristband."
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Check-in Form Fields</label>
          <CheckInFieldsEditor
            fields={form.checkin_fields}
            onChange={(v) => set('checkin_fields', v)}
          />
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
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-stone-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || generating}
          className="px-6 py-2 text-sm font-medium text-white bg-sage-600 rounded-lg hover:bg-sage-700 disabled:opacity-50"
        >
          {generating
            ? 'Generating content…'
            : saving
              ? 'Saving…'
              : eventId
                ? 'Save Changes'
                : 'Create & Generate Content'}
        </button>
      </div>
    </form>
  )
}

const EMOJI_SUGGESTIONS = [
  '📅', '🎉', '🍷', '🍻', '☕', '🥂',
  '🎤', '🎓', '🏛️', '🏢', '🏖️', '🌆',
  '🤝', '🙌', '💼', '📢', '✨', '🎂',
  '🏆', '🏃', '🎭', '🎨', '📸', '💡',
]

function EmojiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-[42px] w-[42px] border border-gray-300 rounded-lg text-2xl flex items-center justify-center bg-white hover:border-sage-400"
        title="Pick an emoji cover"
      >
        {value || <span className="text-gray-300 text-lg">+</span>}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2 w-56">
          <div className="grid grid-cols-6 gap-1 mb-2">
            {EMOJI_SUGGESTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => { onChange(emoji); setOpen(false) }}
                className={`h-8 w-8 rounded text-xl flex items-center justify-center hover:bg-stone-100 ${value === emoji ? 'bg-sage-100' : ''}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-gray-100 pt-2">
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value.slice(0, 4))}
              placeholder="Custom"
              className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sage-500"
            />
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="text-xs text-gray-500 hover:text-red-600"
            >
              clear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface CustomFieldRowProps {
  field: TemplateField
  value: string
  onChange: (v: string) => void
  inputClass: string
  labelClass: string
}

function CustomFieldRow({ field, value, onChange, inputClass, labelClass }: CustomFieldRowProps) {
  let input: React.ReactNode
  if (field.type === 'textarea') {
    input = (
      <textarea
        required={field.required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={3}
        className={inputClass}
      />
    )
  } else if (field.type === 'select') {
    input = (
      <select
        required={field.required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      >
        <option value="">Select…</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    )
  } else {
    input = (
      <input
        type={field.type}
        required={field.required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={inputClass}
      />
    )
  }
  return (
    <div>
      <label className={labelClass}>
        {field.label}{field.required ? ' *' : ''}
      </label>
      {input}
      {field.help && <p className="text-xs text-gray-400 mt-1">{field.help}</p>}
    </div>
  )
}
