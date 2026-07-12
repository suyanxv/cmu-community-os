import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'Quorum — Community Event OS',
  description: 'AI-powered event management for community organizers',
  applicationName: 'Quorum',
  appleWebApp: {
    capable: true,
    title: 'Quorum',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#547143',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      {/* suppressHydrationWarning: the theme script below may add .dark before React hydrates */}
      <html lang="en" className="h-full antialiased" suppressHydrationWarning>
        <head>
          {/* Apply the stored theme + accent before first paint to avoid a flash */}
          <script
            dangerouslySetInnerHTML={{
              __html: `try{var t=localStorage.getItem('quorum-theme');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}var a=localStorage.getItem('quorum-accent');if(a&&/^[a-z]+$/.test(a)&&a!=='sage'){document.documentElement.classList.add('theme-'+a)}}catch(e){}`,
            }}
          />
        </head>
        <body className="min-h-full bg-stone-50 text-gray-900">{children}</body>
      </html>
    </ClerkProvider>
  )
}
