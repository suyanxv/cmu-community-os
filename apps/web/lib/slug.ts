import { sql } from '@/lib/db'

// "Annual Summer Beach Picnic 🏖" → "annual-summer-beach-picnic"
export function slugifyEventName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
}

// Globally-unique slug for a new event (public check-in URLs aren't
// org-scoped). Collisions get -2, -3, … suffixes. Returns null when the
// name slugifies to nothing (e.g. emoji-only) — the event then falls back
// to its uuid in URLs.
export async function uniqueEventSlug(name: string): Promise<string | null> {
  const base = slugifyEventName(name)
  if (!base) return null

  const rows = await sql`
    SELECT slug FROM events WHERE slug = ${base} OR slug LIKE ${base + '-%'}
  `
  const taken = new Set(rows.map((r) => r.slug as string))
  if (!taken.has(base)) return base
  for (let i = 2; i < 100; i++) {
    if (!taken.has(`${base}-${i}`)) return `${base}-${i}`
  }
  return `${base}-${Date.now().toString(36)}`
}
