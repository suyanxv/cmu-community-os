'use client'

import { useState } from 'react'

export default function ShareEventButton({ eventId }: { eventId: string }) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = `${window.location.origin}/events/${eventId}`

    // Try the native share sheet first (mobile / modern browsers)
    if (navigator.share) {
      try {
        await navigator.share({ url, title: 'Quorum Event' })
        return
      } catch {
        // User cancelled or error — fall through to clipboard
      }
    }

    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleShare}
      className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50"
      title="Copy event link"
    >
      {copied ? '✓ Link copied' : '🔗 Share'}
    </button>
  )
}
