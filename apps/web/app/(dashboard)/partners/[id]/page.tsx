'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'
import { Skeleton } from '@/components/ui/Skeleton'
import { Mail, Phone, Globe, Briefcase, Check, Sparkles, Pencil, Trash2, X, Plus } from 'lucide-react'
import { formatEventDate } from '@/lib/dates'

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

interface EventOption {
  id: string
  name: string
  event_date: string
}

const STATUS_COLORS: Record<string, string> = {
  prospect: 'bg-yellow-50 text-yellow-700',
  active: 'bg-green-50 text-green-700',
  past: 'bg-gray-100 text-gray-600',
  declined: 'bg-red-50 text-red-700',
}

const TYPE_OPTIONS = [
  { value: 'sponsor', label: 'Sponsor' },
  { value: 'venue', label: 'Venue' },
  { value: 'media', label: 'Media' },
  { value: 'co_host', label: 'Co-host org' },
  { value: 'other', label: 'Other' },
]

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const toast = useToast()
  const [partner, setPartner] = useState<Partner | null>(null)
  const [loading, setLoading] = useState(true)

  const [showNoteForm, setShowNoteForm] = useState(false)
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Partner>>({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [linking, setLinking] = useState(false)
  const [linkEventId, setLinkEventId] = useState('')
  const [linkRole, setLinkRole] = useState('')
  const [linkConfirmed, setLinkConfirmed] = useState(false)
  const [eventOptions, setEventOptions] = useState<EventOption[]>([])
  const [linkSaving, setLinkSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/partners/${id}`)
    if (res.ok) {
      const { data } = await res.json()
      setPartner(data)
    }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // Fetch all events once, for the linker dropdown.
  useEffect(() => {
    fetch('/api/events?limit=100')
      .then((r) => r.json())
      .then((d) => setEventOptions((d.data ?? []).map((e: { id: string; name: string; event_date: string }) => ({
        id: e.id, name: e.name, event_date: String(e.event_date).slice(0, 10),
      }))))
      .catch(() => {})
  }, [])

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingNote(true)
    const res = await fetch(`/api/partners/${id}/communications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'note', body: note }),
    })
    setSavingNote(false)
    if (res.ok) {
      toast.success('Note saved')
      setNote('')
      setShowNoteForm(false)
      await load()
    } else {
      toast.error('Failed to save note')
    }
  }

  const updateStatus = async (status: string) => {
    const res = await fetch(`/api/partners/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setPartner((p) => p ? { ...p, status } : p)
      toast.success(`Marked as ${status}`)
    }
  }

  const startEdit = () => {
    if (!partner) return
    setForm({
      company_name: partner.company_name,
      contact_name: partner.contact_name ?? '',
      email: partner.email ?? '',
      phone: partner.phone ?? '',
      linkedin_url: partner.linkedin_url ?? '',
      website: partner.website ?? '',
      type: partner.type,
      tier: partner.tier ?? '',
      notes: partner.notes ?? '',
    })
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setForm({})
  }

  const saveEdit = async () => {
    if (!form.company_name || !form.company_name.trim()) {
      toast.error('Company name is required')
      return
    }
    setSavingEdit(true)
    const payload = {
      company_name: form.company_name.trim(),
      contact_name: form.contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      linkedin_url: form.linkedin_url || null,
      website: form.website || null,
      type: form.type,
      tier: form.tier || null,
      notes: form.notes || null,
    }
    const res = await fetch(`/api/partners/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSavingEdit(false)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Failed to save' }))
      toast.error(error ?? 'Failed to save')
      return
    }
    toast.success('Saved')
    setEditing(false)
    await load()
  }

  const deletePartner = async () => {
    if (!confirm(`Delete "${partner?.company_name}"? This removes the partner and unlinks them from all events. This cannot be undone.`)) return
    setDeleting(true)
    const res = await fetch(`/api/partners/${id}`, { method: 'DELETE' })
    setDeleting(false)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Failed to delete' }))
      toast.error(error ?? 'Failed to delete')
      return
    }
    toast.success('Partner deleted')
    router.push('/partners')
  }

  const linkedEventIds = new Set((partner?.events ?? []).map((e) => e.id))
  const availableEvents = eventOptions
    .filter((e) => !linkedEventIds.has(e.id))
    .sort((a, b) => b.event_date.localeCompare(a.event_date))

  const linkEvent = async () => {
    if (!linkEventId) { toast.error('Pick an event'); return }
    setLinkSaving(true)
    const res = await fetch(`/api/events/${linkEventId}/partners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partner_id: id,
        role: linkRole || null,
        confirmed: linkConfirmed,
      }),
    })
    setLinkSaving(false)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Failed to link' }))
      toast.error(error ?? 'Failed to link')
      return
    }
    toast.success('Linked to event')
    setLinking(false)
    setLinkEventId(''); setLinkRole(''); setLinkConfirmed(false)
    await load()
  }

  const unlinkEvent = async (eventId: string, eventName: string) => {
    if (!confirm(`Unlink "${eventName}"? The event will lose this partner connection but the partner stays.`)) return
    const res = await fetch(`/api/events/${eventId}/partners/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Failed to unlink')
      return
    }
    toast.success('Unlinked')
    await load()
  }

  if (loading) return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  )
  if (!partner) return <div className="p-8 text-gray-500">Partner not found.</div>

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
  const labelCls = 'text-xs uppercase tracking-wide font-medium text-gray-500 block mb-1'

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <Link href="/partners" className="text-sm text-gray-500 hover:text-gray-700 mb-4 block">
        ← Back to Partners
      </Link>

      {/* Header (read mode) */}
      {!editing ? (
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 break-words">{partner.company_name}</h1>
            {partner.contact_name && <p className="text-gray-500 mt-1">{partner.contact_name}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                {partner.type === 'co_host' ? 'Co-host org' : partner.type}
              </span>
              {partner.tier && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{partner.tier}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
            <button
              onClick={startEdit}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 text-gray-700 rounded-lg hover:bg-stone-50"
            >
              <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} /> Edit
            </button>
            <button
              onClick={deletePartner}
              disabled={deleting}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} /> {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-sage-300 rounded-xl p-5 mb-6 space-y-3 ring-2 ring-sage-100">
          <h2 className="text-base font-semibold text-gray-900">Edit partner</h2>
          <div>
            <label className={labelCls}>Company name *</label>
            <input value={form.company_name ?? ''} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className={inputCls} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Contact name</label>
              <input value={form.contact_name ?? ''} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select value={form.type ?? 'sponsor'} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls}>
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Tier</label>
              <input value={form.tier ?? ''} onChange={(e) => setForm({ ...form, tier: e.target.value })} placeholder="Gold, Silver…" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Website</label>
              <input value={form.website ?? ''} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>LinkedIn URL</label>
              <input value={form.linkedin_url ?? ''} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/…" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className={inputCls} />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={cancelEdit} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button
              onClick={saveEdit}
              disabled={savingEdit}
              className="bg-sage-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sage-700 disabled:opacity-50"
            >
              {savingEdit ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      {/* Contact info (read-mode only — fields live in edit form when editing) */}
      {!editing && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5 space-y-2">
          {partner.email && (
            <p className="text-sm text-gray-700 flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
              <a href={`mailto:${partner.email}`} className="text-sage-700 hover:underline break-all">{partner.email}</a>
            </p>
          )}
          {partner.phone && (
            <p className="text-sm text-gray-700 flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
              {partner.phone}
            </p>
          )}
          {partner.website && (
            <p className="text-sm text-gray-700 flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
              <a href={partner.website} target="_blank" rel="noopener noreferrer" className="text-sage-700 hover:underline break-all">{partner.website}</a>
            </p>
          )}
          {partner.linkedin_url && (
            <p className="text-sm text-gray-700 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
              <a href={partner.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sage-700 hover:underline">LinkedIn</a>
            </p>
          )}
          {!partner.email && !partner.phone && !partner.website && !partner.linkedin_url && (
            <p className="text-sm text-gray-400">No contact info on file. Click Edit to add some.</p>
          )}
          {partner.notes && <p className="text-sm text-gray-500 mt-2 pt-2 border-t border-gray-100 whitespace-pre-wrap break-words">{partner.notes}</p>}
        </div>
      )}

      {/* Events (with link/unlink) */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-gray-700">Events</h2>
          {!linking && (
            <button
              onClick={() => setLinking(true)}
              disabled={availableEvents.length === 0}
              className="inline-flex items-center gap-1 text-xs text-sage-600 hover:text-sage-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title={availableEvents.length === 0 ? 'All your events are already linked' : 'Link an event'}
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.75} /> Link event
            </button>
          )}
        </div>

        {linking && (
          <div className="border border-sage-200 bg-sage-50/50 rounded-lg p-3 mb-3 space-y-2">
            <div>
              <label className={labelCls}>Event</label>
              <select value={linkEventId} onChange={(e) => setLinkEventId(e.target.value)} className={inputCls}>
                <option value="">Select an event…</option>
                {availableEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.event_date} — {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Role (optional)</label>
                <input value={linkRole} onChange={(e) => setLinkRole(e.target.value)} placeholder="Co-host, Sponsor, Venue…" className={inputCls} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 mt-5 sm:mt-6">
                <input type="checkbox" checked={linkConfirmed} onChange={(e) => setLinkConfirmed(e.target.checked)} />
                Confirmed
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={() => { setLinking(false); setLinkEventId(''); setLinkRole(''); setLinkConfirmed(false) }} className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1">
                Cancel
              </button>
              <button
                onClick={linkEvent}
                disabled={linkSaving || !linkEventId}
                className="bg-sage-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-sage-700 disabled:opacity-50"
              >
                {linkSaving ? 'Linking…' : 'Link'}
              </button>
            </div>
          </div>
        )}

        {partner.events.length === 0 ? (
          <p className="text-sm text-gray-400">Not linked to any events yet.</p>
        ) : (
          <div className="space-y-2">
            {partner.events.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between text-sm gap-2 group">
                <Link href={`/events/${ev.id}`} className="text-sage-600 hover:underline truncate">{ev.event_name}</Link>
                <div className="flex items-center gap-2 text-gray-400 shrink-0">
                  {ev.role && <span className="hidden sm:inline">{ev.role}</span>}
                  <span className="text-xs">{formatEventDate(ev.event_date, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  {ev.confirmed && <Check className="w-3.5 h-3.5 text-sage-600" strokeWidth={2.5} />}
                  <button
                    onClick={() => unlinkEvent(ev.id, ev.event_name)}
                    className="text-gray-400 hover:text-red-500 p-0.5"
                    title="Unlink from this event"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
              <button type="submit" disabled={savingNote} className="px-3 py-1.5 text-xs bg-sage-600 text-white rounded-lg hover:bg-sage-700 disabled:opacity-50">
                {savingNote ? 'Saving…' : 'Save Note'}
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
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-medium text-gray-600 capitalize">{c.type}</span>
                  {c.ai_drafted && (
                    <span className="inline-flex items-center gap-1 text-xs text-sage-600">
                      <Sparkles className="w-3 h-3" strokeWidth={1.75} /> AI
                    </span>
                  )}
                  {c.event_name && <span className="text-xs text-gray-400">· {c.event_name}</span>}
                  <span className="text-xs text-gray-400 ml-auto">{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                {c.subject && <p className="text-xs font-medium text-gray-700 mb-1">{c.subject}</p>}
                <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{c.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
