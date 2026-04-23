'use client'

import { useEffect, useState } from 'react'
import { Share2, Copy, Check, RefreshCw, Trash2, ExternalLink, Mail } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface PublicContact {
  name: string | null
  email: string | null
}

export default function PublicShareSection() {
  const toast = useToast()
  const [token, setToken] = useState<string | null | undefined>(undefined) // undefined = loading
  const [enabling, setEnabling] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [disabling, setDisabling] = useState(false)
  const [copied, setCopied] = useState(false)

  // Public contact info (rendered in public page footers so viewers can reach out).
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [savedContact, setSavedContact] = useState<PublicContact | null>(null)
  const [savingContact, setSavingContact] = useState(false)

  useEffect(() => {
    // Org endpoint returns the full org record including public_share_token
    // and settings (where public_contact lives under settings.public_contact).
    fetch('/api/organizations')
      .then((r) => r.json())
      .then((d) => {
        setToken((d.data?.public_share_token as string) ?? null)
        const contact = (d.data?.settings?.public_contact ?? null) as PublicContact | null
        if (contact) {
          setContactName(contact.name ?? '')
          setContactEmail(contact.email ?? '')
          setSavedContact(contact)
        }
      })
      .catch(() => setToken(null))
  }, [])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const shareUrl = token ? `${origin}/c/${token}` : null

  const enable = async () => {
    setEnabling(true)
    const res = await fetch('/api/organizations/share-token', { method: 'POST' })
    setEnabling(false)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Failed to enable' }))
      toast.error(error ?? 'Failed to enable sharing')
      return
    }
    const { data } = await res.json()
    setToken(data.token)
    toast.success('Public sharing enabled')
  }

  const rotate = async () => {
    if (!confirm('Rotate the share link? Any already-distributed URLs will stop working.')) return
    setRotating(true)
    const res = await fetch('/api/organizations/share-token', { method: 'POST' })
    setRotating(false)
    if (!res.ok) { toast.error('Failed to rotate'); return }
    const { data } = await res.json()
    setToken(data.token)
    toast.success('Share link rotated — old links now invalid')
  }

  const disable = async () => {
    if (!confirm('Disable public sharing? The current URL will stop working for everyone.')) return
    setDisabling(true)
    const res = await fetch('/api/organizations/share-token', { method: 'DELETE' })
    setDisabling(false)
    if (!res.ok) { toast.error('Failed to disable'); return }
    setToken(null)
    toast.success('Public sharing disabled')
  }

  const copy = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copied to clipboard')
  }

  const saveContact = async () => {
    const name = contactName.trim()
    const email = contactEmail.trim()
    setSavingContact(true)
    const res = await fetch('/api/organizations/public-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || null, email: email || null }),
    })
    setSavingContact(false)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Failed to save contact' }))
      toast.error(error ?? 'Failed to save contact')
      return
    }
    const { data } = await res.json()
    setSavedContact(data)
    toast.success(data ? 'Contact saved' : 'Contact cleared')
  }

  const contactDirty =
    (contactName.trim() !== (savedContact?.name ?? '')) ||
    (contactEmail.trim() !== (savedContact?.email ?? ''))

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="bg-sage-50 p-2 rounded-lg shrink-0">
          <Share2 className="w-5 h-5 text-sage-600" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Public calendar</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            A read-only URL anyone can open — no login required. Useful for sharing your event calendar with board members in Slack, or linking from your website. Drafts and archived events stay private.
          </p>
        </div>
      </div>

      {token === undefined ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : token === null ? (
        <button
          onClick={enable}
          disabled={enabling}
          className="inline-flex items-center gap-1.5 bg-sage-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sage-700 disabled:opacity-50"
        >
          {enabling ? 'Enabling…' : 'Enable public sharing'}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="bg-stone-50 border border-gray-200 rounded-lg p-3 flex items-center gap-2">
            <code className="flex-1 min-w-0 text-xs text-gray-700 truncate font-mono">{shareUrl}</code>
            <a
              href={shareUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-700 p-1.5 rounded hover:bg-white"
              title="Open in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} />
            </a>
            <button
              onClick={copy}
              className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded font-medium transition-colors ${
                copied ? 'bg-sage-100 text-sage-700' : 'bg-sage-600 text-white hover:bg-sage-700'
              }`}
            >
              {copied ? <><Check className="w-3.5 h-3.5" strokeWidth={2} /> Copied</> : <><Copy className="w-3.5 h-3.5" strokeWidth={1.75} /> Copy</>}
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={rotate}
              disabled={rotating}
              className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-stone-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${rotating ? 'animate-spin' : ''}`} strokeWidth={1.75} />
              {rotating ? 'Rotating…' : 'Rotate link'}
            </button>
            <button
              onClick={disable}
              disabled={disabling}
              className="inline-flex items-center gap-1.5 text-xs text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              {disabling ? 'Disabling…' : 'Disable sharing'}
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Anyone with this link can view published events and click through to the RSVP link. They cannot see RSVPs, partner details, or internal notes.
          </p>

          {/* Contact shown on public pages */}
          <div className="pt-3 mt-3 border-t border-gray-100">
            <div className="flex items-center gap-1.5 mb-1">
              <Mail className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.75} />
              <p className="text-sm font-medium text-gray-700">Contact shown on public pages</p>
            </div>
            <p className="text-xs text-gray-400 mb-2">
              Rendered in the footer of the public calendar and event pages so viewers know who to reach out to. Both fields optional.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Name (e.g. Suyan Xu)"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="email@example.com"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            {contactDirty && (
              <div className="mt-2">
                <button
                  onClick={saveContact}
                  disabled={savingContact}
                  className="text-xs bg-sage-600 text-white px-3 py-1.5 rounded-md font-medium hover:bg-sage-700 disabled:opacity-50"
                >
                  {savingContact ? 'Saving…' : 'Save contact'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
