import Anthropic from '@anthropic-ai/sdk'

let _anthropic: Anthropic | undefined

function getAnthropic() {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set')
    }
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _anthropic
}

export const anthropic = new Proxy({} as Anthropic, {
  get(_target, prop) {
    return Reflect.get(getAnthropic(), prop)
  },
})

export type Channel = 'whatsapp' | 'email' | 'instagram' | 'linkedin' | 'luma'

const CHANNEL_INSTRUCTIONS: Record<Channel, string> = {
  whatsapp: `Generate a WhatsApp announcement message for this event.
Requirements:
- Maximum 1,024 characters
- No markdown formatting (no **, no ##, no -)
- Use line breaks between sections
- Emojis are encouraged to add warmth
- End with the RSVP link if provided
- Casual, warm, community tone
- Include: event name, date/time, location, key highlights, RSVP CTA`,

  email: `Generate an announcement email for this event.
Requirements:
- Return ONLY a JSON object: {"subject": "...", "body": "..."}
- Subject line: compelling, under 60 characters
- Body: professional but warm tone, full HTML-safe formatting using plain text
- Include: event name, date/time, location, agenda highlights, speaker names, RSVP deadline
- End with a clear RSVP call-to-action
- Signature: "Best, [Organization Name] Team"`,

  instagram: `Generate an Instagram caption for this event.
Requirements:
- Maximum 2,200 characters
- Hook in the FIRST line (most important — users see this before "more")
- Engaging, visual language — describe the experience
- 3-5 relevant hashtags at the very end (on their own line)
- Include: event name, date, location, RSVP link
- Community-forward, aspirational tone`,

  linkedin: `Generate a LinkedIn post announcing this event.
Requirements:
- Maximum 3,000 characters (aim for 800-1,200 for best engagement)
- Professional yet approachable tone
- Lead with a compelling hook or question
- Paragraph format (not bullet lists)
- Minimal hashtags: 2-3 max, at the end
- Include: event name, date, speakers/VIPs, what attendees will gain
- End with RSVP link and brief CTA`,

  luma: `Generate an event description for a Luma event listing.
Requirements:
- Maximum 500 characters
- Factual, clear, SEO-friendly
- No fluff — who, what, when, where, why
- End with RSVP info or "Space is limited"
- No emojis`,
}

export interface EventContext {
  name: string
  event_date: string
  end_date?: string | null
  start_time: string
  end_time?: string | null
  timezone: string
  location_name?: string | null
  location_address?: string | null
  location_url?: string | null
  is_virtual: boolean
  event_mode?: 'in_person' | 'virtual' | 'hybrid'
  description?: string | null
  speakers?: Array<{ name: string; title?: string; bio?: string }> | null
  agenda?: string | null
  sponsors?: Array<{ name: string; tier?: string }> | null
  tone: string
  target_audience?: string | null
  rsvp_link?: string | null
  rsvp_deadline?: string | null
  max_capacity?: number | null
  custom_fields?: Record<string, unknown> | null
  org_name: string
}

