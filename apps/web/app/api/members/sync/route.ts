import { clerkClient } from '@clerk/nextjs/server'
import { requireAdmin } from '@/lib/auth'
import { sql } from '@/lib/db'
import { errorResponse } from '@/lib/errors'

// Manual backfill: pulls the current Clerk org membership list and upserts
// into local users + org_members. Useful when the webhook wasn't configured
// for a while, when events dropped, or to recover from a race condition.
// Admin-only. Idempotent — safe to run multiple times.
export async function POST() {
  try {
    const ctx = await requireAdmin()
    const client = await clerkClient()

    // Clerk paginates; 100 is the max per request. For an alumni board this
    // is way more than enough, but loop defensively.
    let offset = 0
    const limit = 100
    let imported = 0
    let updated = 0

    while (true) {
      const page = await client.organizations.getOrganizationMembershipList({
        organizationId: ctx.clerkOrgId,
        limit,
        offset,
      })

      for (const membership of page.data) {
        const pud = membership.publicUserData
        if (!pud) continue

        const role = membership.role === 'org:admin' ? 'admin' : 'editor'
        const identifier = pud.identifier ?? ''
        const firstName = pud.firstName ?? ''
        const lastName = pud.lastName ?? ''
        const fullName = [firstName, lastName].filter(Boolean).join(' ') || null
        const imageUrl = pud.imageUrl ?? null
        const email = identifier.includes('@') ? identifier : `${pud.userId}@clerk.local`

        const userResult = await sql`
          INSERT INTO users (clerk_user_id, email, full_name, avatar_url)
          VALUES (${pud.userId}, ${email}, ${fullName}, ${imageUrl})
          ON CONFLICT (clerk_user_id) DO UPDATE
            SET email = COALESCE(NULLIF(EXCLUDED.email, ''), users.email),
                full_name = COALESCE(EXCLUDED.full_name, users.full_name),
                avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url)
          RETURNING id, (xmax = 0) AS inserted
        `

        const memberResult = await sql`
          INSERT INTO org_members (org_id, user_id, role, joined_at)
          VALUES (${ctx.orgId}, ${userResult[0].id}, ${role}, NOW())
          ON CONFLICT (org_id, user_id) DO UPDATE
            SET role = EXCLUDED.role
          RETURNING (xmax = 0) AS inserted
        `

        if (memberResult[0]?.inserted) imported++
        else updated++
      }

      if (page.data.length < limit) break
      offset += limit
    }

    return Response.json({ data: { imported, updated } })
  } catch (err) {
    return errorResponse(err)
  }
}
