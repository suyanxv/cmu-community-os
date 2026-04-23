'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Megaphone, Mail, MessageCircle, ExternalLink, Send, X, Sparkles, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

type Channel = 'email' | 'whatsapp'
type Kind = 'announcement' | 'reminder' | 'thank_you' | 'custom'
type AudienceType = 'confirmed_rsvps' | 'all_rsvps' | 'partners' | 'individual' | 'custom_list'

interface Broadcast {
  id: string
  channel: Channel
  kind: Kind
  subject: string | null
  body: string
  audience_type: AudienceType
  recipient_count: number
  success_count: number
  failure_count: number
  status: 'draft' | 'sending' | 'sent' | 'failed'
  sent_at: string | null
  sent_by_name?: string | null
  created_at: string
}

interface GeneratedContent {
  channel: string
  subject_line: string | null
  body: string
}

interface Props {
  eventId: string
  eventName: string
}

const KIND_LABELS: Record<Kind, string> = {
  announcement: 'Announcement',
  reminder: 'Reminder',
  thank_you: 'Thank-you',
  custom: 'Custom',
}

const AUDIENCE_LABELS: Record<AudienceType, string> = {
  confirmed_rsvps: 'Confirmed RSVPs',
  all_rsvps: 'All RSVPs',
  partners: 'Partners on this event',
  individual: 'Individual recipient',
  custom_list: 'Custom list',
}

