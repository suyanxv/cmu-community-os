'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun, Monitor } from 'lucide-react'

type Theme = 'light' | 'dark' | 'system'

const ORDER: Theme[] = ['light', 'dark', 'system']

function apply(theme: Theme) {
  const wantsDark = theme === 'dark'
    || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', wantsDark)
}

// Cycles light → dark → system. The current value lives in localStorage and
// is applied before paint by the inline script in the root layout.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('quorum-theme') as Theme | null
    if (stored && ORDER.includes(stored)) setTheme(stored)
  }, [])

  // Track OS changes while in system mode
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]
    setTheme(next)
    localStorage.setItem('quorum-theme', next)
    apply(next)
  }

  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor
  const label = theme === 'system' ? 'System theme' : theme === 'dark' ? 'Dark theme' : 'Light theme'

  // Render a stable placeholder until mounted so SSR markup matches
  if (!mounted) {
    return <span className="inline-block h-8 w-8" aria-hidden />
  }

  return (
    <button
      onClick={cycle}
      className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      title={`${label} — click to switch`}
      aria-label={`${label} — click to switch`}
    >
      <Icon className="w-4 h-4" strokeWidth={1.75} />
    </button>
  )
}
