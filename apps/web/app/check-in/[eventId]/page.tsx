import { notFound } from 'next/navigation'
import { sql } from '@/lib/db'
import CheckInForm from './CheckInForm'
import type { TemplateField } from '@/lib/ai'
import { formatEventDate } from '@/lib/dates'

type Params = { params: Promise<{ eventId: string }> }

// ISR: serve from the edge cache and refresh in the background at most
// once a minute. This page gets hammered by QR scans at the event door —
// config edits (welcome message, fields) may lag by up to 60s, which is fine.
// The empty generateStaticParams opts the dynamic segment into static
// generation with on-demand params — without it the route stays fully SSR.
export const revalidate = 60
export function generateStaticParams() {
  return []
}

interface EventRow {
  id: string
  name: string
  event_date: string
  start_time: string | null
  location_name: string | null
  location_address: string | null
  is_virtual: boolean
  event_mode: string
  checkin_config: {
    whatsapp_url?: string
    welcome_message?: string
    success_message?: string
    fields?: TemplateField[]
  } | null
  org_name: string
}

// Default fields used when the event hasn't customized the check-in form.
const DEFAULT_CHECKIN_FIELDS: TemplateField[] = [
  { id: 'graduation_year', label: 'Graduation Year',           type: 'text', required: false, placeholder: '2020' },
  { id: 'school',          label: 'School / Program',          type: 'text', required: false, placeholder: 'Tepper, SCS, Heinz, …' },
  { id: 'how_heard',       label: 'How did you hear about us?', type: 'text', required: false, placeholder: 'WhatsApp, friend, email…' },
]

export default async function CheckInPage({ params }: Params) {
  const { eventId } = await params

  // The URL segment can be a human slug ("annual-summer-beach-picnic") or a
  // legacy uuid — both resolve, so QR codes printed before slugs existed
  // keep working. id::text comparison avoids uuid cast errors on slugs.
  const rows = await sql`
    SELECT e.id, e.name, e.event_date, e.start_time, e.location_name,
           e.location_address, e.is_virtual, e.event_mode,
           e.checkin_config, o.name AS org_name
    FROM events e
    JOIN organizations o ON o.id = e.org_id
    WHERE (e.slug = ${eventId} OR e.id::text = ${eventId}) AND e.status != 'archived'
  ` as EventRow[]

  const event = rows[0]
  if (!event) notFound()

  const config = event.checkin_config ?? {}
  const fields = Array.isArray(config.fields) && config.fields.length > 0
    ? config.fields
    : DEFAULT_CHECKIN_FIELDS

  const locationLine = event.event_mode === 'virtual'
    ? 'Virtual event'
    : [event.location_name, event.location_address].filter(Boolean).join(', ') || ''

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-sm text-gray-500 mb-1">{event.org_name}</p>
          <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
          <p className="text-sm text-gray-500 mt-2">
            {formatEventDate(event.event_date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            {event.start_time ? ` · ${event.start_time.slice(0, 5)}` : ''}
          </p>
          {locationLine && <p className="text-xs text-gray-400 mt-1">{locationLine}</p>}
        </div>

        {config.welcome_message && (
          <div className="bg-sage-50 border border-sage-200 rounded-xl p-4 mb-5 text-sm text-sage-800">
            {config.welcome_message}
          </div>
        )}

        <CheckInForm eventId={eventId} whatsappUrl={config.whatsapp_url} successMessage={config.success_message} fields={fields} />

        <p className="text-xs text-gray-400 text-center mt-8">
          Powered by Quorum
        </p>
      </div>
    </div>
  )
}