export default function BroadcastsSection({ eventId, eventName }: Props) {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [generated, setGenerated] = useState<GeneratedContent[]>([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState<Channel | null>(null)

  const toast = useToast()

  const fetchBroadcasts = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/broadcasts`)
    if (res.ok) {
      const { data } = await res.json()
      setBroadcasts(data)
    }
    setLoading(false)
  }, [eventId])

  const fetchContent = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/content`)
    if (res.ok) {
      const { data } = await res.json()
      setGenerated(data)
    }
  }, [eventId])

  useEffect(() => {
    fetchBroadcasts()
    fetchContent()
  }, [fetchBroadcasts, fetchContent])

  const handleSent = async () => {
    setComposing(null)
    await fetchBroadcasts()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this broadcast from history? Messages already sent cannot be recalled.')) return
    const res = await fetch(`/api/broadcasts/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Broadcast removed from history')
      await fetchBroadcasts()
    } else {
      toast.error('Failed to remove broadcast')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mt-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-sage-600" strokeWidth={1.75} />
          <h2 className="text-base font-semibold text-gray-900">Broadcasts</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setComposing('whatsapp')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-stone-50"
          >
            <MessageCircle className="w-4 h-4 text-sage-600" strokeWidth={1.75} />
            WhatsApp
          </button>
          <button
            onClick={() => setComposing('email')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700"
          >
            <Mail className="w-4 h-4" strokeWidth={1.75} />
            Email
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : broadcasts.length === 0 ? (
        <p className="text-sm text-gray-500">
          No broadcasts sent yet. Use the buttons above to send an email blast or draft a WhatsApp post.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {broadcasts.map((b) => (
            <BroadcastRow key={b.id} b={b} onDelete={() => handleDelete(b.id)} />
          ))}
        </ul>
      )}

      {composing && (
        <ComposeModal
          channel={composing}
          eventId={eventId}
          eventName={eventName}
          generated={generated}
          onClose={() => setComposing(null)}
          onSent={handleSent}
        />
      )}
    </div>
  )
}

function BroadcastRow({ b, onDelete }: { b: Broadcast; onDelete: () => void }) {
  const sentAt = b.sent_at ? new Date(b.sent_at) : new Date(b.created_at)
  const icon = b.channel === 'email' ? <Mail className="w-4 h-4 text-sage-600" strokeWidth={1.75} /> : <MessageCircle className="w-4 h-4 text-sage-600" strokeWidth={1.75} />

  return (
    <li className="py-3 flex items-start justify-between gap-3">
      <div className="flex gap-3 items-start min-w-0 flex-1">
        <div className="mt-0.5">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900">{KIND_LABELS[b.kind]}</span>
            <span className="text-xs text-gray-400">· {b.channel === 'email' ? 'Email' : 'WhatsApp'}</span>
            {b.status === 'failed' && (
              <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">Failed</span>
            )}
            {b.status === 'sending' && (
              <span className="text-xs bg-butter-100 text-butter-700 px-2 py-0.5 rounded-full">Sending…</span>
            )}
          </div>
          {b.subject && <p className="text-sm text-gray-700 mt-0.5 truncate">{b.subject}</p>}
          <p className="text-xs text-gray-500 mt-1">
            {b.channel === 'email' ? (
              <>
                {b.success_count}/{b.recipient_count} delivered
                {b.failure_count > 0 && <span className="text-red-500"> · {b.failure_count} failed</span>}
                {' · '}{AUDIENCE_LABELS[b.audience_type]}
              </>
            ) : (
              <>Drafted for {AUDIENCE_LABELS[b.audience_type]}</>
            )}
            {' · '}{sentAt.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            {b.sent_by_name && <> · {b.sent_by_name}</>}
          </p>
        </div>
      </div>
      <button onClick={onDelete} className="text-gray-400 hover:text-red-500 p-1" title="Remove from history">
        <Trash2 className="w-4 h-4" strokeWidth={1.75} />
      </button>
    </li>
  )
}

// ----------- Compose modal -----------

function ComposeModal({
  channel,
  eventId,
  eventName,
  generated,
  onClose,
  onSent,
}: {
  channel: Channel
  eventId: string
  eventName: string
  generated: GeneratedContent[]
  onClose: () => void
  onSent: () => void | Promise<void>
}) {
  const toast = useToast()
  const [kind, setKind] = useState<Kind>('announcement')
  const [audienceType, setAudienceType] = useState<AudienceType>('confirmed_rsvps')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [fromName, setFromName] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [sending, setSending] = useState(false)
  const [audience, setAudience] = useState<{ count: number; sample: Array<{ email?: string; name: string | null }> } | null>(null)

  const sourceChannel = channel === 'email' ? 'email' : 'whatsapp'
  const sourceContent = useMemo(
    () => generated.find((g) => g.channel === sourceChannel) ?? null,
    [generated, sourceChannel]
  )

  // Pre-fill from generated content once when available.
  useEffect(() => {
    if (!sourceContent) return
    if (!body) setBody(sourceContent.body)
    if (channel === 'email' && !subject && sourceContent.subject_line) {
      setSubject(sourceContent.subject_line)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceContent])

  // Default subject suggestions by kind (email only).
  useEffect(() => {
    if (channel !== 'email') return
    if (subject) return
    const suggested: Record<Kind, string> = {
      announcement: `You're invited: ${eventName}`,
      reminder: `Reminder: ${eventName}`,
      thank_you: `Thanks for joining ${eventName}`,
      custom: '',
    }
    setSubject(suggested[kind])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  // Load audience preview.
  useEffect(() => {
    if (channel !== 'email') {
      setAudience(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const res = await fetch(`/api/events/${eventId}/broadcasts?preview=1&audience_type=${audienceType}`)
      if (!res.ok || cancelled) return
      const { data } = await res.json()
      if (!cancelled) setAudience(data)
    })()
    return () => { cancelled = true }
  }, [channel, eventId, audienceType])

  const handleSendEmail = async () => {
    if (!subject.trim()) {
      toast.error('Subject is required')
      return
    }
    if (!body.trim()) {
      toast.error('Message body is required')
      return
    }
    if (!audience || audience.count === 0) {
      toast.error('No recipients found for this audience')
      return
    }
    if (!confirm(`Send to ${audience.count} recipient${audience.count === 1 ? '' : 's'}? This cannot be undone.`)) return

    setSending(true)
    const res = await fetch(`/api/events/${eventId}/broadcasts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'email',
        kind,
        subject,
        body,
        audience_type: audienceType,
        from_name: fromName || null,
        reply_to: replyTo || null,
      }),
    })
    setSending(false)
    if (res.ok) {
      const { data } = await res.json()
      if (data.failure_count > 0) {
        toast.error(`Sent to ${data.success_count} of ${data.recipient_count}. ${data.failure_count} failed.`)
      } else {
        toast.success(`Email sent to ${data.success_count} recipient${data.success_count === 1 ? '' : 's'}`)
      }
      await onSent()
    } else {
      const { error } = await res.json().catch(() => ({ error: 'Send failed' }))
      toast.error(error ?? 'Send failed')
    }
  }

  const handleSendWhatsApp = async () => {
    if (!body.trim()) {
      toast.error('Message body is required')
      return
    }
    // Open WhatsApp with the message pre-filled, then record the broadcast.
    const link = `https://wa.me/?text=${encodeURIComponent(body)}`
    window.open(link, '_blank', 'noopener')
    setSending(true)
    const res = await fetch(`/api/events/${eventId}/broadcasts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'whatsapp',
        kind,
        body,
        audience_type: audienceType,
      }),
    })
    setSending(false)
    if (res.ok) {
      toast.success('WhatsApp opened. Pick your community group, paste and send.')
      await onSent()
    } else {
      toast.error('Failed to record broadcast')
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(body)
    toast.success('Message copied')
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {channel === 'email' ? (
              <Mail className="w-5 h-5 text-sage-600" strokeWidth={1.75} />
            ) : (
              <MessageCircle className="w-5 h-5 text-sage-600" strokeWidth={1.75} />
            )}
            <h3 className="text-base font-semibold text-gray-900">
              {channel === 'email' ? 'Send email' : 'Send via WhatsApp'}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" strokeWidth={1.75} /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {/* Kind */}
          <div>
            <label className="text-xs uppercase tracking-wide font-medium text-gray-500 block mb-1.5">Type</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    kind === k ? 'border-sage-500 bg-sage-50 text-sage-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {KIND_LABELS[k]}
                </button>
              ))}
            </div>
          </div>

          {/* Audience — for WhatsApp, just a note */}
          {channel === 'email' ? (
            <div>
              <label className="text-xs uppercase tracking-wide font-medium text-gray-500 block mb-1.5">Audience</label>
              <select
                value={audienceType}
                onChange={(e) => setAudienceType(e.target.value as AudienceType)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="confirmed_rsvps">Confirmed RSVPs</option>
                <option value="all_rsvps">All RSVPs (incl. waitlist, cancelled)</option>
                <option value="partners">Partners on this event</option>
              </select>
              {audience && (
                <p className="text-xs text-gray-500 mt-1.5">
                  {audience.count === 0
                    ? 'No recipients with email addresses for this audience.'
                    : `${audience.count} recipient${audience.count === 1 ? '' : 's'}`}
                  {audience.sample.length > 0 && (
                    <> · {audience.sample.slice(0, 3).map((s) => s.name ?? s.email).filter(Boolean).join(', ')}{audience.count > 3 ? ` +${audience.count - 3} more` : ''}</>
                  )}
                </p>
              )}
            </div>
          ) : (
            <div className="bg-sage-50 border border-sage-200 rounded-lg p-3 text-sm text-sage-800">
              <p className="font-medium flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" strokeWidth={1.75} /> How this works
              </p>
              <p className="text-sage-700 mt-1 text-xs leading-relaxed">
                Quorum drafts your message. When you hit Send, WhatsApp opens with the text pre-filled. Pick your community or group, paste and send from your own account. It stays authentic because it IS from you.
              </p>
            </div>
          )}

          {/* Subject (email only) */}
          {channel === 'email' && (
            <div>
              <label className="text-xs uppercase tracking-wide font-medium text-gray-500 block mb-1.5">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Subject line"
              />
            </div>
          )}

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs uppercase tracking-wide font-medium text-gray-500">Message</label>
              {sourceContent && (
                <button
                  type="button"
                  onClick={() => {
                    setBody(sourceContent.body)
                    if (channel === 'email' && sourceContent.subject_line) setSubject(sourceContent.subject_line)
                  }}
                  className="text-xs text-sage-600 hover:text-sage-700 inline-flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" strokeWidth={1.75} /> Load generated
                </button>
              )}
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-sans"
              placeholder={channel === 'email' ? 'Your message…\n\nTip: use {{name}} to personalize per recipient.' : 'Your message…'}
            />
            <p className="text-xs text-gray-400 mt-1">
              {channel === 'email'
                ? 'Plain text is safe across all email clients. Use {{name}} to personalize.'
                : `${body.length} chars · WhatsApp limit 1,024 for groups`}
            </p>
          </div>

          {/* Sender fields (email only) */}
          {channel === 'email' && (
            <details className="border border-gray-200 rounded-lg">
              <summary className="px-3 py-2 text-sm text-gray-700 cursor-pointer hover:bg-stone-50 rounded-lg">Sender options</summary>
              <div className="p-3 space-y-3 border-t border-gray-100">
                <div>
                  <label className="text-xs uppercase tracking-wide font-medium text-gray-500 block mb-1">From name</label>
                  <input
                    type="text"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Defaults to org name"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide font-medium text-gray-500 block mb-1">Reply-to email</label>
                  <input
                    type="email"
                    value={replyTo}
                    onChange={(e) => setReplyTo(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Replies go here"
                  />
                </div>
              </div>
            </details>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Copy message
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            {channel === 'email' ? (
              <button
                onClick={handleSendEmail}
                disabled={sending || !audience?.count}
                className="inline-flex items-center gap-1.5 bg-sage-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sage-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4" strokeWidth={1.75} />
                {sending ? 'Sending…' : `Send${audience?.count ? ` to ${audience.count}` : ''}`}
              </button>
            ) : (
              <button
                onClick={handleSendWhatsApp}
                disabled={sending}
                className="inline-flex items-center gap-1.5 bg-sage-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sage-700 disabled:opacity-50"
              >
                <ExternalLink className="w-4 h-4" strokeWidth={1.75} />
                {sending ? 'Opening…' : 'Open WhatsApp'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
