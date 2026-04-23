'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'

export default function ShareEventButton({ eventId }: { eventId: string }) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = `${window.location.origin}/events/${eventId}`

    if (navigator.share) {
      try {
        await navigator.share({ url, title: 'Quorum Event' })
        return
      } catch {
        // User cancelled or share failed, fall through to clipboard
      }
    }

    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50"
      title="Copy event link"
    >
      {copied ? (
        <><Check className="w-4 h-4 text-sage-600" strokeWidth={2} /> Link copied</>
      ) : (
        <><Share2 className="w-4 h-4" strokeWidth={1.75} /> Share</>
      )}
    </button>
  )
}
