export interface Organization {
  id: string
  clerk_org_id: string
  name: string
  slug: string
  plan: 'free' | 'pro'
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  clerk_user_id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
}

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: 'admin' | 'editor'
  invited_at: string
  joined_at: string | null
}

export interface Speaker {
  name: string
  title?: string
  bio?: string
  linkedin_url?: string
}

export interface Sponsor {
  name: string
  tier?: string
  logo_url?: string
}

export type EventStatus = 'draft' | 'published' | 'past' | 'archived'
export type EventTone = 'professional-warm' | 'casual' | 'formal'
export type Channel = 'whatsapp' | 'email' | 'instagram' | 'linkedin' | 'luma'

export interface Event {
  id: string
  org_id: string
  created_by: string
  name: string
  status: EventStatus
  event_date: string
  start_time: string
  end_time: string | null
  timezone: string
  location_name: string | null
  location_address: string | null
  location_url: string | null
  is_virtual: boolean
  description: string | null
  speakers: Speaker[] | null
  agenda: string | null
  sponsors: Sponsor[] | null
  tone: EventTone
  target_audience: string | null
  channels: Channel[]
  rsvp_link: string | null
  rsvp_deadline: string | null
  max_capacity: number | null
  tags: string[]
  notes: string | null
  created_at: string
  updated_at: string
}

export interface GeneratedContent {
  id: string
  org_id: string
  event_id: string
  channel: Channel
  version: number
  subject_line: string | null
  body: string
  character_count: number | null
  model: string
  prompt_tokens: number | null
  output_tokens: number | null
  cached: boolean
  approved: boolean
  copied_at: string | null
  created_at: string
}

export type RsvpStatus = 'confirmed' | 'waitlist' | 'cancelled'

export interface Rsvp {
  id: string
  org_id: string
  event_id: string
  name: string
  email: string | null
  phone: string | null
  status: RsvpStatus
  guest_count: number
  check_in_at: string | null
  source: string
  notes: string | null
  created_at: string
  updated_at: string
}

export type PartnerType = 'sponsor' | 'venue' | 'media' | 'other'
export type PartnerStatus = 'prospect' | 'active' | 'past' | 'declined'

export interface Partner {
  id: string
  org_id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  website: string | null
  type: PartnerType
  tier: string | null
  status: PartnerStatus
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface EventPartner {
  id: string
  org_id: string
  event_id: string
  partner_id: string
  role: string | null
  contribution: string | null
  confirmed: boolean
}

export interface PartnerCommunication {
  id: string
  org_id: string
  partner_id: string
  event_id: string | null
  type: 'email' | 'call' | 'meeting' | 'note'
  direction: 'outbound' | 'inbound' | null
  subject: string | null
  body: string
  ai_drafted: boolean
  sent_at: string | null
  created_by: string | null
  created_at: string
}

export type ReminderStatus = 'pending' | 'done' | 'snoozed'
export type ReminderPriority = 'high' | 'medium' | 'low'

export interface Reminder {
  id: string
  org_id: string
  event_id: string | null
  assigned_to: string | null
  title: string
  description: string | null
  due_date: string
  status: ReminderStatus
  completed_at: string | null
  completed_by: string | null
  ai_generated: boolean
  priority: ReminderPriority
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ActivityLog {
  id: string
  org_id: string
  user_id: string | null
  entity_type: string
  entity_id: string | null
  action: string
  detail: Record<string, unknown> | null
  created_at: string
}
