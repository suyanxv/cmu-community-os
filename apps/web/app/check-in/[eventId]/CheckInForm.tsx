'use client'

import { useState } from 'react'
import { Check, MessageCircle } from 'lucide-react'
import type { TemplateField } from '@/lib/ai'

interface CheckInFormProps {
  eventId: string
  whatsappUrl?: string
  successMessage?: string  // per-event message on the confirmation screen
  fields: TemplateField[]  // dynamic fields (beyond name/email, which are always shown)
}

// Sentinel for the "Other" choice while the form is being edited; replaced
// with the write-in text at submit time.
const OTHER = '__other__'

export default function CheckInForm({ eventId, whatsappUrl, successMessage, fields }: CheckInFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [responses, setResponses] = useState<Record<string, string | string[]>>({})
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false)

  const inputClass = 'w-full px-4 py-3 text-base border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

  const setResponse = (id: string, value: string) =>
    setResponses((prev) => ({ ...prev, [id]: value }))

  const toggleMultiResponse = (id: string, option: string) =>
    setResponses((prev) => {
      const current = Array.isArray(prev[id]) ? (prev[id] as string[]) : []
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option]
      return { ...prev, [id]: next }
    })

  // Swap the Other sentinel for the write-in text (dropped when blank).
  const resolveOther = (fieldId: string, v: string): string | null => {
    if (v !== OTHER) return v
    const text = (otherTexts[fieldId] ?? '').trim()
    return text || null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Resolve Other write-ins and strip empty responses in one pass.
    const cleaned: Record<string, string | string[]> = {}
    for (const [k, v] of Object.entries(responses)) {
      if (Array.isArray(v)) {
        const resolved = v
          .map((item) => resolveOther(k, item))
          .filter((item): item is string => !!item)
        if (resolved.length > 0) cleaned[k] = resolved
      } else if (v && v.trim()) {
        const resolved = resolveOther(k, v.trim())
        if (resolved) cleaned[k] = resolved
      }
    }

    // Validate what HTML can't: required checkbox groups, and a chosen
    // "Other" whose text box was left empty.
    for (const f of fields) {
      const raw = responses[f.id]
      const pickedOtherWithoutText =
        (Array.isArray(raw) ? raw.includes(OTHER) : raw === OTHER) &&
        !(otherTexts[f.id] ?? '').trim()
      if (pickedOtherWithoutText) {
        setError(`Please fill in the "Other" box for "${f.label}"`)
        return
      }
      if (f.type === 'multiselect' && f.required) {
        const v = cleaned[f.id]
        if (!Array.isArray(v) || v.length === 0) {
          setError(`Please select at least one option for "${f.label}"`)
          return
        }
      }
    }

    setSaving(true)

    const res = await fetch(`/api/check-in/${eventId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, responses: cleaned }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong. Please try again or let an organizer know.')
      return
    }
    const { data } = await res.json()
    setAlreadyCheckedIn(!!data?.already_checked_in)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="text-center">
        <div className="bg-sage-50 border border-sage-200 rounded-2xl p-8 mb-5">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-sage-500 flex items-center justify-center">
            <Check className="w-8 h-8 text-white" strokeWidth={3} />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {alreadyCheckedIn ? 'Response updated!' : 'Thanks for your feedback!'}
          </h2>
          <p className="text-gray-600 text-sm">
            {alreadyCheckedIn
              ? 'We already had a response from you, so we merged in your new answers.'
              : successMessage || 'Your response has been recorded.'}
          </p>
        </div>

        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full bg-green-600 text-white text-center px-5 py-3.5 rounded-xl font-medium hover:bg-green-700 transition-colors"
          >
            <MessageCircle className="w-5 h-5" strokeWidth={1.75} />
            Join our WhatsApp Community
          </a>
        )}

        <button
          onClick={() => {
            setSubmitted(false)
            setName('')
            setEmail('')
            setResponses({})
            setOtherTexts({})
          }}
          className="mt-3 text-sm text-gray-500 hover:text-gray-700"
        >
          Submit another response
        </button>
      </div>
    )
  }

  const renderField = (field: TemplateField) => {
    const raw = responses[field.id]
    const value = typeof raw === 'string' ? raw : ''

    if (field.type === 'multiselect') {
      const selected = Array.isArray(raw) ? raw : []
      const choices = [...(field.options ?? []), ...(field.allow_other ? [OTHER] : [])]
      return (
        <div className="space-y-2">
          {choices.map((opt) => (
            <label
              key={opt}
              className={`flex items-center gap-3 px-4 py-3 border rounded-xl cursor-pointer transition-colors ${
                selected.includes(opt)
                  ? 'border-sage-500 bg-sage-50'
                  : 'border-gray-300 bg-white hover:border-sage-300'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggleMultiResponse(field.id, opt)}
                className="h-4 w-4 accent-[var(--sage-600)]"
              />
              <span className="text-base text-gray-900">{opt === OTHER ? 'Other' : opt}</span>
            </label>
          ))}
          {field.allow_other && selected.includes(OTHER) && (
            <input
              type="text"
              value={otherTexts[field.id] ?? ''}
              onChange={(e) => setOtherTexts((prev) => ({ ...prev, [field.id]: e.target.value }))}
              placeholder="Tell us more…"
              autoFocus
              className={inputClass}
            />
          )}
        </div>
      )
    }

    if (field.type === 'textarea') {
      return (
        <textarea
          required={field.required}
          value={value}
          onChange={(e) => setResponse(field.id, e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={inputClass}
        />
      )
    }

    if (field.type === 'select') {
      return (
        <div className="space-y-2">
          <select
            required={field.required}
            value={value}
            onChange={(e) => setResponse(field.id, e.target.value)}
            className={inputClass}
          >
            <option value="">Select…</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
            {field.allow_other && <option value={OTHER}>Other…</option>}
          </select>
          {field.allow_other && value === OTHER && (
            <input
              type="text"
              value={otherTexts[field.id] ?? ''}
              onChange={(e) => setOtherTexts((prev) => ({ ...prev, [field.id]: e.target.value }))}
              placeholder="Tell us more…"
              autoFocus
              className={inputClass}
            />
          )}
        </div>
      )
    }

    return (
      <input
        type={field.type === 'number' ? 'text' : field.type}
        inputMode={field.type === 'number' ? 'numeric' : field.type === 'email' ? 'email' : undefined}
        required={field.required}
        value={value}
        onChange={(e) => setResponse(field.id, e.target.value)}
        placeholder={field.placeholder}
        className={inputClass}
      />
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Always-shown locked fields */}
      <div>
        <label className={labelClass}>Full Name *</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Suyan Xu"
          className={inputClass}
          autoComplete="name"
        />
      </div>

      <div>
        <label className={labelClass}>Email *</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={inputClass}
          autoComplete="email"
          inputMode="email"
        />
      </div>

      {/* Dynamic fields configured on the event */}
      {fields.map((field) => (
        <div key={field.id}>
          <label className={labelClass}>
            {field.label}{field.required ? ' *' : ''}
          </label>
          {renderField(field)}
          {field.help && <p className="text-xs text-gray-400 mt-1">{field.help}</p>}
        </div>
      ))}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-sage-600 text-white px-5 py-3.5 rounded-xl font-medium text-base hover:bg-sage-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Submitting…' : 'Submit'}
      </button>
    </form>
  )
}
