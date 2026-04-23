'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

type Status = 'draft' | 'published' | 'past' | 'cancelled'

const STATUS_LABEL: Record<Status, string> = {
  draft: 'Draft',
  published: 'Published',
  past: 'Past',
  cancelled: 'Cancelled',
}

const STATUS_STYLE: Record<Status, string> = {
  draft: 'bg-butter-100 text-butter-700',
  published: 'bg-green-100 text-green-700',
  past: 'bg-stone-200 text-stone-600',
  cancelled: 'bg-red-100 text-red-700 line-through',
}

export default function EventStatusControl({ eventId, initialStatus }: { eventId: string; initialStatus: string }) {
  const router = useRouter()
  const toast = useToast()
  const [status, setStatus] = useState<Status>((initialStatus as Status) ?? 'draft')
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)

  const update = async (next: Status) => {
    if (next === status) { setOpen(false); return }
    setSaving(true)
    setOpen(false)
    const res = await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to update status')
      return
    }
    setStatus(next)
    toast.success(
      next === 'published' ? 'Event published' :
      next === 'draft'     ? 'Moved to draft' :
      next === 'cancelled' ? 'Event cancelled' :
      'Marked as past'
    )
    router.refresh()
  }

  // Quick "Publish" button if current is draft — fast-path for the most common action
  if (status === 'draft' && !open) {
    return (
      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLE.draft}`}>Draft</span>
        <button
          onClick={() => update('published')}
          disabled={saving}
          className="px-3 py-1 text-xs font-medium text-white bg-sage-600 rounded-full hover:bg-sage-700 disabled:opacity-50"
        >
          {saving ? '…' : '✓ Publish'}
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        className={`text-xs px-2 py-1 rounded-full font-medium inline-flex items-center gap-1 ${STATUS_STYLE[status]} hover:brightness-95 disabled:opacity-50`}
      >
        {saving ? '…' : STATUS_LABEL[status]}
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
          {(['draft', 'published', 'past', 'cancelled'] as Status[]).map((s) => (
            <button
              key={s}
              onClick={() => update(s)}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-stone-50 ${s === status ? 'font-medium text-gray-900' : 'text-gray-600'}`}
            >
              {STATUS_LABEL[s]} {s === status && '✓'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
