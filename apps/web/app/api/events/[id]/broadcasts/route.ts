import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { ApiError, errorResponse } from '@/lib/errors'
import { logActivity } from '@/lib/activity'
import { sendEmail } from '@/lib/email'

type Params = { params: Promise<{ id: string }> }

const CreateBroadcastSchema = z.object({
  channel: z.enum(['email', 'whatsapp']),
  kind: z.enum(['announcement', 'reminder', 'thank_you', 'custom']),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().min(1).max(20000),
  audience_type: z.enum(['confirmed_rsvps', 'all_rsvps', 'partners', 'individual', 'custom_list']),
  // For audience_type === 'individual' or 'custom_list' the caller passes the rsvp/partner ids.
  audience_ids: z.array(z.string().uuid()).optional().default([]),
  // Optional "reply-to" override for email (defaults to org from-address otherwise).
  reply_to: z.string().email().optional().nullable(),
  // Sender display name (email only). When omitted falls back to RESEND_FROM_NAME env.
  from_name: z.string().optional().nullable(),
})

interface Recipient {
  email: string
  name: string | null
  rsvp_id: string | null
  partner_id: string | null
}

async function resolveEmailRecipients(
  orgId: string,
  eventId: string,
  audienceType: string,
  audienceIds: string[]
): Promise<Recipient[]> {
  if (audienceType === 'confirmed_rsvps' || audienceType === 'all_rsvps') {
    const statusFilter = audienceType === 'confirmed_rsvps' ? 'confirmed' : null
    const rows = await sql`
      SELECT id, email, name
      FROM rsvps
      WHERE event_id = ${eventId} AND org_id = ${orgId}
        AND email IS NOT NULL AND email <> ''
        ${statusFilter ? sql`AND status = ${statusFilter}` : sql``}
      ORDER BY created_at DESC
    `
    return rows.map((r): Recipient => ({
      email: r.email as string,
      name: (r.name as string) ?? null,
      rsvp_id: r.id as string,
      partner_id: null,
    }))
  }
  if (audienceType === 'partners') {
    const rows = await sql`
      SELECT p.id, p.email, COALESCE(p.contact_name, p.company_name) AS name
      FROM partners p
      JOIN event_partners ep ON ep.partner_id = p.id
      WHERE ep.event_id = ${eventId}
        AND p.org_id = ${orgId}
        AND p.email IS NOT NULL AND p.email <> ''
    `
    return rows.map((r): Recipient => ({
      email: r.email as string,
      name: (r.name as string) ?? null,
      rsvp_id: null,
      partner_id: r.id as string,
    }))
  }
  if (audienceType === 'individual' || audienceType === 'custom_list') {
    if (audienceIds.length === 0) return []
    // ids can be rsvp ids or partner ids — try both, dedup by email
    const rsvpRows = await sql`
      SELECT id, email, name FROM rsvps
      WHERE org_id = ${orgId}
        AND id = ANY(${audienceIds}::uuid[])
        AND email IS NOT NULL AND email <> ''
    `
    const partnerRows = await sql`
      SELECT id, email, COALESCE(contact_name, company_name) AS name FROM partners
      WHERE org_id = ${orgId}
        AND id = ANY(${audienceIds}::uuid[])
        AND email IS NOT NULL AND email <> ''
    `
    const seen = new Set<string>()
    const out: Recipient[] = []
    for (const r of rsvpRows) {
      const em = (r.email as string).toLowerCase()
      if (seen.has(em)) continue
      seen.add(em)
      out.push({ email: r.email as string, name: (r.name as string) ?? null, rsvp_id: r.id as string, partner_id: null })
    }
    for (const p of partnerRows) {
      const em = (p.email as string).toLowerCase()
      if (seen.has(em)) continue
      seen.add(em)
      out.push({ email: p.email as string, name: (p.name as string) ?? null, rsvp_id: null, partner_id: p.id as string })
    }
    return out
  }
  return []
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id: eventId } = await params
    const { searchParams } = new URL(req.url)
    const preview = searchParams.get('preview')

    if (preview) {
      // Preview an audience: return count + first 10 recipients.
      const audienceType = searchParams.get('audience_type') ?? 'confirmed_rsvps'
      const ids = (searchParams.get('audience_ids') ?? '').split(',').filter(Boolean)
      const recipients = await resolveEmailRecipients(ctx.orgId, eventId, audienceType, ids)
      return Response.json({
        data: {
          count: recipients.length,
          sample: recipients.slice(0, 10),
        },
      })
    }

    const rows = await sql`
      SELECT b.*,
        u.full_name AS sent_by_name,
        u.email AS sent_by_email
      FROM broadcasts b
      LEFT JOIN users u ON u.id = b.sent_by
      WHERE b.event_id = ${eventId} AND b.org_id = ${ctx.orgId}
      ORDER BY COALESCE(b.sent_at, b.created_at) DESC
    `
    return Response.json({ data: rows })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id: eventId } = await params

    // Verify the event exists and belongs to the org.
    const eventRows = await sql`SELECT id, name FROM events WHERE id = ${eventId} AND org_id = ${ctx.orgId}`
    if (!eventRows[0]) throw new ApiError(404, 'Event not found')

    const body = await req.json()
    const data = CreateBroadcastSchema.parse(body)

    // -------- WhatsApp: record-only (user sends via their own WhatsApp) --------
    if (data.channel === 'whatsapp') {
      const rows = await sql`
        INSERT INTO broadcasts (
          org_id, event_id, channel, kind, subject, body,
          audience_type, audience_ids, recipient_count, success_count,
          status, sent_at, sent_by
        ) VALUES (
          ${ctx.orgId}, ${eventId}, 'whatsapp', ${data.kind}, ${data.subject ?? null}, ${data.body},
          ${data.audience_type}, ${data.audience_ids}::uuid[], 0, 0,
          'sent', NOW(), ${ctx.userId}
        )
        RETURNING *
      `
      logActivity({
        orgId: ctx.orgId, userId: ctx.userId,
        entityType: 'broadcast', entityId: rows[0].id as string,
        action: 'sent', detail: { channel: 'whatsapp', kind: data.kind, event: eventRows[0].name },
      })
      return Response.json({ data: rows[0] }, { status: 201 })
    }

    // -------- Email: resolve recipients, send via Resend, record each delivery --------
    if (!data.subject || data.subject.trim().length === 0) {
      throw new ApiError(400, 'Subject is required for email broadcasts')
    }

    const recipients = await resolveEmailRecipients(ctx.orgId, eventId, data.audience_type, data.audience_ids)
    if (recipients.length === 0) {
      throw new ApiError(400, 'No recipients found for the selected audience')
    }

    const broadcastRows = await sql`
      INSERT INTO broadcasts (
        org_id, event_id, channel, kind, subject, body,
        audience_type, audience_ids, recipient_count, status, sent_by
      ) VALUES (
        ${ctx.orgId}, ${eventId}, 'email', ${data.kind}, ${data.subject}, ${data.body},
        ${data.audience_type}, ${data.audience_ids}::uuid[], ${recipients.length}, 'sending', ${ctx.userId}
      )
      RETURNING *
    `
    const broadcastId = broadcastRows[0].id as string

    let success = 0
    let failure = 0
    for (const rcp of recipients) {
      const personalizedSubject = data.subject
      const personalizedBody = rcp.name
        ? data.body.replace(/\{\{\s*name\s*\}\}/gi, rcp.name)
        : data.body.replace(/\{\{\s*name\s*\}\}/gi, 'there')

      const result = await sendEmail({
        to: rcp.email,
        subject: personalizedSubject,
        text: personalizedBody,
        replyTo: data.reply_to ?? null,
        fromName: data.from_name ?? null,
      })

      if (result.ok) {
        success++
        await sql`
          INSERT INTO email_deliveries (
            broadcast_id, recipient_email, recipient_name, rsvp_id, partner_id,
            resend_email_id, status, sent_at
          ) VALUES (
            ${broadcastId}, ${rcp.email}, ${rcp.name}, ${rcp.rsvp_id}, ${rcp.partner_id},
            ${result.id ?? null}, 'sent', NOW()
          )
        `
      } else {
        failure++
        await sql`
          INSERT INTO email_deliveries (
            broadcast_id, recipient_email, recipient_name, rsvp_id, partner_id,
            status, error
          ) VALUES (
            ${broadcastId}, ${rcp.email}, ${rcp.name}, ${rcp.rsvp_id}, ${rcp.partner_id},
            'failed', ${result.error ?? 'unknown'}
          )
        `
      }
    }

    const finalStatus = failure === recipients.length ? 'failed' : 'sent'
    const updated = await sql`
      UPDATE broadcasts
      SET status = ${finalStatus}, success_count = ${success}, failure_count = ${failure},
          sent_at = NOW(), updated_at = NOW()
      WHERE id = ${broadcastId}
      RETURNING *
    `

    logActivity({
      orgId: ctx.orgId, userId: ctx.userId,
      entityType: 'broadcast', entityId: broadcastId,
      action: 'sent',
      detail: { channel: 'email', kind: data.kind, event: eventRows[0].name, success, failure },
    })

    return Response.json({ data: updated[0] }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
