import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import IdeasBoard from '@/components/ideas/IdeasBoard'

async function getOrgId(clerkOrgId: string): Promise<string | null> {
  const rows = await sql`SELECT id FROM organizations WHERE clerk_org_id = ${clerkOrgId}`
  return rows[0]?.id ?? null
}

export default async function IdeasPage() {
  const { orgId: clerkOrgId } = await auth()
  if (!clerkOrgId) redirect('/sign-in')
  const orgId = await getOrgId(clerkOrgId)
  if (!orgId) return null

  let ideas: Array<Record<string, unknown>> = []
  try {
    ideas = await sql`
      SELECT
        i.*,
        u.full_name AS created_by_name,
        e.id AS event_id, e.name AS event_name, e.status AS event_status
      FROM event_ideas i
      LEFT JOIN users u ON u.id = i.created_by
      LEFT JOIN events e ON e.id = i.converted_event_id
      WHERE i.org_id = ${orgId}
      ORDER BY
        CASE i.status WHEN 'open' THEN 0 WHEN 'planning' THEN 1 WHEN 'promoted' THEN 2 ELSE 3 END,
        i.updated_at DESC
    `
  } catch {
    // Migration 010 not yet applied — render empty state.
    ideas = []
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <IdeasBoard initialIdeas={JSON.parse(JSON.stringify(ideas))} />
    </div>
  )
}
