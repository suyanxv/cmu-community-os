'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface ReminderTemplate {
  id: string
  title: string
  description?: string
  days_before: number
  priority: 'high' | 'medium' | 'low'
}

function newId(): string {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

const PRIORITY_LABEL: Record<ReminderTemplate['priority'], string> = {
  high: 'High', medium: 'Medium', low: 'Low',
}

function daysLabel(n: number): string {
  if (n === 0) return 'Day of event'
  const abs = Math.abs(n)
  const label = abs === 1 ? '1 day' : abs === 7 ? '1 week' : abs === 14 ? '2 weeks' : abs === 30 ? '1 month' : `${abs} days`
  return n > 0 ? `${label} before` : `${label} after`
}

export default function ReminderTemplatesEditor() {
  const toast = useToast()
  const [templates, setTemplates] = useState<ReminderTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    fetch('/api/organizations/reminder-templates')
      .then((r) => r.json())
      .then((d) => {
        setTemplates((d.data as ReminderTemplate[] | null) ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const markDirty = () => setDirty(true)

  const addTemplate = () => {
    setTemplates((prev) => [
      ...prev,
      { id: newId(), title: '', description: '', days_before: 30, priority: 'medium' },
    ])
    markDirty()
  }

  const updateTemplate = <K extends keyof ReminderTemplate>(i: number, key: K, value: ReminderTemplate[K]) => {
    setTemplates((prev) => prev.map((t, idx) => idx === i ? { ...t, [key]: value } : t))
    markDirty()
  }

  const removeTemplate = (i: number) => {
    setTemplates((prev) => prev.filter((_, idx) => idx !== i))
    markDirty()
  }

  const save = async () => {
    // Strip empty title templates
    const valid = templates.filter((t) => t.title.trim())
    setSaving(true)
    const res = await fetch('/api/organizations/reminder-templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templates: valid }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to save templates')
      return
    }
    setTemplates(valid)
    setDirty(false)
    toast.success(`${valid.length} reminder template${valid.length === 1 ? '' : 's'} saved`)
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">Event Reminder Templates</h2>
        <p className="text-sm text-gray-500 mt-1">
          These reminders are automatically added to every new event. If a computed due date is already past when the event is created, the reminder is marked Not Applicable and moved to Done.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <>
          <div className="space-y-3">
            {templates.length === 0 && (
              <p className="text-sm text-gray-400 italic">
                No templates yet. Click &ldquo;+ Add Template&rdquo; below to create one (e.g. &ldquo;Submit event to CMU 30 days before&rdquo;).
              </p>
            )}
            {templates.map((t, i) => (
              <div key={t.id} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-white">
                <div className="flex items-start gap-2">
                  <input
                    type="text"
                    value={t.title}
                    onChange={(e) => updateTemplate(i, 'title', e.target.value)}
                    placeholder="Reminder title (e.g. Submit event to CMU)"
                    className="flex-1 font-medium text-gray-900 border-0 border-b border-transparent focus:border-sage-400 focus:outline-none bg-transparent text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeTemplate(i)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                    aria-label="Remove template"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </div>

                <textarea
                  value={t.description ?? ''}
                  onChange={(e) => updateTemplate(i, 'description', e.target.value)}
                  placeholder="Description (optional) — e.g. Submission link: https://forms.cmu.edu/…"
                  rows={2}
                  className="w-full text-sm text-gray-600 bg-transparent border-0 focus:outline-none resize-none placeholder:text-gray-400"
                />

                <div className="flex items-center gap-3 flex-wrap text-xs">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={t.days_before}
                      onChange={(e) => updateTemplate(i, 'days_before', parseInt(e.target.value) || 0)}
                      className="w-16 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sage-500"
                    />
                    <span className="text-gray-500">days before event</span>
                    <span className="text-gray-400">— <em>{daysLabel(t.days_before)}</em></span>
                  </div>

                  <select
                    value={t.priority}
                    onChange={(e) => updateTemplate(i, 'priority', e.target.value as ReminderTemplate['priority'])}
                    className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sage-500"
                  >
                    {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>{label} priority</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-4 gap-2 flex-wrap">
            <button
              type="button"
              onClick={addTemplate}
              className="inline-flex items-center gap-1.5 text-sm text-sage-700 hover:text-sage-800 font-medium"
            >
              <Plus className="w-4 h-4" strokeWidth={1.75} /> Add Template
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 disabled:opacity-50"
            >
              <Check className="w-4 h-4" strokeWidth={1.75} />
              {saving ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
