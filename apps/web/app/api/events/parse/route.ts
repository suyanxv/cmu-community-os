import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { parseBulkEvents } from '@/lib/ai'
import { errorResponse } from '@/lib/errors'

// Simple in-memory rate limiter: 10 parses per org per hour (each call uses Sonnet)
const parseLimits = new Map<string, { count: number; resetAt: number }>()
function checkParseLimit(orgId: string): boolean {
  const now = Date.now()
  const limit = parseLimits.get(orgId)
  if (!limit || now > limit.resetAt) {
    parseLimits.set(orgId, { count: 1, resetAt: now + 3_600_000 })
    return true
  }
  if (limit.count >= 10) return false
  limit.count++
  return true
}

const ParseSchema = z.object({
  input: z.string().min(1).max(50_000),
})

function extractUrl(input: string): string | null {
  const trimmed = input.trim()
  // Only treat the input as a URL when it IS a URL (possibly with stray
  // whitespace), not when a URL merely appears inside pasted text.
  if (!/^https?:\/\/\S+$/.test(trimmed)) return null
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

// Crude HTML → text: good enough for event pages (Luma, Eventbrite,
// Partiful, org sites). Claude handles the remaining noise.
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Keep JSON-LD event metadata — many event pages put the real data there
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

async function fetchUrlText(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; QuorumBot/1.0; +https://quorum.events)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) {
      throw new Error(`The page returned ${res.status}. Check the link is public and try again, or paste the event details as text instead.`)
    }
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      throw new Error('That link isn\'t a readable web page. Paste the event details as text instead.')
    }
    const html = await res.text()
    const text = htmlToText(html)
    if (text.length < 40) {
      throw new Error('Couldn\'t read any content from that page (it may require JavaScript or a login). Paste the event details as text instead.')
    }
    return text.slice(0, 30_000)
  } finally {
    clearTimeout(timer)
  }
}

// Parse pasted text or a URL into a single event's fields, for prefilling
// the create-event form. Unlike /api/events/import, this saves nothing.
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireOrgMember()

    if (!checkParseLimit(ctx.orgId)) {
      return Response.json(
        { error: 'Parse limit reached (10/hour). Try again later or fill the form manually.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { input } = ParseSchema.parse(body)

    const url = extractUrl(input)
    let text = input
    if (url) {
      try {
        text = await fetchUrlText(url)
      } catch (err) {
        let message = 'Couldn\'t fetch that link. Paste the event details as text instead.'
        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            message = 'That page took too long to load. Paste the event details as text instead.'
          } else if (err.message === 'fetch failed') {
            // undici's generic network failure (DNS, refused connection, TLS)
            message = 'Couldn\'t reach that link — check the URL, or paste the event details as text instead.'
          } else {
            message = err.message
          }
        }
        return Response.json({ error: message }, { status: 422 })
      }
    }

    const orgRows = await sql`SELECT name FROM organizations WHERE id = ${ctx.orgId}`
    const orgName = (orgRows[0]?.name as string) ?? 'your organization'

    const events = await parseBulkEvents(text, orgName)
    if (events.length === 0) {
      return Response.json(
        { error: url
            ? 'No event details found on that page. Try pasting the event description as text instead.'
            : 'Couldn\'t find event details in that text. Make sure it includes at least an event name and a date.' },
        { status: 422 }
      )
    }

    return Response.json({ data: events[0] })
  } catch (err) {
    return errorResponse(err)
  }
}
