'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

type Variant = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  variant: Variant
}

interface ToastContextValue {
  push: (message: string, variant?: Variant) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const push = useCallback((message: string, variant: Variant = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, variant }])
  }, [])

  const value: ToastContextValue = {
    push,
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

function Toaster({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timeout = setTimeout(() => onDismiss(toast.id), 3500)
    return () => clearTimeout(timeout)
  }, [toast.id, onDismiss])

  const styles =
    toast.variant === 'success' ? 'bg-sage-600 text-white'
    : toast.variant === 'error' ? 'bg-red-600 text-white'
    : 'bg-gray-900 text-white'

  const icon =
    toast.variant === 'success' ? '✓'
    : toast.variant === 'error' ? '!'
    : 'i'

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-center gap-3 min-w-[260px] max-w-sm px-4 py-3 rounded-xl shadow-lg ${styles} animate-in slide-in-from-bottom-2`}
    >
      <span className="h-5 w-5 shrink-0 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
        {icon}
      </span>
      <p className="text-sm flex-1">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-white/70 hover:text-white shrink-0"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
