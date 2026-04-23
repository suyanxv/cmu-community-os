import { randomBytes } from 'node:crypto'
import { requireAdmin } from '@/lib/auth'
import { sql } from '@/lib/db'
import { errorResponse } from '@/lib/errors'

// 32 hex chars = 128 random bits. Long enough that guessing a valid token is
// computationally infeasible; short enough that the URL stays shareable.
function generateShareToken(): string {
  return randomBytes(16).toString('hex')
}

// Admin-only: create a new share token if none exists, or rotate an existing
// one (invalidating every link that was already distributed).
export async function POST() {
  try {
    const ctx = await requireAdmin()
    const token = generateShareToken()
    const rows = await sql`
      UPDATE organizations
      SET public_share_token = ${token}, updated_at = NOW()
      WHERE id = ${ctx.orgId}
      RETURNING public_share_token
    `
    return Response.json({ data: { token: rows[0].public_share_token } })
  } catch (err) {
    return errorResponse(err)
  }
}

// Disable public sharing.
export async function DELETE() {
  try {
    const ctx = await requireAdmin()
    await sql`
      UPDATE organizations
      SET public_share_token = NULL, updated_at = NOW()
      WHERE id = ${ctx.orgId}
    `
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
