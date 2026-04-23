import { notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@/lib/db'
import EventForm from '@/components/events/EventForm'
import type { TemplateField } from '@/lib/ai'

type Params = { params: Promise<{ id: string }> }

const DEFAULT_CHECKIN_FIELDS: TemplateField[] = [
  { id: 'graduation_year', label: 'Graduation Year',            type: 'text', required: false, placeholder: '2020' },
  { id: 'school',          label: 'School / Program',           type: 'text', required: false, placeholder: 'Tepper, SCS, Heinz, …' },
  { id: 'how_heard',       label: 'How did you hear about us?', type: 'text', required: false, placeholder: 'WhatsApp, friend, email…' },
]

export default async function EditEventPage({ params }: Params) {
  const { id } = await params
  const { orgId: clerkOrgId } = await auth()
  if (!clerkOrgId) notFound()

  const rows = await sql`
    SELECT e.*, o.settings->'event_template_schema' AS template_schema
    FROM events e
    JOIN organizations o ON o.id = e.org_id
    WHERE e.id = ${id} AND o.clerk_org_id = ${clerkOrgId}
  `
  const event = rows[0]
  if (!event) notFound()

  let hostUserIds: string[] = []
  try {
    const hostRows = await sql`
      SELECT user_id FROM event_hosts WHERE event_id = ${id}
    `
    hostUserIds = hostRows.map((r) => r.user_id as string)
  } catch {
    hostUserIds = []
  }

  const templateSchema = event.template_schema as TemplateField[] | null
  const customFields = Array.isArray(templateSchema) && templateSchema.length > 0 ? templateSchema : undefined

  const initialCustomValues = (event.custom_fields ?? {}) as Record<string, unknown>

  // Normalize DATE columns to YYYY-MM-DD. Neon returns date columns as JS Date
  // objects (whose default String() is "Fri Apr 24 2026 ..."), so plain slice
  // can't be trusted. For Date, use UTC-based ISO truncation since DATE has no
  // timezone. For strings (some older driver paths), strip after the 10th char.
  const toYmd = (v: unknown): string => {
    if (!v) return ''
    if (v instanceof Date) return v.toISOString().slice(0, 10)
    return String(v).slice(0, 10)
  }
  // start_time / end_time come as TIME strings from Postgres ("HH:MM:SS").
  // Just grab the first five chars for <input type="time">.
  const toHm = (v: unknown): string => {
    if (!v) return ''
    return String(v).slice(0, 5)
  }

  const initialValues = {
    name: event.name ?? '',
    cover_emoji: (event.cover_emoji as string) ?? '',
    event_date: toYmd(event.event_date),
    end_date: toYmd(event.end_date),
    start_time: toHm(event.start_time),
    end_time: toHm(event.end_time),
    timezone: event.timezone ?? 'America/Los_Angeles',
    location_name: event.location_name ?? '',
    location_address: event.location_address ?? '',
    location_url: event.location_url ?? '',
    is_virtual: event.is_virtual ?? false,
    event_mode: (event.event_mode ?? 'in_person') as 'in_person' | 'virtual' | 'hybrid',
    description: event.description ?? '',
    speakers: event.speakers ?? [],
    agenda: event.agenda ?? '',
    sponsors: event.sponsors ?? [],
    tone: event.tone ?? 'professional-warm',
    target_audience: event.target_audience ?? '',
    channels: event.channels ?? [],
    rsvp_link: event.rsvp_link ?? '',
    rsvp_deadline: toYmd(event.rsvp_deadline),
    max_capacity: event.max_capacity ? String(event.max_capacity) : '',
    tags: Array.isArray(event.tags) ? event.tags.join(', ') : '',
    notes: event.notes ?? '',
    checkin_whatsapp_url: (event.checkin_config as Record<string, unknown> | null)?.whatsapp_url as string ?? '',
    checkin_welcome_message: (event.checkin_config as Record<string, unknown> | null)?.welcome_message as string ?? '',
    checkin_fields: ((event.checkin_config as { fields?: TemplateField[] } | null)?.fields as TemplateField[] | undefined) ?? DEFAULT_CHECKIN_FIELDS,
    host_user_ids: hostUserIds,
    category: (event.category ?? 'internal') as 'internal' | 'partnered' | 'external',
    co_hosts: Array.isArray(event.co_hosts) ? (event.co_hosts as string[]) : [],
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <Link href={`/events/${id}`} className="text-sm text-gray-500 hover:text-gray-700 mb-2 block">
        ← Back to Event
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Event</h1>
      <EventForm
        initialValues={initialValues}
        eventId={id}
        customFields={customFields}
        initialCustomValues={initialCustomValues}
      />
    </div>
  )
}