function buildEventContextXml(event: EventContext): string {
  const speakers = event.speakers?.length
    ? event.speakers.map((s) => `${s.name}${s.title ? ` (${s.title})` : ''}`).join(', ')
    : 'None listed'

  const sponsors = event.sponsors?.length
    ? event.sponsors.map((s) => `${s.name}${s.tier ? ` [${s.tier}]` : ''}`).join(', ')
    : 'None'

  const customLines = event.custom_fields && Object.keys(event.custom_fields).length > 0
    ? '\n' + Object.entries(event.custom_fields)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join('\n')
    : ''

  const modeLabel = event.event_mode === 'virtual' ? 'Virtual' : event.event_mode === 'hybrid' ? 'Hybrid (in-person + virtual)' : 'In-Person'
  const dateRange = event.end_date && event.end_date !== event.event_date
    ? `${event.event_date} – ${event.end_date}`
    : event.event_date

  return `<event_context>
Organization: ${event.org_name}
Event Name: ${event.name}
Date: ${dateRange}
Time: ${event.start_time}${event.end_time ? ` – ${event.end_time}` : ''} ${event.timezone}
Location: ${event.event_mode === 'virtual' ? 'Virtual' : [event.location_name, event.location_address].filter(Boolean).join(', ') || 'TBD'}
Location URL: ${event.location_url || 'N/A'}
Event Mode: ${modeLabel}
Description: ${event.description || 'N/A'}
Speakers / Guests: ${speakers}
Agenda: ${event.agenda || 'N/A'}
Sponsors: ${sponsors}
Tone: ${event.tone}
Target Audience: ${event.target_audience || 'General community members'}
RSVP Link: ${event.rsvp_link || 'N/A'}
RSVP Deadline: ${event.rsvp_deadline || 'N/A'}
Max Capacity: ${event.max_capacity || 'Open'}${customLines}
</event_context>`
}

const SYSTEM_PROMPT_PREFIX = `You are an expert content writer for volunteer-led community organizations (alumni networks, professional associations, clubs). Your writing is warm, specific, and human. You never use generic filler phrases like "Don't miss out!" or "Join us for an exciting event." Every piece of content you write sounds like it was crafted by a real person who cares deeply about their community.

STYLE RULES (strictly enforced):
- NEVER use em-dashes (—) or en-dashes (–). Use commas, periods, parentheses, or "and"/"but"/"or" instead.
- NEVER use the phrase "not only… but also".
- Prefer simple punctuation: commas, periods, colons.
- Avoid AI-giveaway phrases: "delve into", "in today's fast-paced world", "embark on a journey", "leverage", "utilize", "unlock".`

export interface GeneratedChannel {
  channel: Channel
  subject_line: string | null
  body: string
  character_count: number
  prompt_tokens: number
  output_tokens: number
  cached: boolean
}

export async function generateChannelContent(
  event: EventContext,
  channels: Channel[]
): Promise<GeneratedChannel[]> {
  const eventXml = buildEventContextXml(event)
  const systemContent = `${SYSTEM_PROMPT_PREFIX}\n\n${eventXml}`

  const results: GeneratedChannel[] = []

  for (const channel of channels) {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: systemContent,
          // Prompt caching: event context is identical across all channel calls
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: CHANNEL_INSTRUCTIONS[channel],
        },
      ],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
    const usage = message.usage as {
      input_tokens: number
      output_tokens: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
    }

    let subjectLine: string | null = null
    let body = rawText

    if (channel === 'email') {
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          subjectLine = parsed.subject ?? null
          body = parsed.body ?? rawText
        }
      } catch {
        // fallback: use raw text as body
      }
    }

    results.push({
      channel,
      subject_line: subjectLine,
      body,
      character_count: body.length,
      prompt_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cached: (usage.cache_read_input_tokens ?? 0) > 0,
    })
  }

  return results
}

export async function generateReminderSchedule(
  eventName: string,
  eventDate: string,
  channels: string[]
): Promise<Array<{ title: string; description: string; due_date: string; priority: 'high' | 'medium' | 'low' }>> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Generate a reminder schedule for this community event.

Event: ${eventName}
Event Date: ${eventDate}
Channels being used: ${channels.join(', ')}

Return a JSON array of reminder objects. Each object must have:
- title: string (short task name)
- description: string (what to do specifically)
- due_date: string (ISO date, YYYY-MM-DD, relative to event date)
- priority: "high" | "medium" | "low"

