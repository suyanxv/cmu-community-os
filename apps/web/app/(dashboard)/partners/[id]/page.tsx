'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Partner {
  id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  website: string | null
  type: string
  tier: string | null
  status: string
  notes: string | null
  communications: Array<{
    id: string
    type: string
    direction: string | null
    subject: string | null
    body: string
    ai_drafted: boolean
    sent_at: string | null
    created_at: string
    event_name: string | null
  }>
  events: Array<{
    id: string
    event_name: string
    event_date: string
    role: string | null
    confirmed: boolean
  }>
}

const STATUS_COLORS: Record<string, string> = {
  prospect: 'bg-yellow-50 text-yellow-700',
  active: 'bg-green-50 text-green-700',
  past: 'bg-gray-100 text-gray-600',
  declined: 'bg-red-50 text-red-700',
}

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [partner, setPartner] = useState<Partner | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/partners/${id}`)
      .then((r) => r.json())
      .then((d) => { setPartner(d.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await fetch(`/api/partners/${id}/communications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'note', body: note }),
    })
    setSaving(false)
    setNote('')
    setShowNoteForm(false)
    // Refresh
    fetch(`/api/partners/${id}`)
      .then((r) => r.json())
      .then((d) => setPartner(d.data))
  }

  const updateStatus = async (status: string) => {
    await fetch(`/api/partners/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setPartner((p) => p ? { ...p, status } : p)
  }

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>
  if (!partner) return <div className="p-8 text-gray-500">Partner not found.</div>

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/partners" className="text-sm text-gray-500 hover:text-gray-700 mb-4 block">
        ← Back to Partners
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{partner.company_name}</h1>
          {partner.contact_name && <p className="text-gray-500 mt-1">{partner.contact_name}</p>}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{partner.type}</span>
            {partner.tier && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{partner.tier}</span>}
          </div>
        </div>
        <select
          value={partner.status}
          onChange={(e) => updateStatus(e.target.value)}
          className={`text-sm px-3 py-1.5 rounded-full border font-medium capitalize ${STATUS_COLORS[partner.status] ?? 'bg-gray-100 text-gray-600'}`}
        >
          <option value="prospect">Prospect</option>
          <option value="active">Active</option>
          <option value="past">Past</option>
          <option value="declined">Declined</option>
        </select>
      </div>

      {/* Contact info */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5 space-y-2">
        {partner.email && <p className="text-sm text-gray-700">📧 <a href={`mailto:${partner.email}`} className="text-sage-600 hover:underline">{partner.email}</a></p>}
        {partner.phone && <p className="text-sm text-gray-700">📞 {partner.phone}</p>}
        {partner.website && <p className="text-sm text-gray-700">🌐 <a href={partner.website} target="_blank" rel="noopener noreferrer" className="text-sage-600 hover:underline">{partner.website}</a></p>}
        {partner.linkedin_url && <p className="text-sm text-gray-700">💼 <a href={partner.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sage-600 hover:underline">LinkedIn</a></p>}
        {partner.notes && <p className="text-sm text-gray-500 mt-2 pt-2 border-t border-gray-100">{partner.notes}</p>}
      </div>

      {/* Events */}
      {partner.events.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Events</h2>
          <div className="space-y-2">
            {partner.events.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between text-sm">
                <Link href={`/events/${ev.id}`} className="text-sage-600 hover:underline">{ev.event_name}</Link>
                <div className="flex items-center gap-2 text-gray-400">
                  {ev.role && <span>{ev.role}</span>}
                  <span>{new Date(ev.event_date).toLocaleDateString()}</span>
                  {ev.confirmed && <span className="text-green-500">✓</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Communications */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Communication History</h2>
          <button onClick={() => setShowNoteForm(true)} className="text-xs text-sage-600 hover:text-sage-700 font-medium">
            + Add Note
          </button>
        </div>

        {showNoteForm && (
          <form onSubmit={addNote} className="mb-4 space-y-2">
            <textarea
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Add a note about this partner…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
            />
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="px-3 py-1.5 text-xs bg-sage-600 text-white rounded-lg hover:bg-sage-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Note'}
              </button>
              <button type="button" onClick={() => setShowNoteForm(false)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-stone-50">Cancel</button>
            </div>
          </form>
        )}

        {partner.communications.length === 0 ? (
          <p className="text-sm text-gray-400">No communications logged yet.</p>
        ) : (
          <div className="space-y-3">
            {partner.communications.map((c) => (
              <div key={c.id} className="border-l-2 border-gray-200 pl-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-600 capitalize">{c.type}</span>
                  {c.ai_drafted && <span className="text-xs text-sage-400">✨ AI</span>}
                  {c.event_name && <span className="text-xs text-gray-400">· {c.event_name}</span>}
                  <span className="text-xs text-gray-400 ml-auto">{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                {c.subject && <p className="text-xs font-medium text-gray-700 mb-1">{c.subject}</p>}
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
