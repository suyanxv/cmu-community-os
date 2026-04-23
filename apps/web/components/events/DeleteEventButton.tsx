'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

// Delete is only offered for drafts (never-published events) and already-
// cancelled events (after cancel, admin can purge records). Published / past
// events should be cancelled instead, to preserve the audit trail for people
// who RSVP'd or received announcements. The parent page gates when to render
// this at all — this component's role is just the button + confirm dialog.
export default function DeleteEventButton({
  eventId,
  eventName,
  status,
}: {
  eventId: string
  eventName: string
  status: string
}) {
  const router = useRouter()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to delete')
      setDeleting(false)
      return
    }
    toast.success(`"${eventName}" deleted`)
    router.push('/events')
    router.refresh()
  }

  // Wording shifts based on what's being purged. For a draft, nothing was
  // ever external; for a cancelled event, RSVPs + content may exist.
  const isDraft = status === 'draft'

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
      >
        Delete
      </button>
    )
  }

  return (
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50 disabled:opacity-50"
          >
            Keep event
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : isDraft ? 'Delete draft' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  )
}
