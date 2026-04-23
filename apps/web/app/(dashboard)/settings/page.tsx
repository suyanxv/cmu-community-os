'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { OrganizationProfile } from '@clerk/nextjs'
import { History, ArrowUpRight } from 'lucide-react'
import type { TemplateField } from '@/lib/ai'
import { useToast } from '@/components/ui/Toast'
import TeamSection from '@/components/TeamSection'
import ReminderTemplatesEditor from '@/components/ReminderTemplatesEditor'
import PermissionsReference from '@/components/PermissionsReference'
import PublicShareSection from '@/components/PublicShareSection'

export default function SettingsPage() {
  const toast = useToast()
  const [schema, setSchema] = useState<TemplateField[] | null>(null)
  const [input, setInput] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingSchema, setPendingSchema] = useState<TemplateField[] | null>(null)

  useEffect(() => {
    fetch('/api/organizations/template')
      .then((r) => r.json())
      .then((d) => setSchema(d.data))
      .catch(() => {})
  }, [])

  const parseInput = async () => {
    setParsing(true)
    setError(null)
    const res = await fetch('/api/organizations/template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to parse template')
    } else {
      const { data } = await res.json()
      if (!data || data.length === 0) {
        setError('Could not extract any fields. Try providing more detail or paste actual form fields.')
      } else {
        setPendingSchema(data)
      }
    }
    setParsing(false)
  }

  const saveSchema = async () => {
    if (!pendingSchema) return
    setSaving(true)
    const res = await fetch('/api/organizations/template', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: pendingSchema }),
    })
    if (res.ok) {
      toast.success(`Template saved — ${pendingSchema.length} custom fields active`)
      setSchema(pendingSchema)
      setPendingSchema(null)
      setInput('')
    } else {
      toast.error('Failed to save template')
    }
    setSaving(false)
  }

  const clearSchema = async () => {
    if (!confirm('Remove custom template and use default form?')) return
    await fetch('/api/organizations/template', { method: 'DELETE' })
    setSchema(null)
    toast.info('Reverted to default event form')
  }

  const sectionClass = 'bg-white rounded-xl border border-gray-200 p-4 sm:p-6 space-y-4'

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Event Form Template */}
      <div className={sectionClass}>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Event Form Template</h2>
          <p className="text-sm text-gray-500 mt-1">
            Customize the event creation form for your organization. Paste your existing form URL, field list, or a description.
            If left empty, the default form is used.
          </p>
        </div>

        {schema && schema.length > 0 && !pendingSchema && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-green-800">✓ Custom template active ({schema.length} fields)</p>
              <button onClick={clearSchema} className="text-xs text-red-600 hover:text-red-700 font-medium">
                Reset to default
              </button>
            </div>
            <div className="space-y-1">
              {schema.map((f) => (
                <div key={f.id} className="text-xs text-gray-600">
                  • {f.label} <span className="text-gray-400">({f.type}{f.required ? ', required' : ''})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!pendingSchema && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template source
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={6}
                placeholder={`Examples:
  • https://docs.google.com/forms/d/your-form
  • https://lu.ma/create-event
  • Event Title, Expected attendance, Dress code (Casual/Formal), Food preferences, Parking notes…
  • "We collect: which alumni class, chapter chapter budget, is this free/paid, dress code"`}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              onClick={parseInput}
              disabled={parsing || !input.trim()}
              className="bg-sage-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sage-700 disabled:opacity-50"
            >
              {parsing ? '⟳ Parsing with AI…' : schema && schema.length > 0 ? 'Replace Template' : 'Parse & Preview'}
            </button>
          </>
        )}

        {/* Preview parsed fields */}
        {pendingSchema && (
          <div className="bg-sage-50 border border-sage-200 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-sage-800">Preview — {pendingSchema.length} fields extracted:</p>
            <div className="space-y-1">
              {pendingSchema.map((f) => (
                <div key={f.id} className="text-sm text-gray-700">
                  <span className="font-medium">{f.label}</span>
                  {f.required && <span className="text-red-500">*</span>}
                  <span className="text-gray-400 text-xs ml-2">({f.type})</span>
                  {f.options && <span className="text-gray-400 text-xs ml-1">[{f.options.join(', ')}]</span>}
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={saveSchema}
                disabled={saving}
                className="bg-sage-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sage-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Use This Template'}
              </button>
              <button
                onClick={() => setPendingSchema(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Team roles & titles (Quorum-level) */}
      <div className={sectionClass}>
        <TeamSection />
      </div>

      {/* Roles & permissions reference */}
      <div className={sectionClass}>
        <PermissionsReference />
      </div>

      {/* Event reminder templates */}
      <div className={sectionClass}>
        <ReminderTemplatesEditor />
      </div>

      {/* Public calendar share link */}
      <div className={sectionClass}>
        <PublicShareSection />
      </div>

      {/* Activity / audit log — a reference, not a workflow, so it lives here */}
      <Link
        href="/activity"
        className={`${sectionClass} flex items-center justify-between hover:border-sage-300 hover:shadow-sm transition-all group`}
      >
        <div className="flex items-center gap-3">
          <div className="bg-sage-50 p-2 rounded-lg">
            <History className="w-5 h-5 text-sage-600" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Activity log</h2>
            <p className="text-sm text-gray-500 mt-0.5">Who did what and when — audit trail for every event, partner, and reminder change.</p>
          </div>
        </div>
        <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-sage-600 shrink-0" strokeWidth={1.75} />
      </Link>

      {/* Clerk org profile (invite, leave, etc.) */}
      <div className={sectionClass}>
        <h2 className="text-base font-semibold text-gray-900 mb-2">Organization & Members</h2>
        <OrganizationProfile routing="hash" />
      </div>
    </div>
  )
}
