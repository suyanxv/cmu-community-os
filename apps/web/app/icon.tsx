import { ImageResponse } from 'next/og'

export const size = { width: 192, height: 192 }
export const contentType = 'image/png'

// Dynamically-rendered PNG used as the PWA icon across Android home screens
// and browser tabs. Sage background, white "Q" — matches the rest of the app.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#547143',
          color: 'white',
          fontSize: 128,
          fontWeight: 700,
          letterSpacing: -4,
          borderRadius: 40,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        Q
      </div>
    ),
    size
  )
}
