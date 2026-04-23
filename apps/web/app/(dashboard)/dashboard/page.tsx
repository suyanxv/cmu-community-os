import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import { formatEventDate } from '@/lib/dates'
import {
  CalendarDays, Bell, Plus, Upload, Users, MapPin, Video,
  ChevronRight, Sparkles, Check, Pencil, Trash2,
} from 'lucide-react'

async function getOrgId(clerkOrgId: string) {
  const rows = await sql`SELECT id, name FROM organizations WHERE clerk_org_id = ${clerkOrgId}`
  return rows[0] ?? null
}

const ACTION_ICONS: Record<string, typeof Plus> = {
  created: Plus, updated: Pencil, deleted: Trash2,
  generated: Sparkles, completed: Check, imported: Upload,
}

export default async function DashboardPage() {
  const { orgId: clerkOrgId } = await auth()
  if (!clerkOrgId) redirect('/sign-in')
  const org = await getOrgId(clerkOrgId)
  if (!org) redirect('/events')

  // Parallel fetch of everything we need for the dashboard
  const [nextEvents, pendingReminders, recentActivity, stats] = await Promise.all([
    sql`
      SELECT id, name, to_char(event_date, 'YYYY-MM-DD') AS event_date,
             start_time, location_name, event_mode, status
      FROM events
      WHERE org_id = ${org.id}
        AND status != 'archived'
        AND event_date >= CURRENT_DATE
      ORDER BY event_date ASC
      LIMIT 3
    `,
    sql`
      SELECT r.id, r.title, r.due_date, r.priority, r.event_id, e.name AS event_name,
             r.assigned_to, u.full_name AS assigned_to_name
      FROM reminders r
      LEFT JOIN events e ON e.id = r.event_id
      LEFT JOIN users u ON u.id = r.assigned_to
      WHERE r.org_id = ${org.id} AND r.status = 'pending'
      ORDER BY r.due_date ASC
      LIMIT 5
    `,
    sql`
      SELECT al.id, al.entity_type, al.entity_id, al.action, al.detail, al.created_at,
             u.full_name AS user_name
      FROM activity_log al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.org_id = ${org.id}
      ORDER BY al.created_at DESC
      LIMIT 5
    `,
    sql`
      SELECT
        (SELECT COUNT(*)::int FROM events WHERE org_id = ${org.id} AND status != 'archived' AND event_date >= CURRENT_DATE) AS upcoming_count,
        (SELECT COUNT(*)::int FROM partners WHERE org_id = ${org.id} AND status IN ('active', 'prospect')) AS active_partner_count,
        (SELECT COUNT(*)::int FROM reminders WHERE org_id = ${org.id} AND status = 'pending' AND due_date < CURRENT_DATE) AS overdue_reminders,
        (SELECT COUNT(*)::int FROM rsvps r JOIN events e ON e.id = r.event_id WHERE e.org_id = ${org.id} AND r.check_in_at >= CURRENT_DATE - INTERVAL '30 days') AS checkins_30d
    `,
  ])

  const s = stats[0] as Record<string, number>

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="text-sm text-gray-500 mt-1">
          Here&rsquo;s what&rsquo;s happening at <span className="font-medium text-gray-700">{org.name}</span>.
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Upcoming events"   value={s.upcoming_count}       icon={CalendarDays} href="/events" />
        <StatCard label="Active partners"   value={s.active_partner_count} icon={Users}        href="/partners" />
        <StatCard label="Overdue reminders" value={s.overdue_reminders}    icon={Bell}         href="/reminders" warn={s.overdue_reminders > 0} />
        <StatCard label="Check-ins (30d)"   value={s.checkins_30d}         icon={Check}        href="/events" />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Link href="/events/new" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 font-medium">
          <Plus className="w-4 h-4" strokeWidth={1.75} /> New Event
        </Link>
        <Link href="/events/import" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50">
          <Upload className="w-4 h-4" strokeWidth={1.75} /> Import
        </Link>
        <Link href="/partners" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50">
          <Users className="w-4 h-4" strokeWidth={1.75} /> Partners
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Upcoming events */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
          <SectionHeader title="Up next" href="/events" linkLabel="All events" />
          {nextEvents.length === 0 ? (
            <EmptyHint emoji="📅" text="No upcoming events. Create one to get started." actionHref="/events/new" actionLabel="New Event" />
          ) : (
            <div className="space-y-2">
              {nextEvents.map((ev) => {
                const mode = (ev.event_mode as string) ?? 'in_person'
                const locText = mode === 'virtual' ? 'Virtual' : (ev.location_name ?? 'Location TBD')
                const Icon = mode === 'virtual' ? Video : MapPin
                return (
                  <Link key={ev.id as string} href={`/events/${ev.id}`} className="flex items-center gap-3 p-3 -mx-3 rounded-lg hover:bg-stone-50">
                    <div className="h-11 w-11 bg-sage-50 border border-sage-200 rounded-lg flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] font-medium text-sage-700 uppercase leading-none">
                        {new Date((ev.event_date as string) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span className="text-base font-bold text-sage-800 leading-tight">
                        {(ev.event_date as string).slice(8, 10)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{ev.name as string}</p>
                      <p className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                        <Icon className="w-3 h-3 text-gray-400 shrink-0" strokeWidth={1.75} />
                        <span className="truncate">{locText}</span>
                        {ev.start_time ? <span>· {(ev.start_time as string).slice(0, 5)}</span> : null}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" strokeWidth={1.75} />
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Pending reminders */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <SectionHeader title="To do" href="/reminders" linkLabel="All" />
          {pendingReminders.length === 0 ? (
            <EmptyHint emoji="🎉" text="All caught up! No pending reminders." />
          ) : (
            <div className="space-y-2">
              {pendingReminders.map((r) => {
                const isOverdue = new Date(r.due_date as string) < new Date()
                return (
                  <Link
                    key={r.id as string}
                    href={r.event_id ? `/reminders?event_id=${r.event_id}` : '/reminders'}
                    className="block p-2 -mx-2 rounded hover:bg-stone-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-gray-900 truncate">{r.title as string}</p>
                      <span className={`text-[11px] shrink-0 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                        {new Date((r.due_date as string) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    {(r.event_name || r.assigned_to_name) && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {r.event_name ? `📅 ${r.event_name} · ` : ''}
                        {r.assigned_to_name ? `👤 ${r.assigned_to_name}` : 'unassigned'}
                      </p>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <SectionHeader title="Recent activity" href="/activity" linkLabel="All activity" />
        {recentActivity.length === 0 ? (
          <EmptyHint emoji="📜" text="No activity yet." />
        ) : (
          <div className="space-y-1">
            {recentActivity.map((a) => {
              const Icon = ACTION_ICONS[a.action as string] ?? Plus
              const actor = (a.user_name as string | null) ?? 'Someone'
              const type = a.entity_type as string
              const action = a.action as string
              const detail = a.detail as { name?: string } | null
              const what = detail?.name ? `"${detail.name}"` : type
              const ago = relativeTime(a.created_at as string)
              const label = `${actor} ${action} ${what}`
              return (
                <div key={a.id as string} className="flex items-start gap-2.5 py-1.5">
                  <Icon className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" strokeWidth={1.75} />
                  <p className="text-sm text-gray-700 flex-1 min-w-0 truncate">{label}</p>
                  <span className="text-xs text-gray-400 shrink-0">{ago}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label, value, icon: Icon, href, warn = false,
}: {
  label: string; value: number; icon: typeof CalendarDays; href: string; warn?: boolean
}) {
  return (
    <Link href={href} className={`bg-white border rounded-xl p-4 hover:border-sage-300 hover:shadow-sm transition-all ${warn ? 'border-red-200 bg-red-50/40' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <Icon className={`w-4 h-4 ${warn ? 'text-red-500' : 'text-gray-400'}`} strokeWidth={1.75} />
      </div>
      <p className={`text-2xl font-bold mt-2 ${warn && value > 0 ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </Link>
  )
}

function SectionHeader({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <Link href={href} className="text-xs text-sage-700 hover:text-sage-800 font-medium">
        {linkLabel} →
      </Link>
    </div>
  )
}

function EmptyHint({ emoji, text, actionHref, actionLabel }: { emoji: string; text: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="text-center py-6">
      <p className="text-3xl mb-2">{emoji}</p>
      <p className="text-sm text-gray-500">{text}</p>
      {actionHref && (
        <Link href={actionHref} className="inline-block mt-3 text-sm text-sage-700 hover:text-sage-800 font-medium">
          {actionLabel} →
        </Link>
      )}
    </div>
  )
}

// Simple relative-time helper (no lib needed)
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diffMs / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
