import { sql } from './db'

type EntityType = 'event' | 'partner' | 'reminder' | 'rsvp' | 'member' | 'content' | 'broadcast' | 'idea'
type Action = 'created' | 'updated' | 'deleted' | 'generated' | 'completed' | 'imported' | 'sent' | 'promoted'

export function logActivity(params: {
  orgId: string
  userId: string
  entityType: EntityType
  entityId: string
  action: Action
  detail?: Record<string, unknown>
}): void {
  sql`
    INSERT INTO activity_log (org_id, user_id, entity_type, entity_id, action, detail)
    VALUES (
      ${params.orgId},
      ${params.userId},
      ${params.entityType},
      ${params.entityId},
      ${params.action},
      ${JSON.stringify(params.detail ?? {})}
    )
  `.catch((err) => console.error('logActivity failed:', err))
}
