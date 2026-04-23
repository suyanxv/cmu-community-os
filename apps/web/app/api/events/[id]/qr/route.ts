import { NextRequest } from 'next/server'
import QRCode from 'qrcode'
import { requireOrgMember } from '@/lib/auth'
import { sql } from '@/lib/db'
import { ApiError, errorResponse } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

// Returns a PNG of the QR code pointing at the public check-in URL.
// Query params:
//   ?size=500 (pixel size, default 500, max 2000)
//   ?download=1 to force download (adds Content-Disposition)
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireOrgMember()
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const size = Math.min(parseInt(searchParams.get('size') ?? '500'), 2000)
    const download = searchParams.get('download') === '1'

    // Verify event belongs to org
    const rows = await sql`
      SELECT name FROM events WHERE id = ${id} AND org_id = ${ctx.orgId}
    `
    if (!rows[0]) throw new ApiError(404, 'Event not found')
    const eventName = rows[0].name as string

    const origin = process.env.NEXT_PUBLIC_APP_URL
      || `${req.nextUrl.protocol}//${req.nextUrl.host}`
    const checkInUrl = `${origin}/check-in/${id}`

    const png = await QRCode.toBuffer(checkInUrl, {
      width: size,
      margin: 2,
      color: { dark: '#1c1f1a', light: '#ffffff' },
    })

    const filename = `${eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-checkin-qr.png`

    const headers: Record<string, string> = {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600',
    }
    if (download) headers['Content-Disposition'] = `attachment; filename="${filename}"`

    return new Response(new Uint8Array(png), { headers })
  } catch (err) {
    return errorResponse(err)
  }
}
