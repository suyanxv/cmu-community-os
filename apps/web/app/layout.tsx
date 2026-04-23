import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'Quorum — Community Event OS',
  description: 'AI-powered event management for community organizers',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full antialiased">
        <body className="min-h-full bg-gray-50 text-gray-900">{children}</body>
      </html>
    </ClerkProvider>
  )
}
