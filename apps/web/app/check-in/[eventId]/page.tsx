import { notFound } from 'next/navigation'
import { sql } from '@/lib/db'
import CheckInForm from './CheckInForm'

type Params = { params: Promise<{ eventId: string }> }

interface EventRow {
  id: string
  name: string
  event_date: string
  start_time: string | null
  location_name: string | null
  location_address: string | null
  is_virtual: boolean
  event_mode: string
  checkin_config: { whatsapp_url?: string; welcome_message?: string } | null
  org_name: string
}

export default async function CheckInPage({ params }: Params) {
  const { eventId } = await params

  const rows = await sql`
    SELECT e.id, e.name, e.event_date, e.start_time, e.location_name,
           e.location_address, e.is_virtual, e.event_mode,
           e.checkin_config, o.name AS org_name
    FROM events e
    JOIN organizations o ON o.id = e.org_id
    WHERE e.id = ${eventId} AND e.status != 'archived'
  ` as EventRow[]

  const event = rows[0]
  if (!event) notFound()

  const config = event.checkin_config ?? {}
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
            {new Date(event.event_date).toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
            })}
            {event.start_time ? ` · ${event.start_time.slice(0, 5)}` : ''}
          </p>
          {locationLine && <p className="text-xs text-gray-400 mt-1">{locationLine}</p>}
        </div>

        {config.welcome_message && (
          <div className="bg-sage-50 border border-sage-200 rounded-xl p-4 mb-5 text-sm text-sage-800">
            {config.welcome_message}
          </div>
        )}

        <CheckInForm eventId={eventId} whatsappUrl={config.whatsapp_url} />

        <p className="text-xs text-gray-400 text-center mt-8">
          Powered by Quorum
        </p>
      </div>
    </div>
  )
}
