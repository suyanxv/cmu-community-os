import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import EventForm from '@/components/events/EventForm'
import DynamicEventForm from '@/components/events/DynamicEventForm'
import type { TemplateField } from '@/lib/ai'

export default async function NewEventPage() {
  const { orgId: clerkOrgId } = await auth()
  if (!clerkOrgId) redirect('/sign-in')

  const rows = await sql`
    SELECT settings->'event_template_schema' AS schema
    FROM organizations WHERE clerk_org_id = ${clerkOrgId}
  `
  const schema = rows[0]?.schema as TemplateField[] | null

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Event</h1>
      {schema && schema.length > 0 ? (
        <DynamicEventForm schema={schema} />
      ) : (
        <EventForm />
      )}
    </div>
  )
}
