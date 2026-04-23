'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface LinkedPartner {
  id: string
  partner_id: string
  company_name: string
  contact_name: string | null
  email: string | null
  type: string
  tier: string | null
  role: string | null
  contribution: string | null
  confirmed: boolean
}

interface OrgPartner {
  id: string
  company_name: string
  type: string
}

export default function EventPartnersSection({ eventId }: { eventId: string }) {
  const [linked, setLinked] = useState<LinkedPartner[]>([])
  const [orgPartners, setOrgPartners] = useState<OrgPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ partner_id: '', role: '', contribution: '', confirmed: false })
  const [saving, setSaving] = useState(false)

  const fetchLinked = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/partners`)
    if (res.ok) {
      const { data } = await res.json()
      setLinked(data ?? [])
    }
    setLoading(false)
  }, [eventId])

  const fetchOrgPartners = useCallback(async () => {
    const res = await fetch('/api/partners')
    if (res.ok) {
      const { data } = await res.json()
      setOrgPartners(data ?? [])
    }
  }, [])

  useEffect(() => { fetchLinked(); fetchOrgPartners() }, [fetchLinked, fetchOrgPartners])

  const linkPartner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.partner_id) return
    setSaving(true)
    await fetch(`/api/events/${eventId}/partners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm({ partner_id: '', role: '', contribution: '', confirmed: false })
    setShowForm(false)
    setSaving(false)
    await fetchLinked()
  }

  const toggleConfirmed = async (partnerId: string, confirmed: boolean) => {
    await fetch(`/api/events/${eventId}/partners/${partnerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed }),
    })
    setLinked((prev) => prev.map((p) => p.partner_id === partnerId ? { ...p, confirmed } : p))
  }

  const unlink = async (partnerId: string, companyName: string) => {
    if (!confirm(`Unlink ${companyName} from this event?`)) return
    await fetch(`/api/events/${eventId}/partners/${partnerId}`, { method: 'DELETE' })
    setLinked((prev) => prev.filter((p) => p.partner_id !== partnerId))
  }

  const inputClass = 'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-sage-500'

  // Only show partners not already linked
  const availablePartners = orgPartners.filter(
    (op) => !linked.some((lp) => lp.partner_id === op.id)
  )

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">Partners & Sponsors</h2>
        {!showForm && availablePartners.length > 0 && (
          <button
            onClick={() => setShowForm(true)}
            className="text-sm text-sage-700 hover:text-sage-800 font-medium"
          >
            + Link Partner
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={linkPartner} className="border border-sage-200 bg-sage-50/50 rounded-lg p-4 mb-4 space-y-3">
          <select
            required
            value={form.partner_id}
            onChange={(e) => setForm({ ...form, partner_id: e.target.value })}
            className={inputClass}
          >
            <option value="">Select a partner…</option>
            {availablePartners.map((p) => (
              <option key={p.id} value={p.id}>{p.company_name} ({p.type})</option>
            ))}
          </select>
          <input
            placeholder="Role (e.g. Gold Sponsor, Venue Host)"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className={inputClass}
          />
          <input
            placeholder="Contribution (e.g. $2,000, venue + AV)"
            value={form.contribution}
            onChange={(e) => setForm({ ...form, contribution: e.target.value })}
            className={inputClass}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.confirmed}
              onChange={(e) => setForm({ ...form, confirmed: e.target.checked })}
              className="h-4 w-4"
            />
            Confirmed
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !form.partner_id}
              className="px-3 py-1.5 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 disabled:opacity-50"
            >
              {saving ? 'Linking…' : 'Link Partner'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm({ partner_id: '', role: '', contribution: '', confirmed: false }) }}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-stone-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-4">Loading…</p>
      ) : linked.length === 0 ? (
        <div className="text-sm text-gray-500 py-2">
          No partners linked yet.{' '}
          {orgPartners.length === 0 ? (
            <>First <Link href="/partners" className="text-sage-700 hover:underline font-medium">add a partner</Link> to your CRM.</>
          ) : !showForm && (
            <>Click <button onClick={() => setShowForm(true)} className="text-sage-700 hover:underline font-medium">+ Link Partner</button> above to add one.</>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {linked.map((p) => (
            <div key={p.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-stone-50">
              <input
                type="checkbox"
                checked={p.confirmed}
                onChange={(e) => toggleConfirmed(p.partner_id, e.target.checked)}
                className="mt-1 h-4 w-4"
                title={p.confirmed ? 'Confirmed' : 'Pending confirmation'}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/partners/${p.partner_id}`} className="font-medium text-gray-900 hover:text-sage-700">
                    {p.company_name}
                  </Link>
                  <span className="text-xs bg-stone-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{p.type}</span>
                  {p.tier && <span className="text-xs bg-butter-100 text-butter-700 px-2 py-0.5 rounded-full">{p.tier}</span>}
                  {p.confirmed && <span className="text-xs text-green-600">✓ Confirmed</span>}
                </div>
                {(p.role || p.contribution) && (
                  <p className="text-xs text-gray-500 mt-1">
                    {p.role}{p.role && p.contribution ? ' · ' : ''}{p.contribution}
                  </p>
                )}
                {p.contact_name && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p.contact_name}{p.email ? ` · ${p.email}` : ''}
                  </p>
                )}
              </div>
              <button
                onClick={() => unlink(p.partner_id, p.company_name)}
                className="text-gray-300 hover:text-red-600 p-1 rounded transition-colors"
                title="Unlink partner"
                aria-label={`Unlink ${p.company_name}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
