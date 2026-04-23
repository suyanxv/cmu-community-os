'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import ContentCard from '@/components/events/ContentCard'

interface ContentRow {
  id: string
  channel: string
  subject_line: string | null
  body: string
  character_count: number | null
  version: number
}

const ALL_CHANNELS = ['whatsapp', 'email', 'instagram', 'linkedin', 'luma']

export default function ContentPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const [content, setContent] = useState<ContentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedChannels, setSelectedChannels] = useState<string[]>(ALL_CHANNELS)
  const [error, setError] = useState<string | null>(null)

  const fetchContent = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/content`)
    if (res.ok) {
      const { data } = await res.json()
      setContent(data)
    }
    setLoading(false)
  }, [eventId])

  useEffect(() => { fetchContent() }, [fetchContent])

  const generateContent = async (channels: string[]) => {
    setGenerating(true)
    setError(null)
    const res = await fetch(`/api/events/${eventId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Generation failed')
    } else {
      await fetchContent()
    }
    setGenerating(false)
  }

  const regenerateChannel = async (channel: string) => {
    await generateContent([channel])
  }

  const toggleChannel = (ch: string) => {
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    )
  }

  const CHANNEL_LABELS: Record<string, string> = {
    whatsapp: 'WhatsApp', email: 'Email', instagram: 'Instagram',
    linkedin: 'LinkedIn', luma: 'Luma',
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href={`/events/${eventId}`} className="text-sm text-gray-500 hover:text-gray-700 mb-2 block">
            ← Back to Event
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Generated Content</h1>
        </div>
      </div>

      {/* Generate controls */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Generate content for:</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {ALL_CHANNELS.map((ch) => (
            <label key={ch} className={`cursor-pointer px-3 py-1.5 rounded-full border text-sm font-medium ${selectedChannels.includes(ch) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              <input type="checkbox" checked={selectedChannels.includes(ch)} onChange={() => toggleChannel(ch)} className="sr-only" />
              {CHANNEL_LABELS[ch]}
            </label>
          ))}
        </div>
        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
        <button
          onClick={() => generateContent(selectedChannels)}
          disabled={generating || selectedChannels.length === 0}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {generating ? '⟳ Generating…' : content.length > 0 ? 'Regenerate Selected' : 'Generate Content'}
        </button>
      </div>

      {/* Content cards */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : content.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-4">✍️</p>
          <p className="text-gray-500">No content generated yet. Select channels above and click Generate.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {content.map((item) => (
            <ContentCard
              key={item.id}
              contentId={item.id}
              eventId={eventId}
              channel={item.channel}
              subjectLine={item.subject_line}
              body={item.body}
              characterCount={item.character_count}
              version={item.version}
              onRegenerate={regenerateChannel}
            />
          ))}
        </div>
      )}
    </div>
  )
}
