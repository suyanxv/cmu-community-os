import { sql } from './db'

// Keep event_partners (role='co_host') in sync with events.co_hosts (a text[] of names).
//
// This makes the partner detail page's "Events" list reflect co-host links
// without requiring the user to manually add them via EventPartnersSection.
// We only touch rows with role='co_host' so any existing sponsor/venue/media
// links on the same (event, partner) pair stay intact.
//
// Matching is case-insensitive by partner.company_name. If a co_host name
// doesn't resolve to a partner in this org, it's silently skipped (this
// shouldn't happen — the combobox creates the partner before save).
export async function syncEventCoHostLinks(params: {
  orgId: string
  eventId: string
  coHostNames: string[]
}): Promise<void> {
  const { orgId, eventId, coHostNames } = params

  // Resolve each co-host name to a partner id.
  // Lowercased compare handles casing inconsistencies gracefully.
  const names = coHostNames.map((n) => n.trim()).filter(Boolean)
  const resolvedIds: string[] = []
  if (names.length > 0) {
    const lowered = names.map((n) => n.toLowerCase())
    const rows = await sql`
      SELECT id, company_name
      FROM partners
      WHERE org_id = ${orgId}
        AND LOWER(company_name) = ANY(${lowered}::text[])
    `
    for (const r of rows) resolvedIds.push(r.id as string)
  }

  // Upsert co_host links. ON CONFLICT preserves existing rows so a partner
  // already linked as e.g. sponsor on this event keeps that role.
  for (const partnerId of resolvedIds) {
    await sql`
      INSERT INTO event_partners (org_id, event_id, partner_id, role, confirmed)
      VALUES (${orgId}, ${eventId}, ${partnerId}, 'co_host', false)
      ON CONFLICT (event_id, partner_id) DO NOTHING
    `
  }

  // Remove any previously-linked co_host rows that are no longer in the list.
  // Again scoped to role='co_host' — other roles are not our business here.
  if (resolvedIds.length === 0) {
    await sql`
      DELETE FROM event_partners
      WHERE event_id = ${eventId} AND org_id = ${orgId} AND role = 'co_host'
    `
  } else {
    await sql`
      DELETE FROM event_partners
      WHERE event_id = ${eventId} AND org_id = ${orgId} AND role = 'co_host'
        AND partner_id <> ALL(${resolvedIds}::uuid[])
    `
  }
}
