'use client'

import { useState } from 'react'
import type { TemplateField } from '@/lib/ai'

interface CheckInFormProps {
  eventId: string
  whatsappUrl?: string
  fields: TemplateField[]  // dynamic fields (beyond name/email, which are always shown)
}

export default function CheckInForm({ eventId, whatsappUrl, fields }: CheckInFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false)

  const inputClass = 'w-full px-4 py-3 text-base border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

  const setResponse = (id: string, value: string) =>
    setResponses((prev) => ({ ...prev, [id]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    // Strip empty-string responses so we don't pollute the JSONB
    const cleaned: Record<string, string> = {}
    for (const [k, v] of Object.entries(responses)) {
      if (v && v.trim()) cleaned[k] = v.trim()
    }

    const res = await fetch(`/api/check-in/${eventId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, responses: cleaned }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong. Please try again or check in with an organizer.')
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
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {alreadyCheckedIn ? 'Already checked in!' : 'You\'re checked in!'}
          </h2>
          <p className="text-gray-600 text-sm">
            {alreadyCheckedIn
              ? 'Nice to see you again, enjoy the event.'
              : 'Show this screen to an organizer to get your wristband.'}
          </p>
        </div>

        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-green-600 text-white text-center px-5 py-3.5 rounded-xl font-medium hover:bg-green-700 transition-colors"
          >
            💬 Join our WhatsApp Community
          </a>
        )}

        <button
          onClick={() => {
            setSubmitted(false)
            setName('')
            setEmail('')
            setResponses({})
          }}
          className="mt-3 text-sm text-gray-500 hover:text-gray-700"
        >
          Check in someone else
        </button>
      </div>
    )
  }

  const renderField = (field: TemplateField) => {
    const value = responses[field.id] ?? ''

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
        </select>
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
        {saving ? 'Checking in…' : 'Check In'}
      </button>
    </form>
  )
}
