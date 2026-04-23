/**
 * Format a YYYY-MM-DD date as a human-readable label without the timezone-shift
 * bug that `new Date("2026-04-22")` causes.
 *
 * Accepts either a string like "2026-04-22" (how our API returns dates, via
 * to_char) or a JS Date object (how the Neon driver returns raw DATE columns
 * via SELECT e.*). Date objects are normalized through toISOString to strip
 * any TZ confusion, since DATE columns have no timezone.
 *
 * new Date("2026-04-22") parses as UTC midnight. In PDT that's Apr 21 17:00,
 * so toLocaleDateString() without a timezone shows "April 21". We construct
 * the Date from local parts instead, guaranteeing the display matches the
 * stored calendar date.
 */
export function formatEventDate(
  dateStr: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
): string {
  if (!dateStr) return ''
  const asIso = dateStr instanceof Date ? dateStr.toISOString() : String(dateStr)
  const clean = asIso.slice(0, 10)
  const [y, m, d] = clean.split('-').map(Number)
  if (!y || !m || !d) return clean
  return new Date(y, m - 1, d).toLocaleDateString('en-US', opts)
}

/** Today as YYYY-MM-DD in the browser's local timezone. */
export function localToday(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
