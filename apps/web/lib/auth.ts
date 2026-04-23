import { auth } from '@clerk/nextjs/server'
import { sql } from './db'
import { ApiError } from './errors'

export type OrgRole = 'admin' | 'editor'

export interface AuthContext {
  clerkUserId: string
  clerkOrgId: string
  userId: string   // internal UUID
  orgId: string    // internal UUID
  role: OrgRole
}

export async function requireOrgMember(): Promise<AuthContext> {
  const { userId: clerkUserId, orgId: clerkOrgId } = await auth()

  if (!clerkUserId) throw new ApiError(401, 'Unauthorized')
  if (!clerkOrgId) throw new ApiError(403, 'No active organization selected')

  const rows = await sql`
    SELECT
      om.role,
      o.id  AS org_id,
      u.id  AS user_id
    FROM org_members om
    JOIN organizations o ON o.id = om.org_id
    JOIN users u ON u.id = om.user_id
    WHERE o.clerk_org_id  = ${clerkOrgId}
      AND u.clerk_user_id = ${clerkUserId}
    LIMIT 1
  `

  if (!rows[0]) throw new ApiError(403, 'Forbidden')

  return {
    clerkUserId,
    clerkOrgId,
    userId: rows[0].user_id,
    orgId: rows[0].org_id,
    role: rows[0].role as OrgRole,
  }
}

export async function requireAdmin(): Promise<AuthContext> {
  const ctx = await requireOrgMember()
  if (ctx.role !== 'admin') throw new ApiError(403, 'Admin access required')
  return ctx
}
