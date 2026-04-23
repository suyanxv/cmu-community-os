'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DuplicateEventButton({ eventId }: { eventId: string }) {
  const router = useRouter()
  const [working, setWorking] = useState(false)

  const handleDuplicate = async () => {
    setWorking(true)
    const res = await fetch(`/api/events/${eventId}/duplicate`, { method: 'POST' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? 'Failed to duplicate event')
      setWorking(false)
      return
    }
    const { data } = await res.json()
    // Land on edit page so the user can adjust the date / name
    router.push(`/events/${data.id}/edit`)
  }

  return (
    <button
      onClick={handleDuplicate}
      disabled={working}
      className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50 disabled:opacity-50"
    >
      {working ? 'Duplicating…' : 'Duplicate'}
    </button>
  )
}
