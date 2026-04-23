'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CardListSkeleton } from '@/components/ui/Skeleton'
import {
  Plus, Pencil, Trash2, Sparkles, Check, Upload, Circle,
  type LucideIcon,
} from 'lucide-react'

interface ActivityItem {
  id: string
  user_id: string | null
  user_name: string | null
  avatar_url: string | null
  entity_type: string
  entity_id: string | null
  action: string
  detail: Record<string, unknown> | null
  created_at: string
}

const ACTION_ICONS: Record<string, LucideIcon> = {
  created: Plus,
  updated: Pencil,
  deleted: Trash2,
  generated: Sparkles,
  completed: Check,
  imported: Upload,
}

const ACTION_COLORS: Record<string, string> = {
  created: 'text-sage-700',
  updated: 'text-butter-700',
  deleted: 'text-red-600',
  generated: 'text-lavender-700',
  completed: 'text-sage-700',
  imported: 'text-butter-700',
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}

function describe(item: ActivityItem): string {
  const actor = item.user_name ?? 'Someone'
  const type = item.entity_type
  const name = typeof item.detail?.name === 'string' ? `"${item.detail.name}"` : ''
  const channels = Array.isArray(item.detail?.channels) ? (item.detail.channels as string[]).join(', ') : null

  switch (`${type}:${item.action}`) {
    case 'event:created':   return `${actor} created event ${name}`
    case 'event:updated':   return `${actor} updated event`
    case 'event:deleted':   return `${actor} deleted an event`
    case 'partner:created': return `${actor} added a partner`
    case 'partner:updated': return `${actor} updated a partner`
    case 'partner:deleted': return `${actor} removed a partner`
    case 'reminder:created':   return `${actor} created a reminder`
    case 'reminder:completed': return `${actor} completed a reminder`
    case 'rsvp:created':  return `${actor} added an RSVP`
    case 'rsvp:imported': {
      const n = item.detail?.imported
      return `${actor} imported ${typeof n === 'number' ? n : 'multiple'} RSVPs from CSV`
    }
    case 'content:generated': return `${actor} generated content${channels ? ` for ${channels}` : ''}`
    default: return `${actor} ${item.action} a ${type}`
  }
}

function linkFor(item: ActivityItem): string | null {
  if (!item.entity_id) return null
  if (item.entity_type === 'event' || item.entity_type === 'content' || item.entity_type === 'rsvp') {
    return `/events/${item.entity_id}`
  }
  if (item.entity_type === 'partner') return `/partners/${item.entity_id}`
  if (item.entity_type === 'reminder') return `/reminders`
  return null
}

export default function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/activity?limit=50')
      .then((r) => r.json())
      .then((d) => { setItems(d.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <CardListSkeleton count={4} />

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">
        No activity yet. Create events, add RSVPs, or invite board members to see a timeline here.
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {items.map((item) => {
        const link = linkFor(item)
        const Icon = ACTION_ICONS[item.action] ?? Circle
        const actionColor = ACTION_COLORS[item.action] ?? 'text-gray-700'
        const content = (
          <div className="flex items-start gap-3 px-3 py-2.5 hover:bg-stone-50 rounded-lg transition-colors">
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${actionColor}`} strokeWidth={1.75} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${actionColor}`}>{describe(item)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{relativeTime(item.created_at)}</p>
            </div>
          </div>
        )
        return link ? (
          <Link key={item.id} href={link} className="block">{content}</Link>
        ) : (
          <div key={item.id}>{content}</div>
        )
      })}
    </div>
  )
}
