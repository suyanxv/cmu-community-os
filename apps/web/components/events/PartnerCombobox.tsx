'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Plus, Check, Search } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface PartnerOption {
  id: string
  company_name: string
  type: string
}

interface Props {
  /** Currently selected partner names (strings). We keep names (not ids) so the
   *  existing co_hosts text[] column on events continues to work unchanged. */
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}

export default function PartnerCombobox({ value, onChange, placeholder }: Props) {
  const toast = useToast()
  const [partners, setPartners] = useState<PartnerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Load partners once on mount.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/partners')
        if (!res.ok || cancelled) return
        const { data } = await res.json()
        if (!cancelled) {
          setPartners((data ?? []).map((p: { id: string; company_name: string; type: string }) => ({
            id: p.id, company_name: p.company_name, type: p.type,
          })))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Close dropdown on outside click.
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const selectedSet = useMemo(() => new Set(value.map((v) => v.toLowerCase())), [value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return partners.filter((p) => !selectedSet.has(p.company_name.toLowerCase())).slice(0, 20)
    return partners
      .filter((p) => p.company_name.toLowerCase().includes(q) && !selectedSet.has(p.company_name.toLowerCase()))
      .slice(0, 20)
  }, [partners, query, selectedSet])

  // "Create new X" option appears when:
  // - the user typed something
  // - no existing partner exactly matches the typed name (case-insensitive)
  // - the typed name isn't already in the selected list
  const canCreate = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) return false
    const lower = trimmed.toLowerCase()
    if (selectedSet.has(lower)) return false
    return !partners.some((p) => p.company_name.toLowerCase() === lower)
  }, [query, partners, selectedSet])

  const addExisting = (p: PartnerOption) => {
    onChange([...value, p.company_name])
    setQuery('')
    inputRef.current?.focus()
  }

  const removeAt = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx))
  }

  const createAndAdd = async () => {
    const name = query.trim()
    if (!name) return
    setCreating(true)
    const res = await fetch('/api/partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_name: name, type: 'co_host', status: 'active' }),
    })
    setCreating(false)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Failed to create partner' }))
      toast.error(error ?? 'Failed to create partner')
      return
    }
    const { data } = await res.json()
    const newPartner: PartnerOption = { id: data.id, company_name: data.company_name, type: data.type }
    setPartners((prev) => [...prev, newPartner])
    onChange([...value, newPartner.company_name])
    setQuery('')
    inputRef.current?.focus()
    toast.success(`Partner "${newPartner.company_name}" created`)
  }

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && query === '' && value.length > 0) {
      e.preventDefault()
      removeAt(value.length - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      // Prefer exact-match existing before creating.
      const exact = partners.find((p) => p.company_name.toLowerCase() === query.trim().toLowerCase())
      if (exact && !selectedSet.has(exact.company_name.toLowerCase())) addExisting(exact)
      else if (filtered[0]) addExisting(filtered[0])
      else if (canCreate) createAndAdd()
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div
        onClick={() => { setOpen(true); inputRef.current?.focus() }}
        className="min-h-[42px] w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white flex flex-wrap gap-1.5 items-center cursor-text focus-within:ring-2 focus-within:ring-sage-500 focus-within:border-sage-500"
      >
        {value.map((name, i) => (
          <span key={`${name}-${i}`} className="inline-flex items-center gap-1 bg-butter-50 border border-butter-200 text-butter-700 text-xs px-2 py-0.5 rounded-full">
            {name}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeAt(i) }}
              className="hover:text-butter-900"
              aria-label={`Remove ${name}`}
            >
              <X className="w-3 h-3" strokeWidth={2} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder={value.length === 0 ? (placeholder ?? 'Search partners or add new…') : ''}
          className="flex-1 min-w-[140px] outline-none bg-transparent text-sm"
        />
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-2 text-xs text-gray-400 flex items-center gap-2">
              <Search className="w-3.5 h-3.5" strokeWidth={1.75} /> Loading partners…
            </div>
          ) : (
            <>
              {filtered.length > 0 && (
                <div className="py-1">
                  {filtered.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addExisting(p)}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-sage-50 flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{p.company_name}</span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-gray-400">
                        {p.type === 'co_host' ? 'Co-host' : p.type}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {canCreate && (
                <div className="border-t border-gray-100">
                  <button
                    type="button"
                    onClick={createAndAdd}
                    disabled={creating}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-sage-50 flex items-center gap-2 text-sage-700 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" strokeWidth={1.75} />
                    <span>{creating ? 'Creating…' : <>Create new partner <strong>&ldquo;{query.trim()}&rdquo;</strong></>}</span>
                  </button>
                </div>
              )}

              {filtered.length === 0 && !canCreate && (
                <div className="px-3 py-3 text-xs text-gray-400">
                  {query.trim() ? 'Already selected.' : 'No partners yet. Start typing to add one.'}
                </div>
              )}

              {value.length > 0 && (
                <div className="border-t border-gray-100 px-3 py-1.5 text-[11px] text-gray-400 flex items-center gap-1">
                  <Check className="w-3 h-3" strokeWidth={2} /> Backspace removes the last chip
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
