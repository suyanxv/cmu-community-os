import type { MetadataRoute } from 'next'

// PWA manifest. Lets users "Add to Home Screen" on iOS + Android and get a
// standalone, app-like experience (no browser chrome). Icons are generated
// dynamically by app/icon.tsx and app/apple-icon.tsx so they track the brand
// colors without shipping static PNGs.

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Quorum — Community Event OS',
    short_name: 'Quorum',
    description: 'AI-native event management for community organizers.',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fafaf7',
    theme_color: '#547143',
    categories: ['productivity', 'business'],
    icons: [
      {
        src: '/icon',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
