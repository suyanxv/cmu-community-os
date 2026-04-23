import { NextRequest } from 'next/server'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { ApiError, errorResponse } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id: eventId } = await params

    // Return latest version per channel
    const content = await sql`
      SELECT DISTINCT ON (channel) *
      FROM generated_content
      WHERE event_id = ${eventId} AND org_id = ${ctx.orgId}
      ORDER BY channel, version DESC
    `

    return Response.json({ data: content })
  } catch (err) {
    return errorResponse(err)
  }
}

// Mark content as copied (track engagement)
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id: eventId } = await params
    const { contentId } = await req.json()

    if (!contentId) throw new ApiError(400, 'contentId required')

    await sql`
      UPDATE generated_content
      SET copied_at = NOW()
      WHERE id = ${contentId} AND event_id = ${eventId} AND org_id = ${ctx.orgId}
    `

    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
