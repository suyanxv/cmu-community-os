'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'
import { CardListSkeleton } from '@/components/ui/Skeleton'

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

type PartnerTab = 'all' | 'prospect' | 'active' | 'past' | 'declined'
const TABS: { id: PartnerTab; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'prospect', label: 'Prospect' },
  { id: 'active',   label: 'Active' },
  { id: 'past',     label: 'Past' },
  { id: 'declined', label: 'Declined' },
]

export default function PartnersPage() {
  const toast = useToast()
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ company_name: '', contact_name: '', email: '', type: 'sponsor', tier: '', status: 'prospect', notes: '' })
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<PartnerTab>('all')

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
      toast.success(`${data.company_name} added`)
      setForm({ company_name: '', contact_name: '', email: '', type: 'sponsor', tier: '', status: 'prospect', notes: '' })
      setShowForm(false)
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to add partner')
    }
    setSaving(false)
  }

  const inputClass = 'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-sage-500'

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Partners & Sponsors</h1>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700">
          + Add Partner
        </button>
      </div>

      {showForm && (
        <form onSubmit={addPartner} className="bg-white border border-sage-200 rounded-xl p-5 mb-6 space-y-3">
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
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add Partner'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <CardListSkeleton count={4} />
      ) : partners.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">🤝</p>
          <p className="text-lg font-medium text-gray-900">No partners yet</p>
          <p className="text-gray-500 mt-1">Add sponsors, venue hosts, and partner organizations</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
            <div className="relative flex-1 max-w-md">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by company, contact, email…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
              />
            </div>
            <div className="flex gap-1 bg-stone-100 p-1 rounded-lg w-fit overflow-x-auto">
              {TABS.map((t) => {
                const count = t.id === 'all' ? partners.length : partners.filter((p) => p.status === t.id).length
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                      tab === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {t.label} <span className="text-gray-400">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <PartnerList partners={partners} query={query} tab={tab} />
        </>
      )}
    </div>
  )
}

function PartnerList({ partners, query, tab }: { partners: Partner[]; query: string; tab: PartnerTab }) {
  const q = query.trim().toLowerCase()
  const filtered = partners.filter((p) => {
    if (tab !== 'all' && p.status !== tab) return false
    if (!q) return true
    return (
      p.company_name.toLowerCase().includes(q) ||
      (p.contact_name?.toLowerCase().includes(q) ?? false) ||
      (p.email?.toLowerCase().includes(q) ?? false) ||
      p.type.toLowerCase().includes(q) ||
      (p.tier?.toLowerCase().includes(q) ?? false)
    )
  })

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-3xl mb-2">🔎</p>
        <p className="text-gray-500 text-sm">
          {q ? `No partners match "${query}"` : `No ${tab === 'all' ? '' : tab} partners`}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {filtered.map((p) => (
        <Link key={p.id} href={`/partners/${p.id}`} className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-sage-300 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">{p.company_name}</h2>
              {p.contact_name && <p className="text-sm text-gray-500 mt-0.5">{p.contact_name}{p.email ? ` · ${p.email}` : ''}</p>}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs bg-stone-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{p.type}</span>
                {p.tier && <span className="text-xs bg-butter-100 text-butter-700 px-2 py-0.5 rounded-full">{p.tier}</span>}
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {p.status}
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}
