import { ImageResponse } from 'next/og'

// iOS "Add to Home Screen" requires 180x180. iOS ignores the rounded corners
// from `border-radius` and applies its own mask, so we fill the whole canvas.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
          fontSize: 120,
          fontWeight: 700,
          letterSpacing: -4,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        Q
      </div>
    ),
    size
  )
}