Include reminders for: content creation, sending announcements, RSVP reminders, day-of prep, post-event follow-up.
Typical schedule: 3 weeks before (announce), 1 week before (reminder), 3 days before (final push), day before (logistics check), day after (recap/thank you).
Return ONLY the JSON array, no other text.`,
      },
    ],
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text : '[]'
  try {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : []
  } catch {
    return []
  }
}

export async function generatePartnerEmailDraft(params: {
  orgName: string
  partnerCompany: string
  partnerContact?: string | null
  eventName?: string | null
  purpose: string
  tone?: string
}): Promise<{ subject: string; body: string }> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Write a professional email draft for a community organization reaching out to a sponsor/partner.

From: ${params.orgName}
To: ${params.partnerCompany}${params.partnerContact ? ` (${params.partnerContact})` : ''}
${params.eventName ? `Event: ${params.eventName}` : ''}
Purpose: ${params.purpose}
Tone: ${params.tone || 'professional and warm'}

Return ONLY a JSON object: {"subject": "...", "body": "..."}
The body should be 3-4 paragraphs. Sign off as "${params.orgName} Team".`,
      },
    ],
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text : '{}'
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { subject: '', body: rawText }
  } catch {
    return { subject: '', body: rawText }
  }
}

export interface ParsedEvent {
  name: string
  event_date: string | null       // YYYY-MM-DD
  end_date: string | null         // YYYY-MM-DD (null if single-day)
  start_time: string | null       // HH:MM (24h)
  end_time: string | null
  timezone: string                // default from org
  location_name: string | null
  location_address: string | null
  is_virtual: boolean
  event_mode: 'in_person' | 'virtual' | 'hybrid'
  description: string | null
  max_capacity: number | null
  tags: string[]
  is_past: boolean                // computed by Claude based on today's date
  source_line: string | null      // original snippet that produced this event (for user reference)
}

