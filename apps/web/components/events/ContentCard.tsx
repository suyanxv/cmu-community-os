'use client'

import { useState } from 'react'
import { RotateCw, Check, Copy } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface ContentCardProps {
  contentId: string
  eventId: string
  channel: string
  subjectLine: string | null
  body: string
  characterCount: number | null
  version: number
  onRegenerate: (channel: string) => Promise<void>
}

const CHANNEL_LABELS: Record<string, { label: string; icon: string; limit: number | null }> = {
  whatsapp:  { label: 'WhatsApp',  icon: '💬', limit: 1024 },
  email:     { label: 'Email',     icon: '📧', limit: null },
  instagram: { label: 'Instagram', icon: '📸', limit: 2200 },
  linkedin:  { label: 'LinkedIn',  icon: '💼', limit: 3000 },
  luma:      { label: 'Luma',      icon: '🗓️', limit: 500 },
}

export default function ContentCard({ contentId, eventId, channel, subjectLine, body, characterCount, version, onRegenerate }: ContentCardProps) {
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const toast = useToast()

  const info = CHANNEL_LABELS[channel] ?? { label: channel, icon: '📄', limit: null }

  const copyText = subjectLine ? `Subject: ${subjectLine}\n\n${body}` : body

  const handleCopy = async () => {
    await navigator.clipboard.writeText(copyText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success(`${info.label} content copied to clipboard`)

    // Track copy
    await fetch(`/api/events/${eventId}/content`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentId }),
    }).catch(() => {})
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    await onRegenerate(channel)
    setRegenerating(false)
  }

  const isOverLimit = !!(info.limit && characterCount && characterCount > info.limit)
  const pct = info.limit && characterCount !== null ? (characterCount / info.limit) : null
  const charColor =
    pct === null ? 'text-gray-400'
    : pct >= 1    ? 'text-red-600 font-medium'
    : pct >= 0.9  ? 'text-red-500'
    : pct >= 0.75 ? 'text-butter-700'
    : 'text-sage-700'

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-stone-50">
        <div className="flex items-center gap-2">
          <span>{info.icon}</span>
          <span className="font-medium text-gray-900 text-sm">{info.label}</span>
          <span className="text-xs text-gray-400">v{version}</span>
        </div>
        <div className="flex items-center gap-2">
          {characterCount !== null && (
            <span className={`text-xs ${charColor}`} title={isOverLimit ? 'Over recommended limit' : ''}>
              {characterCount.toLocaleString()}{info.limit ? `/${info.limit}` : ''} chars
            </span>
          )}
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50"
            title="Regenerate"
          >
            <RotateCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} strokeWidth={1.75} />
            <span className="hidden sm:inline">{regenerating ? 'Regenerating…' : 'Regenerate'}</span>
          </button>
          <button
            onClick={handleCopy}
            className={`inline-flex items-center gap-1 text-xs px-3 py-1 rounded font-medium transition-colors ${
              copied
                ? 'bg-sage-100 text-sage-700'
                : 'bg-sage-600 text-white hover:bg-sage-700'
            }`}
          >
            {copied ? (
              <><Check className="w-3.5 h-3.5" strokeWidth={2} /> Copied</>
            ) : (
              <><Copy className="w-3.5 h-3.5" strokeWidth={1.75} /> Copy</>
            )}
          </button>
        </div>
      </div>

      <div className="p-5">
        {subjectLine && (
          <div className="mb-3 pb-3 border-b border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Subject Line</p>
            <p className="text-sm font-medium text-gray-900">{subjectLine}</p>
          </div>
        )}
        <pre className="text-sm text-gray-700 whitespace-pre-wrap break-words font-sans leading-relaxed">{body}</pre>
      </div>
    </div>
  )
}
