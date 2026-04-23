import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { sql } from '@/lib/db'

type ClerkEvent = {
  type: string
  data: Record<string, unknown>
}

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) {
    return Response.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const headersList = await headers()
  const svix_id = headersList.get('svix-id')
  const svix_timestamp = headersList.get('svix-timestamp')
  const svix_signature = headersList.get('svix-signature')

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return Response.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const body = await req.text()
  const wh = new Webhook(secret)

  let event: ClerkEvent
  try {
    event = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as ClerkEvent
  } catch {
    return Response.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  const { type, data } = event

  if (type === 'user.created') {
    const email = (data.email_addresses as Array<{ email_address: string }>)?.[0]?.email_address ?? ''
    const firstName = (data.first_name as string) ?? ''
    const lastName = (data.last_name as string) ?? ''
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || null
    const avatarUrl = (data.image_url as string) ?? null

    await sql`
      INSERT INTO users (clerk_user_id, email, full_name, avatar_url)
      VALUES (${data.id as string}, ${email}, ${fullName}, ${avatarUrl})
      ON CONFLICT (clerk_user_id) DO UPDATE
        SET email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            avatar_url = EXCLUDED.avatar_url
    `
  }

  if (type === 'organization.created') {
    const slug = (data.slug as string) || (data.name as string).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    await sql`
      INSERT INTO organizations (clerk_org_id, name, slug)
      VALUES (${data.id as string}, ${data.name as string}, ${slug})
      ON CONFLICT (clerk_org_id) DO UPDATE
        SET name = EXCLUDED.name
    `
  }

  if (type === 'organizationMembership.created') {
    const orgData = data.organization as Record<string, unknown>
    const publicUserData = data.public_user_data as Record<string, unknown>
    const role = (data.role as string) === 'org:admin' ? 'admin' : 'editor'

    // Ensure user row exists (may arrive before user.created in rare cases)
    const userRows = await sql`
      SELECT id FROM users WHERE clerk_user_id = ${publicUserData.user_id as string}
    `
    if (!userRows[0]) return Response.json({ ok: true })

    const orgRows = await sql`
      SELECT id FROM organizations WHERE clerk_org_id = ${orgData.id as string}
    `
    if (!orgRows[0]) return Response.json({ ok: true })

    await sql`
      INSERT INTO org_members (org_id, user_id, role, joined_at)
      VALUES (${orgRows[0].id}, ${userRows[0].id}, ${role}, NOW())
      ON CONFLICT (org_id, user_id) DO UPDATE
        SET role = EXCLUDED.role,
            joined_at = NOW()
    `
  }

  if (type === 'organizationMembership.updated') {
    const orgData = data.organization as Record<string, unknown>
    const publicUserData = data.public_user_data as Record<string, unknown>
    const role = (data.role as string) === 'org:admin' ? 'admin' : 'editor'

    await sql`
      UPDATE org_members om
      SET role = ${role}
      FROM users u, organizations o
      WHERE om.user_id = u.id
        AND om.org_id = o.id
        AND u.clerk_user_id = ${publicUserData.user_id as string}
        AND o.clerk_org_id = ${orgData.id as string}
    `
  }

  if (type === 'organizationMembership.deleted') {
    const orgData = data.organization as Record<string, unknown>
    const publicUserData = data.public_user_data as Record<string, unknown>

    await sql`
      DELETE FROM org_members om
      USING users u, organizations o
      WHERE om.user_id = u.id
        AND om.org_id = o.id
        AND u.clerk_user_id = ${publicUserData.user_id as string}
        AND o.clerk_org_id = ${orgData.id as string}
    `
  }

  return Response.json({ ok: true })
}
