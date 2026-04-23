'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lightbulb, Plus, Sparkles, Archive, Trash2, ArrowUpRight, Check, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

type Status = 'open' | 'planning' | 'promoted' | 'archived'

interface Idea {
  id: string
  title: string
  notes: string | null
  target_season: string | null
  tags: string[] | null
  status: Status
  converted_event_id: string | null
  event_id: string | null
  event_name: string | null
  event_status: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

type FilterTab = 'active' | 'promoted' | 'archived' | 'all'

const STATUS_LABEL: Record<Status, string> = {
  open: 'Open',
  planning: 'Planning',
  promoted: 'Promoted',
  archived: 'Archived',
}

const STATUS_STYLE: Record<Status, string> = {
  open: 'bg-sage-50 text-sage-700 border-sage-200',
  planning: 'bg-butter-50 text-butter-700 border-butter-200',
  promoted: 'bg-lavender-50 text-lavender-700 border-lavender-200',
  archived: 'bg-stone-100 text-stone-500 border-stone-200',
}

export default function IdeasBoard({ initialIdeas }: { initialIdeas: Idea[] }) {
  const router = useRouter()
  const toast = useToast()
  const [ideas, setIdeas] = useState<Idea[]>(initialIdeas)
  const [tab, setTab] = useState<FilterTab>('active')
  const [addingOpen, setAddingOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [newSeason, setNewSeason] = useState('')
  const [creating, setCreating] = useState(false)

  const visible = useMemo(() => {
    return ideas.filter((i) => {
      if (tab === 'all') return true
      if (tab === 'active') return i.status === 'open' || i.status === 'planning'
      if (tab === 'promoted') return i.status === 'promoted'
      return i.status === 'archived'
    })
  }, [ideas, tab])

  const counts = useMemo(() => ({
    active: ideas.filter((i) => i.status === 'open' || i.status === 'planning').length,
    promoted: ideas.filter((i) => i.status === 'promoted').length,
    archived: ideas.filter((i) => i.status === 'archived').length,
    all: ideas.length,
  }), [ideas])

  const createIdea = async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    const res = await fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle.trim(),
        notes: newNotes.trim() || null,
        target_season: newSeason.trim() || null,
      }),
    })
    setCreating(false)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Failed to add idea' }))
      toast.error(error ?? 'Failed to add idea')
      return
    }
    const { data } = await res.json()
    setIdeas((prev) => [{ ...data, event_id: null, event_name: null, event_status: null, created_by_name: null, tags: data.tags ?? [] } as Idea, ...prev])
    setNewTitle(''); setNewNotes(''); setNewSeason(''); setAddingOpen(false)
    toast.success('Idea added')
  }

  const updateIdea = async (id: string, patch: Partial<Idea>) => {
    const res = await fetch(`/api/ideas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      toast.error('Failed to update idea')
      return false
    }
    const { data } = await res.json()
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...data } : i)))
    return true
  }

  const deleteIdea = async (id: string) => {
    if (!confirm('Delete this idea? This cannot be undone.')) return
    const res = await fetch(`/api/ideas/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Failed to delete'); return }
    setIdeas((prev) => prev.filter((i) => i.id !== id))
    toast.success('Idea deleted')
  }

  const promoteIdea = async (id: string) => {
    const res = await fetch(`/api/ideas/${id}/promote`, { method: 'POST' })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Failed to promote' }))
      toast.error(error ?? 'Failed to promote')
      return
    }
    const { data } = await res.json()
    toast.success('Event created as draft')
    router.push(`/events/${data.event_id}/edit`)
  }

  const TABS: { id: FilterTab; label: string; count: number }[] = [
    { id: 'active',   label: 'Active',   count: counts.active },
    { id: 'promoted', label: 'Promoted', count: counts.promoted },
    { id: 'archived', label: 'Archived', count: counts.archived },
    { id: 'all',      label: 'All',      count: counts.all },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-6 h-6 text-sage-600" strokeWidth={1.75} />
          <h1 className="text-2xl font-bold text-gray-900">Ideas</h1>
        </div>
        <button
          onClick={() => setAddingOpen(true)}
          className="inline-flex items-center gap-1.5 bg-sage-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sage-700"
        >
          <Plus className="w-4 h-4" strokeWidth={1.75} /> New idea
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-5 max-w-2xl">
        A backlog for events you want to run someday. Capture the title plus whatever context matters (venue leads, contacts, seasonality). Promote an idea to a draft event when you&apos;re ready to commit.
      </p>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg w-fit mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
              tab === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label} <span className="text-gray-400">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Add form */}
      {addingOpen && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wide font-medium text-gray-500 block mb-1">Title</label>
            <input
              autoFocus
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Hiking in Spring, Yoga event"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide font-medium text-gray-500 block mb-1">Notes</label>
            <textarea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              rows={3}
              placeholder="Venue leads, contacts, anything that saves you time later"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-sans"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide font-medium text-gray-500 block mb-1">Target season (optional)</label>
            <input
              type="text"
              value={newSeason}
              onChange={(e) => setNewSeason(e.target.value)}
              placeholder="e.g. Spring 2026, May/June"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => { setAddingOpen(false); setNewTitle(''); setNewNotes(''); setNewSeason('') }} className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1.5">Cancel</button>
            <button
              onClick={createIdea}
              disabled={creating || !newTitle.trim()}
              className="bg-sage-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-sage-700 disabled:opacity-50"
            >
              {creating ? 'Adding…' : 'Add idea'}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {ideas.length === 0 && !addingOpen ? (
        <div className="text-center py-20 bg-white border border-gray-200 rounded-xl">
          <p className="text-4xl mb-3">💡</p>
          <p className="text-lg font-medium text-gray-900">No ideas yet</p>
          <p className="text-gray-500 mt-1 mb-6 max-w-md mx-auto px-4">
            Drop in the events you&apos;re thinking about running, even half-formed. Board members can add context over time, then promote one when it&apos;s ready.
          </p>
          <button
            onClick={() => setAddingOpen(true)}
            className="bg-sage-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-sage-700 inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} /> Add your first idea
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <p className="text-gray-500 text-sm">
            No {tab === 'all' ? '' : tab} ideas
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visible.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onUpdate={updateIdea}
              onDelete={deleteIdea}
              onPromote={promoteIdea}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function IdeaCard({
  idea,
  onUpdate,
  onDelete,
  onPromote,
}: {
  idea: Idea
  onUpdate: (id: string, patch: Partial<Idea>) => Promise<boolean>
  onDelete: (id: string) => void | Promise<void>
  onPromote: (id: string) => void | Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(idea.title)
  const [notes, setNotes] = useState(idea.notes ?? '')
  const [season, setSeason] = useState(idea.target_season ?? '')
  const [saving, setSaving] = useState(false)
  const [promoting, setPromoting] = useState(false)

  const save = async () => {
    if (!title.trim()) return
    setSaving(true)
    const ok = await onUpdate(idea.id, {
      title: title.trim(),
      notes: notes.trim() || null,
      target_season: season.trim() || null,
    })
    setSaving(false)
    if (ok) setEditing(false)
  }

  const cancelEdit = () => {
    setTitle(idea.title)
    setNotes(idea.notes ?? '')
    setSeason(idea.target_season ?? '')
    setEditing(false)
  }

  const setStatus = async (next: Status) => {
    await onUpdate(idea.id, { status: next })
  }

  const doPromote = async () => {
    setPromoting(true)
    await onPromote(idea.id)
    setPromoting(false)
  }

  const isArchived = idea.status === 'archived'
  const isPromoted = idea.status === 'promoted'

  if (editing) {
    return (
      <div className="bg-white border border-sage-400 rounded-xl p-4 space-y-2 ring-2 ring-sage-100">
        <input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Notes, contacts, venue leads"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          placeholder="Target season (optional)"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <div className="flex items-center justify-end gap-1">
          <button onClick={cancelEdit} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 inline-flex items-center gap-1">
            <X className="w-3.5 h-3.5" strokeWidth={1.75} /> Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !title.trim()}
            className="text-xs bg-sage-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-sage-700 disabled:opacity-50 inline-flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white border rounded-xl p-4 transition-all ${isArchived ? 'opacity-60' : ''} ${STATUS_STYLE[idea.status].split(' ').filter((c) => c.startsWith('border-')).join(' ') || 'border-gray-200'} hover:shadow-sm`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <button onClick={() => setEditing(true)} className="text-left flex-1 min-w-0 group">
          <h3 className="font-semibold text-gray-900 group-hover:text-sage-700 break-words">{idea.title}</h3>
        </button>
        <span className={`shrink-0 text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[idea.status]}`}>
          {STATUS_LABEL[idea.status]}
        </span>
      </div>

      {idea.notes && (
        <button onClick={() => setEditing(true)} className="block w-full text-left text-sm text-gray-600 whitespace-pre-wrap break-words mb-2 hover:text-gray-800">
          {idea.notes}
        </button>
      )}

      {idea.target_season && (
        <p className="text-xs text-gray-500 mb-2">
          <span className="text-gray-400">Target:</span> {idea.target_season}
        </p>
      )}

      {isPromoted && idea.event_id && (
        <Link
          href={`/events/${idea.event_id}`}
          className="text-xs text-lavender-700 hover:text-lavender-800 inline-flex items-center gap-1 mb-2"
        >
          <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.75} />
          {idea.event_name ?? 'View event'}
          {idea.event_status && <span className="text-gray-400">· {idea.event_status}</span>}
        </Link>
      )}

      <div className="flex items-center justify-between gap-1 pt-2 border-t border-gray-100 flex-wrap">
        <div className="flex items-center gap-1">
          {!isPromoted && !isArchived && (
            <button
              onClick={doPromote}
              disabled={promoting}
              className="text-xs bg-sage-600 text-white px-2.5 py-1 rounded-md font-medium hover:bg-sage-700 disabled:opacity-50 inline-flex items-center gap-1"
              title="Create a draft event from this idea"
            >
              <Sparkles className="w-3 h-3" strokeWidth={1.75} />
              {promoting ? '…' : 'Create event'}
            </button>
          )}
          {idea.status === 'open' && (
            <button
              onClick={() => setStatus('planning')}
              className="text-xs text-butter-700 bg-butter-50 border border-butter-200 px-2.5 py-1 rounded-md font-medium hover:bg-butter-100"
              title="Mark as actively planning"
            >
              Start planning
            </button>
          )}
          {idea.status === 'planning' && (
            <button
              onClick={() => setStatus('open')}
              className="text-xs text-sage-700 bg-sage-50 border border-sage-200 px-2.5 py-1 rounded-md font-medium hover:bg-sage-100"
              title="Move back to open"
            >
              Back to open
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isArchived ? (
            <button
              onClick={() => setStatus('archived')}
              className="text-xs text-gray-500 hover:text-gray-700 p-1 inline-flex items-center gap-1"
              title="Archive"
            >
              <Archive className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          ) : (
            <button
              onClick={() => setStatus('open')}
              className="text-xs text-gray-500 hover:text-gray-700 p-1"
              title="Un-archive"
            >
              Restore
            </button>
          )}
          <button
            onClick={() => onDelete(idea.id)}
            className="text-xs text-gray-400 hover:text-red-500 p-1"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  )
}
