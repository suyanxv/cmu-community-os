'use client'

import { useState } from 'react'

interface CheckInFormProps {
  eventId: string
  whatsappUrl?: string
}

export default function CheckInForm({ eventId, whatsappUrl }: CheckInFormProps) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    graduation_year: '',
    school: '',
    how_heard: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false)

  const input = 'w-full px-4 py-3 text-base border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent'
  const label = 'block text-sm font-medium text-gray-700 mb-1.5'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/check-in/${eventId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, whatsapp_joined: !!whatsappUrl }),
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
              ? 'Nice to see you again — enjoy the event.'
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
          onClick={() => { setSubmitted(false); setForm({ name: '', email: '', graduation_year: '', school: '', how_heard: '' }) }}
          className="mt-3 text-sm text-gray-500 hover:text-gray-700"
        >
          Check in someone else
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={label}>Full Name *</label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Suyan Xu"
          className={input}
          autoComplete="name"
        />
      </div>

      <div>
        <label className={label}>Email *</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="you@example.com"
          className={input}
          autoComplete="email"
          inputMode="email"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Grad Year</label>
          <input
            type="text"
            value={form.graduation_year}
            onChange={(e) => setForm({ ...form, graduation_year: e.target.value })}
            placeholder="2020"
            className={input}
            inputMode="numeric"
          />
        </div>
        <div>
          <label className={label}>School</label>
          <input
            type="text"
            value={form.school}
            onChange={(e) => setForm({ ...form, school: e.target.value })}
            placeholder="Tepper, SCS, …"
            className={input}
          />
        </div>
      </div>

      <div>
        <label className={label}>How did you hear about us?</label>
        <input
          type="text"
          value={form.how_heard}
          onChange={(e) => setForm({ ...form, how_heard: e.target.value })}
          placeholder="WhatsApp, friend, email…"
          className={input}
        />
      </div>

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
