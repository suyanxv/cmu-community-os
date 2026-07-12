'use client'

import { useEffect, useState } from 'react'
import { Check, Moon, Sun, Monitor } from 'lucide-react'

type Mode = 'light' | 'dark' | 'system'

const ACCENTS = [
  { id: 'sage',  label: 'Sage',  color: '#6a8d55' },
  { id: 'ocean', label: 'Ocean', color: '#4a86a0' },
  { id: 'plum',  label: 'Plum',  color: '#8d61a2' },
  { id: 'clay',  label: 'Clay',  color: '#ad6544' },
  { id: 'slate', label: 'Slate', color: '#677d91' },
] as const

type AccentId = (typeof ACCENTS)[number]['id']

const MODES: { id: Mode; label: string; Icon: typeof Sun }[] = [
  { id: 'light',  label: 'Light',  Icon: Sun },
  { id: 'dark',   label: 'Dark',   Icon: Moon },
  { id: 'system', label: 'System', Icon: Monitor },
]

function applyMode(mode: Mode) {
  const wantsDark = mode === 'dark'
    || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', wantsDark)
}

function applyAccent(accent: AccentId) {
  const el = document.documentElement
  for (const a of ACCENTS) el.classList.remove(`theme-${a.id}`)
  if (accent !== 'sage') el.classList.add(`theme-${accent}`)
}

// Settings → Appearance: color-mode segmented control + accent swatches.
// Both persist per-device in localStorage and are applied before first
// paint by the inline script in the root layout.
export default function AppearanceSection() {
  const [mode, setMode] = useState<Mode>('system')
  const [accent, setAccent] = useState<AccentId>('sage')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const storedMode = localStorage.getItem('quorum-theme') as Mode | null
    if (storedMode && MODES.some((m) => m.id === storedMode)) setMode(storedMode)
    const storedAccent = localStorage.getItem('quorum-accent') as AccentId | null
    if (storedAccent && ACCENTS.some((a) => a.id === storedAccent)) setAccent(storedAccent)
  }, [])

  const pickMode = (m: Mode) => {
    setMode(m)
    localStorage.setItem('quorum-theme', m)
    applyMode(m)
  }

  const pickAccent = (a: AccentId) => {
    setAccent(a)
    localStorage.setItem('quorum-accent', a)
    applyAccent(a)
  }

  if (!mounted) return null

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Color mode</p>
        <div className="flex gap-1 bg-stone-100 p-1 rounded-lg w-fit">
          {MODES.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => pickMode(id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                mode === id ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.75} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Accent color</p>
        <div className="flex gap-2 flex-wrap">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              onClick={() => pickAccent(a.id)}
              className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg border transition-colors ${
                accent === a.id ? 'border-sage-500 bg-sage-50' : 'border-gray-200 hover:border-gray-300'
              }`}
              aria-pressed={accent === a.id}
            >
              <span
                className="h-7 w-7 rounded-full flex items-center justify-center"
                style={{ backgroundColor: a.color }}
              >
                {accent === a.id && <Check className="w-4 h-4 text-white" strokeWidth={2.5} />}
              </span>
              <span className="text-xs text-gray-600">{a.label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Applies on this device. Works in both light and dark mode.</p>
      </div>
    </div>
  )
}
