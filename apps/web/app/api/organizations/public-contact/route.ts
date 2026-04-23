import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { sql } from '@/lib/db'
import { errorResponse } from '@/lib/errors'

// Org-level public contact info (name + email) rendered in the footer of
// every public calendar / event page so viewers without a Quorum login can
// actually reach out. Stored inside organizations.settings JSONB under the
// `public_contact` key, via jsonb_set — preserves sibling keys like
// event_template_schema untouched.

const ContactSchema = z.object({
  name: z.string().max(120).optional().nullable(),
  email: z.string().email().optional().nullable(),
})

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const body = await req.json()
    const data = ContactSchema.parse(body)

    // Nothing to save → treat as clear.
    if (!data.name && !data.email) {
      await sql`
        UPDATE organizations
        SET settings = settings - 'public_contact', updated_at = NOW()
        WHERE id = ${ctx.orgId}
      `
      return Response.json({ data: null })
    }

    const payload = { name: data.name ?? null, email: data.email ?? null }
    const rows = await sql`
      UPDATE organizations
      SET settings = jsonb_set(
            COALESCE(settings, '{}'::jsonb),
            '{public_contact}',
            ${JSON.stringify(payload)}::jsonb
          ),
          updated_at = NOW()
      WHERE id = ${ctx.orgId}
      RETURNING settings->'public_contact' AS public_contact
    `
    return Response.json({ data: rows[0]?.public_contact ?? null })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE() {
  try {
    const ctx = await requireAdmin()
    await sql`
      UPDATE organizations
      SET settings = settings - 'public_contact', updated_at = NOW()
      WHERE id = ${ctx.orgId}
    `
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