export async function parseBulkEvents(input: string, orgName: string): Promise<ParsedEvent[]> {
  const today = new Date().toISOString().slice(0, 10)

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are parsing event data for the organization "${orgName}" into a structured list.

TODAY'S DATE: ${today}

INPUT (could be CSV with or without headers, a free-text list, or a description):
${input.slice(0, 20000)}

TASK: Extract EVERY event mentioned in the input. Return ONLY a JSON array of objects with this shape:
{
  "name": string,                                   // event title, required
  "event_date": "YYYY-MM-DD" | null,                // start date if known
  "end_date": "YYYY-MM-DD" | null,                  // set only if multi-day
  "start_time": "HH:MM" | null,                     // 24-hour format
  "end_time": "HH:MM" | null,
  "timezone": string,                               // "America/Los_Angeles" unless explicit
  "location_name": string | null,
  "location_address": string | null,
  "is_virtual": boolean,
  "event_mode": "in_person" | "virtual" | "hybrid",
  "description": string | null,                    // keep short, 1-3 sentences
  "max_capacity": number | null,
  "tags": string[],
  "is_past": boolean,                               // true if event_date < ${today}
  "source_line": string                             // quote of the original line/snippet for this event
}

RULES:
- Return an empty array [] if you can't find any events
- Parse any date format into YYYY-MM-DD (e.g. "March 15" → "${today.slice(0, 4)}-03-15"; "last Friday" → resolve relative to TODAY)
- If year is ambiguous, assume the most recent past occurrence if other context implies past, else the upcoming occurrence
- Leave fields null rather than guessing — user will fill them in later
- If a value contains commas (e.g. address), preserve it correctly (don't split)
- For CSV input: auto-detect headers, map columns intelligently to the schema
- Split the input into separate events based on dates, line breaks, or repeating patterns
- is_past: compute from event_date vs TODAY (${today}); if date unknown, assume future
- Keep descriptions concise (1-3 sentences). Do not invent information not in the input.
- tags: extract any topical keywords (e.g. "networking", "speaker", "gala")

Return ONLY the JSON array, no commentary, no markdown code fences.`,
      },
    ],
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text : '[]'
  try {
    const match = rawText.match(/\[[\s\S]*\]/)
    if (!match) return []
    const parsed = JSON.parse(match[0]) as ParsedEvent[]
    return parsed.filter((e): e is ParsedEvent => typeof e?.name === 'string' && e.name.trim().length > 0)
  } catch {
    return []
  }
}

export type TemplateFieldType =
  | 'text' | 'textarea' | 'date' | 'time' | 'email' | 'url' | 'number' | 'select'

export interface TemplateField {
  id: string          // snake_case field id
  label: string       // human-readable label
  type: TemplateFieldType
  required: boolean
  placeholder?: string
  options?: string[]  // for select type
  help?: string       // optional help text
}

export async function parseEventTemplate(input: string): Promise<TemplateField[]> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are parsing a community organization's event intake form into a structured field schema.

The INPUT below may be:
(a) Raw HTML of a form page (may contain embedded JSON config like window.form_data or similar — look for these first, they describe the form precisely)
(b) Plain text / bullet list of field names
(c) A free-form description of what fields are needed
(d) A URL with fetch error — in which case, return [] (empty array)

INPUT:
${input.slice(0, 40000)}

TASK:
Extract EVERY form field. Return ONLY a JSON array of objects:
{
  "id": "snake_case_id",
  "label": "Human Readable Label (from the actual form)",
  "type": "text" | "textarea" | "date" | "time" | "email" | "url" | "number" | "select",
  "required": true | false,
  "placeholder": "hint text if present in form",
  "options": ["opt1", "opt2"],
  "help": "help/description text from form"
}

TYPE MAPPING RULES:
- HTML <input type="text"> / "short_text" / "text" column → "text"
- <textarea> / "long-text" / "long_text" column → "textarea"
- <input type="email"> / "email" column → "email"
- <input type="date"> / "date" column → "date"
- <input type="time"> → "time"
- <input type="url"> / "link" column / URL field → "url"
- <input type="number"> / "numeric" / fields asking for "count", "capacity", "attendance", "limit" → "number"
- <select> / radio buttons / "color" column with labels / "dropdown" → "select" with options from labels
- "timerange" / date range column → split into TWO fields: {id}_start (date) and {id}_end (date)
- "file" / image upload → SKIP (not supported yet)
- "location" → text

EXCLUSION RULES (these are already core fields in Quorum, DO NOT include them):
- Event name / title → core "name"
- Event date / start date → core "event_date"
- End date → core "end_date"
- Start time / end time → core "start_time" / "end_time"
- Timezone → core
- Virtual/in-person/hybrid → core "event_mode"
- Promotional description → core "description"
- Location venue name → core "location_name"
- Location address → core "location_address"
- Virtual meeting URL → core "location_url"
- Registration deadline → core "rsvp_deadline"
- Channels (WhatsApp, Email, etc.) → core "channels"
- Tone → core "tone"

INCLUDE (these are CUSTOM per-org fields):
- Organizer name / contact info
- Network / chapter / hosting group
- Cost / price / fee
- Maximum capacity / desired attendance / ticket limits
- Sponsors / partners / co-hosts
- Speaker roles / hosts
- Accessibility / accommodation notes
- Parking / transportation info
- Venue website
- Detailed program / agenda timing
- Any other custom fields you find

QUALITY RULES:
- Use label text EXACTLY as it appears in the form (strip trailing colons)
- Preserve required flag from form's "mandatory" field or asterisks
- Include all select options (e.g., if there's a 40-city dropdown, include all 40)
- Include help/description text when available
- Limit to 30 fields maximum
- If you can't find any form fields in the input, return []

Return ONLY the JSON array, no other text, no markdown fences, no explanation.`,
      },
    ],
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text : '[]'
  try {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []
    const fields = JSON.parse(jsonMatch[0]) as TemplateField[]
    // Basic validation
    return fields.filter((f): f is TemplateField =>
      typeof f === 'object' &&
      typeof f.id === 'string' &&
      typeof f.label === 'string' &&
      ['text', 'textarea', 'date', 'time', 'email', 'url', 'number', 'select'].includes(f.type)
    )
  } catch {
    return []
  }
}
