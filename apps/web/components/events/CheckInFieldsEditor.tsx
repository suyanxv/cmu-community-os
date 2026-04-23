'use client'

import type { TemplateField, TemplateFieldType } from '@/lib/ai'

interface CheckInFieldsEditorProps {
  fields: TemplateField[]
  onChange: (fields: TemplateField[]) => void
}

const PRESET_FIELDS: TemplateField[] = [
  { id: 'graduation_year', label: 'Graduation Year',            type: 'text',     required: false, placeholder: '2020' },
  { id: 'school',          label: 'School / Program',           type: 'text',     required: false, placeholder: 'Tepper, SCS, Heinz, …' },
  { id: 'how_heard',       label: 'How did you hear about us?', type: 'text',     required: false, placeholder: 'WhatsApp, friend, email…' },
  { id: 'phone',           label: 'Phone Number',               type: 'text',     required: false },
  { id: 'company',         label: 'Current Company',            type: 'text',     required: false },
  { id: 'role',            label: 'Current Role',               type: 'text',     required: false },
  { id: 'linkedin',        label: 'LinkedIn URL',               type: 'url',      required: false },
  { id: 'dietary',         label: 'Dietary Restrictions',       type: 'text',     required: false },
]

const TYPE_LABELS: Record<TemplateFieldType, string> = {
  text:     'Short text',
  textarea: 'Paragraph',
  email:    'Email',
  url:      'URL',
  number:   'Number',
  date:     'Date',
  time:     'Time',
  select:   'Dropdown',
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || `field_${Date.now()}`
}

export default function CheckInFieldsEditor({ fields, onChange }: CheckInFieldsEditorProps) {
  const updateField = <K extends keyof TemplateField>(i: number, key: K, value: TemplateField[K]) => {
    const updated = [...fields]
    updated[i] = { ...updated[i], [key]: value }
    onChange(updated)
  }

  const removeField = (i: number) =>
    onChange(fields.filter((_, idx) => idx !== i))

  const moveUp = (i: number) => {
    if (i === 0) return
    const updated = [...fields]
    ;[updated[i - 1], updated[i]] = [updated[i], updated[i - 1]]
    onChange(updated)
  }

  const addPreset = (preset: TemplateField) => {
    if (fields.some((f) => f.id === preset.id)) return
    onChange([...fields, preset])
  }

  const addCustom = () => {
    const label = 'New field'
    onChange([
      ...fields,
      { id: `${slugify(label)}_${Date.now().toString(36).slice(-4)}`, label, type: 'text', required: false },
    ])
  }

  const availablePresets = PRESET_FIELDS.filter((p) => !fields.some((f) => f.id === p.id))

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-gray-500">
          Name and email are always collected. Add any additional fields to capture at check-in.
        </p>
      </div>

      {fields.length === 0 && (
        <p className="text-sm text-gray-400 italic">
          No extra fields. Click &ldquo;+ Add&rdquo; below to collect more info, or leave empty to just collect name + email.
        </p>
      )}

      {fields.map((field, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-white">
          <div className="flex items-start gap-2">
            <div className="flex flex-col gap-0.5 pt-1">
              <button
                type="button"
                onClick={() => moveUp(i)}
                disabled={i === 0}
                className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                aria-label="Move up"
                title="Move up"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <span className="text-xs text-gray-400 text-center">{i + 1}</span>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => updateField(i, 'label', e.target.value)}
                  className="flex-1 text-sm font-medium border-0 border-b border-transparent focus:border-sage-400 focus:outline-none bg-transparent"
                  placeholder="Field label"
                />
                <button
                  type="button"
                  onClick={() => removeField(i)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <select
                  value={field.type}
                  onChange={(e) => updateField(i, 'type', e.target.value as TemplateFieldType)}
                  className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sage-500"
                >
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 cursor-pointer text-gray-600">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateField(i, 'required', e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  Required
                </label>
                {field.type === 'select' && (
                  <input
                    type="text"
                    value={(field.options ?? []).join(', ')}
                    onChange={(e) =>
                      updateField(i, 'options', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
                    }
                    placeholder="Option 1, Option 2, Option 3"
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sage-500"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={addCustom}
          className="text-sm text-sage-700 hover:text-sage-800 font-medium"
        >
          + Add custom field
        </button>
        {availablePresets.length > 0 && (
          <>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-500">Quick add:</span>
            {availablePresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => addPreset(preset)}
                className="text-xs border border-gray-200 bg-white px-2 py-0.5 rounded-full hover:border-sage-300 hover:bg-sage-50"
              >
                + {preset.label}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
