import { Shield, Users } from 'lucide-react'

interface PermissionRow {
  capability: string
  roles: ('admin' | 'editor')[]  // who can do it
}

const ROWS: PermissionRow[] = [
  // Events
  { capability: 'Create, edit, duplicate events',         roles: ['admin', 'editor'] },
  { capability: 'Publish / unpublish events',             roles: ['admin', 'editor'] },
  { capability: 'Generate AI content across channels',    roles: ['admin', 'editor'] },
  { capability: 'Delete an event',                        roles: ['admin'] },

  // RSVPs & check-in
  { capability: 'Add, edit, delete RSVPs',                roles: ['admin', 'editor'] },
  { capability: 'Import / export RSVP CSV',               roles: ['admin', 'editor'] },
  { capability: 'Show / download check-in QR + attendance', roles: ['admin', 'editor'] },

  // Partners & communications
  { capability: 'Create or update partners',              roles: ['admin', 'editor'] },
  { capability: 'Log communications, AI email drafts',    roles: ['admin', 'editor'] },
  { capability: 'Delete a partner',                       roles: ['admin'] },

  // Reminders
  { capability: 'Create / edit / complete reminders',     roles: ['admin', 'editor'] },
  { capability: 'Run AI reminder suggestions',            roles: ['admin', 'editor'] },

  // Org config
  { capability: 'Edit own title',                         roles: ['admin', 'editor'] },
  { capability: 'Edit another member\'s title or role',   roles: ['admin'] },
  { capability: 'Remove a member from the org',           roles: ['admin'] },
  { capability: 'Invite new members (via Clerk panel)',   roles: ['admin'] },
  { capability: 'Update organization name / settings',    roles: ['admin'] },
  { capability: 'Configure event form template',          roles: ['admin'] },
  { capability: 'Configure reminder templates',           roles: ['admin'] },
]

export default function PermissionsReference() {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">Roles &amp; Permissions</h2>
        <p className="text-sm text-gray-500 mt-1">
          Every team member is either an <strong>Admin</strong> or an <strong>Editor</strong>. Admins own destructive actions and org-level configuration; editors run the day-to-day.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div className="border border-sage-200 bg-sage-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-sage-700" strokeWidth={1.75} />
            <span className="font-semibold text-sage-800">Admin</span>
          </div>
          <p className="text-xs text-sage-800/80">
            Full control: settings, templates, member management, and deletions. Always need at least one.
          </p>
        </div>
        <div className="border border-gray-200 bg-stone-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-gray-700" strokeWidth={1.75} />
            <span className="font-semibold text-gray-800">Editor</span>
          </div>
          <p className="text-xs text-gray-600">
            Day-to-day event work: creating, editing, generating content, managing RSVPs, partners, and reminders.
          </p>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs uppercase tracking-wide">Capability</th>
              <th className="text-center px-4 py-2.5 font-medium text-gray-600 text-xs uppercase tracking-wide w-24">Admin</th>
              <th className="text-center px-4 py-2.5 font-medium text-gray-600 text-xs uppercase tracking-wide w-24">Editor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ROWS.map((r) => {
              const adminCan = r.roles.includes('admin')
              const editorCan = r.roles.includes('editor')
              return (
                <tr key={r.capability} className="hover:bg-stone-50">
                  <td className="px-4 py-2.5 text-gray-900">{r.capability}</td>
                  <td className="px-4 py-2.5 text-center">
                    {adminCan ? <span className="text-sage-600 font-medium">✓</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {editorCan ? <span className="text-sage-600 font-medium">✓</span> : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Public check-in pages (<code className="bg-stone-100 px-1 py-0.5 rounded">/check-in/…</code>) work without any login — attendees never need a Quorum account.
      </p>
    </div>
  )
}
