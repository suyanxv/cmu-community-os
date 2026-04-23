'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ban } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

// For published/past events that need to be called off. Unlike Delete, this
// preserves the event record — RSVPs stay linked, reminders stay logged, and
// the event appears struck-through on the calendar so anyone who saw it
// previously understands it's not happening.
export default function CancelEventButton({ eventId, eventName }: { eventId: string; eventName: string }) {
  const router = useRouter()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCancel = async () => {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to cancel')
      setSaving(false)
      return
    }
    toast.success(`"${eventName}" cancelled`)
    setConfirming(false)
    setSaving(false)
    router.refresh()
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
      >
        <Ban className="w-4 h-4" strokeWidth={1.75} />
        Cancel event
      </button>
    )
  }

  return (
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setConfirming(false)}
            disabled={saving}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50 disabled:opacity-50"
          >
            Keep event
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? 'Cancelling…' : 'Cancel event'}
          </button>
        </div>
      </div>
    </div>
  )
}
