import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@/lib/db'
import { formatEventDate } from '@/lib/dates'
import PrintButton from './PrintButton'

type Params = { params: Promise<{ id: string }> }

// Print-ready check-in poster. Lives outside the (dashboard) group so it
// renders without the app chrome — what you see is what prints. The Print
// button opens the browser dialog, which also offers "Save as PDF".
export default async function CheckInPosterPage({ params }: Params) {
  const { id } = await params
  const { orgId: clerkOrgId } = await auth()
  if (!clerkOrgId) notFound()

  const rows = await sql`
    SELECT e.name, e.cover_emoji, e.event_date, e.start_time, e.end_time,
           e.location_name, e.location_address, o.name AS org_name
    FROM events e
    JOIN organizations o ON o.id = e.org_id
    WHERE e.id = ${id} AND o.clerk_org_id = ${clerkOrgId}
  `
  const event = rows[0]
  if (!event) notFound()

  const timeLine = [
    formatEventDate(event.event_date as string, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    event.start_time ? String(event.start_time).slice(0, 5) : null,
  ].filter(Boolean).join(' · ')

  const locationLine = [event.location_name, event.location_address].filter(Boolean).join(' · ')

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-8 py-10 print:py-0">
      {/* Screen-only toolbar */}
      <div className="w-full max-w-xl flex items-center justify-between mb-8 print:hidden">
        <p className="text-sm text-gray-400">Preview — this page prints exactly as shown below.</p>
        <PrintButton />
      </div>

      {/* The poster */}
      <div className="w-full max-w-xl flex flex-col items-center text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-gray-500">{event.org_name}</p>

        {event.cover_emoji ? (
          <p className="text-6xl mt-6" aria-hidden>{event.cover_emoji as string}</p>
        ) : null}

        <h1 className="text-4xl font-bold text-gray-900 mt-4 leading-tight">{event.name}</h1>
        <p className="text-lg text-gray-600 mt-3">{timeLine}</p>
        {locationLine && <p className="text-base text-gray-500 mt-1">{locationLine}</p>}

        <div className="mt-10 mb-8">
          <p className="text-2xl font-semibold text-gray-900">Welcome! Please check in</p>
          <p className="text-lg text-gray-600 mt-1">by scanning this QR code</p>
        </div>

        <div className="border-4 border-gray-900 rounded-3xl p-6 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/events/${id}/qr?size=800`}
            alt="Check-in QR code"
            className="w-72 h-72 sm:w-80 sm:h-80"
          />
        </div>

        <p className="text-sm text-gray-400 mt-10">Powered by Quorum</p>
      </div>
    </div>
  )
}
