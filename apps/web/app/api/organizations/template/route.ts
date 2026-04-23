import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin, requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { parseEventTemplate } from '@/lib/ai'
import { logActivity } from '@/lib/activity'
import { errorResponse } from '@/lib/errors'

const ParseSchema = z.object({
  input: z.string().min(1),
})

const URL_REGEX = /^https?:\/\/[^\s]+$/i

async function fetchUrlContent(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; QuorumFormParser/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  // Strip <script> and <style> tags (but keep their content for form builders
  // that embed field config as JSON in script tags — Claude can pick that up)
  // Only strip external/library scripts; keep inline JSON configs
  const cleaned = html
    .replace(/<link[^>]*>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    // Keep small inline scripts (likely form config), strip large library scripts
    .replace(/<script[^>]*src=["'][^"']*["'][^>]*><\/script>/gi, '')

  // Truncate to 40k chars — Haiku can handle this and we want to find embedded configs
  return cleaned.slice(0, 40000)
}

// Parse pasted form content / URL into a field schema (admin only)
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const { input } = ParseSchema.parse(await req.json())

    let content = input.trim()
    const looksLikeUrl = URL_REGEX.test(content)

    if (looksLikeUrl) {
      try {
        const fetched = await fetchUrlContent(content)
        content = `URL: ${input}\n\nFETCHED CONTENT:\n${fetched}`
      } catch (err) {
        // Fall through — let Claude try with just the URL (may fail, but error message will be clear)
        content = `URL (fetch failed: ${(err as Error).message}): ${input}\n\nThe form URL could not be fetched. Please paste the form fields directly.`
      }
    }

    const fields = await parseEventTemplate(content)
    return Response.json({ data: fields })
  } catch (err) {
    return errorResponse(err)
  }
}

// Save the parsed template schema to org settings (admin only)
const SaveSchema = z.object({
  fields: z.array(z.any()),
})

export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const { fields } = SaveSchema.parse(await req.json())

    await sql`
      UPDATE organizations
      SET settings = jsonb_set(settings, '{event_template_schema}', ${JSON.stringify(fields)}::jsonb),
          updated_at = NOW()
      WHERE id = ${ctx.orgId}
    `

    logActivity({ orgId: ctx.orgId, userId: ctx.userId, entityType: 'event', entityId: ctx.orgId, action: 'updated', detail: { type: 'template', count: fields.length } })
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}

// Clear the template (admin only) — reverts to default form
export async function DELETE() {
  try {
    const ctx = await requireAdmin()
    await sql`
      UPDATE organizations
      SET settings = settings - 'event_template_schema',
          updated_at = NOW()
      WHERE id = ${ctx.orgId}
    `
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}

// Anyone in the org can read the template (used by form renderer)
export async function GET() {
  try {
    const ctx = await requireOrgMember()
    const rows = await sql`
      SELECT settings->'event_template_schema' AS schema
      FROM organizations WHERE id = ${ctx.orgId}
    `
    return Response.json({ data: rows[0]?.schema ?? null })
  } catch (err) {
    return errorResponse(err)
  }
}
