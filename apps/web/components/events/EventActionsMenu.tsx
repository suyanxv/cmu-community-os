'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Ban, Check, ChevronDown, Copy, Pencil, Share2, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface EventActionsMenuProps {
  eventId: string
  eventName: string
  status: string
}

// Consolidates Edit / Duplicate / Share / Cancel / Delete into one dropdown
// so the action bar stays uncluttered. Click-to-open (hover menus don't work
// on touch devices). The destructive action sits last, behind a divider.
export default function EventActionsMenu({ eventId, eventName, status }: EventActionsMenuProps) {
  const router = useRouter()
  const toast = useToast()
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState<'delete' | 'cancel' | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleDuplicate = async () => {
    setWorking(true)
    const res = await fetch(`/api/events/${eventId}/duplicate`, { method: 'POST' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to duplicate event')
      setWorking(false)
      return
    }
    const { data } = await res.json()
    toast.success(`Created "${data.name}" — adjust the details and save`)
    router.push(`/events/${data.id}/edit`)
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/events/${eventId}`
    if (navigator.share) {
      try {
        await navigator.share({ url, title: eventName })
        setOpen(false)
        return
      } catch {
        // User cancelled or share failed, fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => { setCopied(false); setOpen(false) }, 1200)
  }

  const handleDelete = async () => {
    setConfirmBusy(true)
    setConfirmError(null)
    const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setConfirmError(data.error ?? 'Failed to delete')
      setConfirmBusy(false)
      return
    }
    toast.success(`"${eventName}" deleted`)
    router.push('/events')
    router.refresh()
  }

  const handleCancel = async () => {
    setConfirmBusy(true)
    setConfirmError(null)
    const res = await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setConfirmError(data.error ?? 'Failed to cancel')
      setConfirmBusy(false)
      return
    }
    toast.success(`"${eventName}" cancelled`)
    setConfirming(null)
    setConfirmBusy(false)
    router.refresh()
  }

  // Draft → Delete (never published, nothing lost).
  // Published / Past → Cancel (preserve audit trail).
  // Cancelled → Delete (already communicated; admin can now purge).
  // Archived → no destructive action surfaced here.
  const destructive = status === 'draft' || status === 'cancelled'
    ? 'delete'
    : status === 'published' || status === 'past'
      ? 'cancel'
      : null

  const itemClass = 'w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-left text-gray-700 hover:bg-stone-50 disabled:opacity-50'
  const isDraft = status === 'draft'

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50"
      >
        Actions <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={1.75} />
      </button>

      {open && (
        <div role="menu" className="absolute left-0 top-full mt-1 z-30 w-52 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 overflow-hidden">
          <Link href={`/events/${eventId}/edit`} role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            <Pencil className="w-4 h-4 text-gray-400" strokeWidth={1.75} /> Edit
          </Link>
          <button role="menuitem" onClick={handleDuplicate} disabled={working} className={itemClass}>
            <Copy className="w-4 h-4 text-gray-400" strokeWidth={1.75} /> {working ? 'Duplicating…' : 'Duplicate'}
          </button>
          <button role="menuitem" onClick={handleShare} className={itemClass}>
            {copied
              ? <><Check className="w-4 h-4 text-sage-600" strokeWidth={2} /> Link copied</>
              : <><Share2 className="w-4 h-4 text-gray-400" strokeWidth={1.75} /> Share</>}
          </button>
          {destructive && (
            <>
              <div className="my-1.5 border-t border-gray-100" />
              <button
                role="menuitem"
                onClick={() => { setOpen(false); setConfirming(destructive) }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-left text-red-600 hover:bg-red-50"
              >
                {destructive === 'delete'
                  ? <><Trash2 className="w-4 h-4" strokeWidth={1.75} /> Delete</>
                  : <><Ban className="w-4 h-4" strokeWidth={1.75} /> Cancel event</>}
              </button>
            </>
          )}
        </div>
      )}

      {confirming === 'delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {isDraft ? 'Delete draft?' : 'Delete event permanently?'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                <span className="font-medium">{eventName}</span>
                {isDraft
                  ? ' will be removed. Since it was never published, nothing was sent externally.'
                  : ' will be permanently removed, along with all RSVPs, generated content, and reminders linked to it. This cannot be undone.'}
              </p>
            </div>
            {confirmError && <p className="text-sm text-red-600">{confirmError}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirming(null)}
                disabled={confirmBusy}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50 disabled:opacity-50"
              >
                Keep event
              </button>
              <button
                onClick={handleDelete}
                disabled={confirmBusy}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {confirmBusy ? 'Deleting…' : isDraft ? 'Delete draft' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirming === 'cancel' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Cancel this event?</h3>
              <p className="text-sm text-gray-500 mt-1">
                <span className="font-medium">{eventName}</span> will be marked cancelled and shown struck-through on the calendar so no one shows up expecting it.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                RSVPs and history are preserved. Quorum doesn&apos;t automatically notify attendees &mdash; send a broadcast after cancelling if you need to tell people.
              </p>
            </div>
            {confirmError && <p className="text-sm text-red-600">{confirmError}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirming(null)}
                disabled={confirmBusy}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50 disabled:opacity-50"
              >
                Keep event
              </button>
              <button
                onClick={handleCancel}
                disabled={confirmBusy}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {confirmBusy ? 'Cancelling…' : 'Cancel event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
