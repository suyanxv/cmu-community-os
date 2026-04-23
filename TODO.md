# Quorum — Action Items

## Phase 2 (post-MVP)

### Image/File Upload for Events
**Status:** Not started
**Why:** CMU Alumni Network form requires event images (.jpg/.png, 800x600+) for marketing.
Currently no way to attach images to events.
**Approach options:**
- Vercel Blob (simplest, integrated with Vercel deployment)
- Cloudinary (better image optimization + free tier)
- S3 (most control, most setup)
**Scope:**
- Add `event_images` JSONB column to events OR separate `event_assets` table
- File upload component in EventForm + DynamicEventForm
- Storage adapter layer in `lib/storage.ts`
- Include image URLs in AI content generation context (e.g., Instagram suggestions)
- Allow image per speaker, per sponsor
- Validation: 800x600+, .jpg/.png only
**Estimate:** ~3 hours

### Direct API Integrations (from original PRD)
- SendGrid for email blasts
- WhatsApp Business API for direct sending
- Meta Graph API for Instagram posting
- LinkedIn API for scheduled posts
- Luma API for event creation

### Member-Facing Event Pages
Public event detail pages + RSVP form that members can visit without Clerk auth.

### Automated Reminder Notifications
Cron job that sends email notifications when reminders come due.

### Event Templates (Save as Template)
Let organizers save past events as reusable templates (monthly happy hour, annual gala).

### Analytics
Attendance trends, channel engagement metrics, partner engagement history.
