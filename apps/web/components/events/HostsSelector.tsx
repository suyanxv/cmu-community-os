'use client'

import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'

interface Member {
  user_id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  title: string | null
  role: string
}

interface HostsSelectorProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  /** When true (e.g. new event create), auto-select the current user once members load. */
  defaultToCurrentUser?: boolean
}

export default function HostsSelector({ selectedIds, onChange, defaultToCurrentUser }: HostsSelectorProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const didDefaultRef = useRef(false)

  useEffect(() => {
    fetch('/api/members')
      .then((r) => r.json())
      .then((d) => {
        setMembers(d.data ?? [])
        setCurrentUserId(d.currentUserId ?? '')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Auto-add current user once, only for new events with empty initial selection
  useEffect(() => {
    if (defaultToCurrentUser && !didDefaultRef.current && currentUserId && selectedIds.length === 0) {
      didDefaultRef.current = true
      onChange([currentUserId])
    }
  }, [defaultToCurrentUser, currentUserId, selectedIds, onChange])

  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id]
    // Guard: don't allow dropping to zero hosts
    if (next.length === 0) return
    onChange(next)
  }

  if (loading) {
    return <p className="text-sm text-gray-400">Loading team…</p>
  }

  if (members.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        No team members yet. Invite them from Settings first.
      </p>
    )
  }

  const warning = selectedIds.length === 0
    ? 'At least one host is required.'
    : null

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {members.map((m) => {
          const selected = selectedIds.includes(m.user_id)
          const isOnlyHost = selected && selectedIds.length === 1
          const displayName = m.full_name ?? m.email
          return (
            <button
              key={m.user_id}
              type="button"
              onClick={() => toggle(m.user_id)}
              disabled={isOnlyHost}
              title={isOnlyHost ? 'An event needs at least one host — add another host before removing this one' : undefined}
              className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${
                selected
                  ? 'border-sage-400 bg-sage-50'
                  : 'border-gray-200 bg-white hover:border-sage-200'
              } ${isOnlyHost ? 'cursor-not-allowed' : ''}`}
            >
              {m.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.avatar_url} alt="" className="h-8 w-8 rounded-full shrink-0 object-cover" />
              ) : (
                <div className="h-8 w-8 rounded-full shrink-0 bg-stone-200 text-gray-600 flex items-center justify-center text-xs font-medium">
                  {(displayName[0] ?? '?').toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {displayName}
                  {m.user_id === currentUserId && <span className="text-gray-400 font-normal"> (you)</span>}
                </p>
                {m.title && <p className="text-xs text-gray-500 truncate">{m.title}</p>}
              </div>
              <div className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${
                selected ? 'border-sage-500 bg-sage-500' : 'border-gray-300'
              }`}>
                {selected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
              </div>
            </button>
          )
        })}
      </div>
      {warning && <p className="text-xs text-red-600 mt-2">{warning}</p>}
    </div>
  )
}
