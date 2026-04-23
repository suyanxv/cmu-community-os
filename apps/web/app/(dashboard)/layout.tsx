'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs'
import { ToastProvider } from '@/components/ui/Toast'
import {
  Home,
  CalendarDays,
  Users,
  Bell,
  History,
  Settings,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react'

const navItems: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: '/dashboard', label: 'Home',      Icon: Home },
  { href: '/events',    label: 'Events',    Icon: CalendarDays },
  { href: '/partners',  label: 'Partners',  Icon: Users },
  { href: '/reminders', label: 'Reminders', Icon: Bell },
  { href: '/activity',  label: 'Activity',  Icon: History },
  { href: '/settings',  label: 'Settings',  Icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navLinks = navItems.map(({ href, label, Icon }) => {
    const active = pathname.startsWith(href)
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          active
            ? 'bg-sage-50 text-sage-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
        {label}
      </Link>
    )
  })

  return (
    <ToastProvider>
    <div className="flex h-screen bg-stone-50">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col shrink-0">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900 mb-3">Quorum</h1>
          <OrganizationSwitcher
            hidePersonal
            afterSelectOrganizationUrl="/events"
            afterCreateOrganizationUrl="/events"
          />
        </div>
        <nav className="flex-1 p-3 space-y-1">{navLinks}</nav>
        <div className="p-4 border-t border-gray-200 flex items-center gap-3">
          <UserButton />
          <span className="text-sm text-gray-500">Account</span>
        </div>
      </aside>

      {/* ── Mobile layout ── */}
      <div className="flex flex-col flex-1 min-w-0 md:hidden">

        {/* Mobile top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-1.5 rounded-lg hover:bg-gray-100"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5 text-gray-600" strokeWidth={1.75} />
            </button>
            <span className="font-bold text-gray-900">Quorum</span>
          </div>
          <div className="flex items-center gap-2">
            <OrganizationSwitcher
              hidePersonal
              afterSelectOrganizationUrl="/events"
              afterCreateOrganizationUrl="/events"
            />
            <UserButton />
          </div>
        </header>

        {/* Mobile drawer overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <aside className="relative w-64 bg-white flex flex-col h-full shadow-xl">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h1 className="text-xl font-bold text-gray-900">Quorum</h1>
                <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close menu">
                  <X className="w-5 h-5 text-gray-500" strokeWidth={1.75} />
                </button>
              </div>
              <nav className="flex-1 p-3 space-y-1">{navLinks}</nav>
              <div className="p-4 border-t border-gray-200 flex items-center gap-3">
                <UserButton />
                <span className="text-sm text-gray-500">Account</span>
              </div>
            </aside>
          </div>
        )}

        {/* Mobile main content */}
        <main className="flex-1 overflow-auto">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="bg-white border-t border-gray-200 flex shrink-0">
          {navItems.map(({ href, label, Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                  active ? 'text-sage-700' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={1.75} />
                {label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* ── Desktop main content ── */}
      <main className="hidden md:flex flex-1 overflow-auto flex-col">
        {children}
      </main>

    </div>
    </ToastProvider>
  )
}
