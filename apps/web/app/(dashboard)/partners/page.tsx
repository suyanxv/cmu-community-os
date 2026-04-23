'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Partner {
  id: string
  company_name: string
  contact_name: string | null
  email: string | null
  type: string
  status: string
  tier: string | null
}

const STATUS_COLORS: Record<string, string> = {
  prospect: 'bg-yellow-50 text-yellow-700',
  active: 'bg-green-50 text-green-700',
  past: 'bg-gray-100 text-gray-600',
  declined: 'bg-red-50 text-red-700',
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ company_name: '', contact_name: '', email: '', type: 'sponsor', tier: '', status: 'prospect', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/partners')
      .then((r) => r.json())
      .then((d) => { setPartners(d.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const addPartner = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const { data } = await res.json()
      setPartners((prev) => [data, ...prev])
      setForm({ company_name: '', contact_name: '', email: '', type: 'sponsor', tier: '', status: 'prospect', notes: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  const inputClass = 'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Partners & Sponsors</h1>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          + Add Partner
        </button>
      </div>

      {showForm && (
        <form onSubmit={addPartner} className="bg-white border border-indigo-200 rounded-xl p-5 mb-6 space-y-3">
          <h3 className="font-medium text-gray-900">Add Partner / Sponsor</h3>
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="Company Name *" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className={inputClass} />
            <input placeholder="Contact Name" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className={inputClass} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputClass}>
              <option value="sponsor">Sponsor</option>
              <option value="venue">Venue</option>
              <option value="media">Media</option>
              <option value="other">Other</option>
            </select>
            <input placeholder="Tier (Gold, Silver…)" value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })} className={inputClass} />
          </div>
          <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputClass} />
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add Partner'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-8">Loading…</p>
      ) : partners.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">🤝</p>
          <p className="text-lg font-medium text-gray-900">No partners yet</p>
          <p className="text-gray-500 mt-1">Add sponsors, venue hosts, and partner organizations</p>
        </div>
      ) : (
        <div className="space-y-3">
          {partners.map((p) => (
            <Link key={p.id} href={`/partners/${p.id}`} className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">{p.company_name}</h2>
                  {p.contact_name && <p className="text-sm text-gray-500 mt-0.5">{p.contact_name}{p.email ? ` · ${p.email}` : ''}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{p.type}</span>
                    {p.tier && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{p.tier}</span>}
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {p.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
