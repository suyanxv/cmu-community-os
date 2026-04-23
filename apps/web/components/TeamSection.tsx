'use client'

import { useEffect, useState, useCallback } from 'react'
import { Pencil, Check, X, Trash2, UserCog, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { CardListSkeleton } from '@/components/ui/Skeleton'

interface Member {
  id: string
  user_id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  role: 'admin' | 'editor'
  title: string | null
  joined_at: string | null
}

const TITLE_SUGGESTIONS = [
  'President',
  'Co-President',
  'Vice President',
  'Treasurer',
  'Secretary',
  'Board Member',
  'Events Chair',
  'Communications Chair',
  'Volunteer Coordinator',
]

export default function TeamSection() {
  const toast = useToast()
  const [members, setMembers] = useState<Member[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [editingTitle, setEditingTitle] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [syncing, setSyncing] = useState(false)

  const fetchMembers = useCallback(async () => {
    const res = await fetch('/api/members')
    if (res.ok) {
      const data = await res.json()
      setMembers(data.data ?? [])
      setCurrentUserId(data.currentUserId ?? '')
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const startEditTitle = (member: Member) => {
    setEditingTitle(member.user_id)
    setTitleDraft(member.title ?? '')
  }

  const cancelEditTitle = () => {
    setEditingTitle(null)
    setTitleDraft('')
  }

  const saveTitle = async (userId: string) => {
    const res = await fetch(`/api/members/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleDraft.trim() || null }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to update title')
      return
    }
    setMembers((prev) => prev.map((m) => m.user_id === userId ? { ...m, title: titleDraft.trim() || null } : m))
    cancelEditTitle()
    toast.success('Title updated')
  }

  const changeRole = async (userId: string, role: 'admin' | 'editor') => {
    const res = await fetch(`/api/members/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to change role')
      return
    }
    setMembers((prev) => prev.map((m) => m.user_id === userId ? { ...m, role } : m))
    toast.success(`Role changed to ${role}`)
  }

  const removeMember = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from the organization?`)) return
    const res = await fetch(`/api/members/${userId}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to remove member')
      return
    }
    setMembers((prev) => prev.filter((m) => m.user_id !== userId))
    toast.success(`${name} removed`)
  }

  const syncFromClerk = async () => {
    setSyncing(true)
    const res = await fetch('/api/members/sync', { method: 'POST' })
    setSyncing(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to sync from Clerk')
      return
    }
    const { data } = await res.json()
    toast.success(`Synced — ${data.imported} added, ${data.updated} updated`)
    await fetchMembers()
  }

  const currentMember = members.find((m) => m.user_id === currentUserId)
  const isAdmin = currentMember?.role === 'admin'

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Team</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage board roles and titles. Invite new members using the{' '}
            <span className="font-medium text-gray-700">Organization &amp; Members</span> panel below.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={syncFromClerk}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-stone-50 disabled:opacity-50 shrink-0"
            title="Backfill any members Clerk knows about but Quorum missed (e.g. if a webhook event was dropped)"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} strokeWidth={1.75} />
            {syncing ? 'Syncing…' : 'Sync from Clerk'}
          </button>
        )}
      </div>

      {loading ? (
        <CardListSkeleton count={2} />
      ) : members.length === 0 ? (
        <p className="text-sm text-gray-400">No members yet.</p>
      ) : (
        <div className="space-y-2">
          {members.map((m) => {
            const isSelf = m.user_id === currentUserId
            const canEditTitle = isSelf || isAdmin
            const editing = editingTitle === m.user_id
            const displayName = m.full_name ?? m.email

            return (
              <div key={m.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-sage-200 transition-colors">
                {/* Avatar */}
                {m.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatar_url} alt="" className="h-9 w-9 rounded-full shrink-0 object-cover" />
                ) : (
                  <div className="h-9 w-9 rounded-full shrink-0 bg-sage-100 text-sage-700 flex items-center justify-center text-sm font-medium">
                    {(displayName[0] ?? '?').toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {/* Name + role badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 truncate">{displayName}</p>
                    {isSelf && <span className="text-xs text-gray-400">(you)</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      m.role === 'admin' ? 'bg-sage-100 text-sage-700' : 'bg-stone-100 text-gray-600'
                    }`}>
                      {m.role === 'admin' ? 'Admin' : 'Editor'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{m.email}</p>

                  {/* Title row */}
                  <div className="mt-2">
                    {editing ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="text"
                          value={titleDraft}
                          onChange={(e) => setTitleDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveTitle(m.user_id)
                            if (e.key === 'Escape') cancelEditTitle()
                          }}
                          list={`title-suggestions-${m.id}`}
                          placeholder="e.g. Co-President, Board Member"
                          autoFocus
                          className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-sage-500"
                        />
                        <datalist id={`title-suggestions-${m.id}`}>
                          {TITLE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}
                        </datalist>
                        <button
                          onClick={() => saveTitle(m.user_id)}
                          className="p-1.5 rounded hover:bg-sage-50 text-sage-700"
                          aria-label="Save"
                        >
                          <Check className="w-4 h-4" strokeWidth={2} />
                        </button>
                        <button
                          onClick={cancelEditTitle}
                          className="p-1.5 rounded hover:bg-stone-100 text-gray-400"
                          aria-label="Cancel"
                        >
                          <X className="w-4 h-4" strokeWidth={2} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => canEditTitle && startEditTitle(m)}
                        disabled={!canEditTitle}
                        className={`inline-flex items-center gap-1.5 text-sm ${
                          m.title ? 'text-gray-700' : 'text-gray-400 italic'
                        } ${canEditTitle ? 'hover:text-sage-700 cursor-pointer' : 'cursor-default'}`}
                      >
                        {m.title ?? 'Add title…'}
                        {canEditTitle && <Pencil className="w-3 h-3 opacity-60" strokeWidth={1.75} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Admin actions (only shown to admins, on other members) */}
                {isAdmin && !isSelf && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => changeRole(m.user_id, m.role === 'admin' ? 'editor' : 'admin')}
                      className="p-1.5 text-gray-400 hover:text-sage-700 rounded hover:bg-sage-50"
                      title={`Make ${m.role === 'admin' ? 'editor' : 'admin'}`}
                    >
                      <UserCog className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                    <button
                      onClick={() => removeMember(m.user_id, displayName)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                      title="Remove from org"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
