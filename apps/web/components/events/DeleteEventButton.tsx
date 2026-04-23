'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteEventButton({ eventId, eventName }: { eventId: string; eventName: string }) {
  const router = useRouter()
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
    router.push('/events')
    router.refresh()
  }

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
          <h3 className="text-lg font-semibold text-gray-900">Delete event?</h3>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-medium">{eventName}</span> will be permanently removed, along with all RSVPs, generated content, and reminders linked to it. This cannot be undone.
          </p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  )
}
