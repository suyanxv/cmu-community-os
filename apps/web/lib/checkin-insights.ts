import type { TemplateField } from '@/lib/ai'

// Heuristics for routing check-in answers into the app instead of letting
// them rot in JSONB: volunteer-interest answers flag the attendee as a
// volunteer prospect; "what events do you want" answers feed the Ideas inbox.

export function isVolunteerField(field: Pick<TemplateField, 'id' | 'label'>): boolean {
  return /volunteer/i.test(field.label) || /volunteer/i.test(field.id)
}

export function isIdeaField(field: Pick<TemplateField, 'id' | 'label'>): boolean {
  if (isVolunteerField(field)) return false
  return /(events?|activit\w+).*(interest|like|want|see|attend|suggest)|(interest|like|want|see|suggest).*(events?|activit\w+)|future events?|next event/i
    .test(field.label)
}

// "Yes! Count me in" → true; "Not right now" / "no thanks" / "maybe" → false.
// Negations are checked first so "not interested" doesn't match "interested".
export function isAffirmative(answer: string): boolean {
  const a = answer.trim().toLowerCase()
  if (!a) return false
  if (/\b(no|not|nope|nah|later|maybe)\b/.test(a)) return false
  return /\b(yes|yeah|yep|sure|ok|okay|interested|absolutely|definitely|count me in|sign me up|i'?m in|why not)\b/.test(a) || a === 'y'
}

interface EventCheckinConfig {
  fields?: TemplateField[]
}

// Field-id → field map for one event's check-in config.
export function fieldsById(config: EventCheckinConfig | null): Map<string, TemplateField> {
  const map = new Map<string, TemplateField>()
  for (const f of config?.fields ?? []) {
    if (f?.id && f?.label) map.set(f.id, f)
  }
  return map
}

// Normalize a raw check_in_data value (string, boolean, or multiselect
// array) to display/classification text.
export function answerText(raw: unknown): string {
  if (Array.isArray(raw)) return raw.map((v) => String(v)).join(', ')
  if (typeof raw === 'boolean') return raw ? 'yes' : 'no'
  return String(raw ?? '')
}
