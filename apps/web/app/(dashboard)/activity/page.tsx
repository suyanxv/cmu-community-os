import Link from 'next/link'
import ActivityFeed from '@/components/ActivityFeed'

export default function ActivityPage() {
  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-700 mb-3 block">
        ← Back to Settings
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Activity</h1>
      <p className="text-sm text-gray-500 mb-6">
        Everything board members have done recently — event changes, RSVPs, reminders, content generations.
      </p>
      <ActivityFeed />
    </div>
  )
}
