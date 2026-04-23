import { OrganizationProfile } from '@clerk/nextjs'

export default function SettingsPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      <OrganizationProfile routing="hash" />
    </div>
  )
}
