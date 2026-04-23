import { notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@/lib/db'
import EventForm from '@/components/events/EventForm'
import DynamicEventForm from '@/components/events/DynamicEventForm'
import type { TemplateField } from '@/lib/ai'

const DEFAULT_CHECKIN_FIELDS: TemplateField[] = [
  { id: 'graduation_year', label: 'Graduation Year',            type: 'text', required: false, placeholder: '2020' },
  { id: 'school',          label: 'School / Program',           type: 'text', required: false, placeholder: 'Tepper, SCS, Heinz, …' },
  { id: 'how_heard',       label: 'How did you hear about us?', type: 'text', required: false, placeholder: 'WhatsApp, friend, email…' },
]

type Params = { params: Promise<{ id: string }> }

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

  const templateSchema = event.template_schema as TemplateField[] | null
  const hasTemplate = Array.isArray(templateSchema) && templateSchema.length > 0

  const header = (
    <>
      <Link href={`/events/${id}`} className="text-sm text-gray-500 hover:text-gray-700 mb-2 block">
        ← Back to Event
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Event</h1>
    </>
  )

  if (hasTemplate) {
    const initialCore = {
      name: event.name ?? '',
      event_date: event.event_date ? String(event.event_date).slice(0, 10) : '',
      end_date: event.end_date ? String(event.end_date).slice(0, 10) : '',
      start_time: event.start_time ? String(event.start_time).slice(0, 5) : '',
      end_time: event.end_time ? String(event.end_time).slice(0, 5) : '',
      timezone: event.timezone ?? 'America/Los_Angeles',
      event_mode: (event.event_mode ?? 'in_person') as 'in_person' | 'virtual' | 'hybrid',
      tone: event.tone ?? 'professional-warm',
      channels: (event.channels ?? []) as string[],
      rsvp_link: event.rsvp_link ?? '',
    }
    const initialCustom = (event.custom_fields ?? {}) as Record<string, unknown>

    return (
      <div className="p-4 sm:p-8 max-w-3xl mx-auto">
        {header}
        <DynamicEventForm
          schema={templateSchema!}
          eventId={id}
          initialCore={initialCore}
          initialCustom={initialCustom}
        />
      </div>
    )
  }

  const initialValues = {
    name: event.name ?? '',
    event_date: event.event_date ? String(event.event_date).slice(0, 10) : '',
    end_date: event.end_date ? String(event.end_date).slice(0, 10) : '',
    start_time: event.start_time ? String(event.start_time).slice(0, 5) : '',
    end_time: event.end_time ? String(event.end_time).slice(0, 5) : '',
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
    rsvp_deadline: event.rsvp_deadline ? String(event.rsvp_deadline).slice(0, 10) : '',
    max_capacity: event.max_capacity ? String(event.max_capacity) : '',
    tags: Array.isArray(event.tags) ? event.tags.join(', ') : '',
    notes: event.notes ?? '',
    checkin_whatsapp_url: (event.checkin_config as Record<string, unknown> | null)?.whatsapp_url as string ?? '',
    checkin_welcome_message: (event.checkin_config as Record<string, unknown> | null)?.welcome_message as string ?? '',
    checkin_fields: ((event.checkin_config as { fields?: TemplateField[] } | null)?.fields as TemplateField[] | undefined) ?? DEFAULT_CHECKIN_FIELDS,
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      {header}
      <EventForm initialValues={initialValues} eventId={id} />
    </div>
  )
}
