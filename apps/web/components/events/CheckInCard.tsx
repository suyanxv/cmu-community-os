'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'

interface CheckInCardProps {
  eventId: string
  checkedInCount: number
  rsvpCount: number
}

export default function CheckInCard({ eventId, checkedInCount, rsvpCount }: CheckInCardProps) {
  const toast = useToast()
  const [qrOpen, setQrOpen] = useState(false)
  const [checkInUrl, setCheckInUrl] = useState<string>('')

  // Compute the URL on mount (client-only) so we don't need origin on server
  const buildUrl = () => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/check-in/${eventId}`
      setCheckInUrl(url)
      return url
    }
    return ''
  }

  const copyLink = async () => {
    const url = checkInUrl || buildUrl()
    await navigator.clipboard.writeText(url)
    toast.success('Check-in link copied')
  }

  const showQr = () => {
    if (!checkInUrl) buildUrl()
    setQrOpen(true)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mt-6">
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Check-in</h2>
          <p className="text-sm text-gray-500 mt-1">
            Attendees scan the QR code to sign in and join the WhatsApp community.
          </p>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-2xl font-bold text-sage-700">{checkedInCount}</p>
            <p className="text-xs text-gray-500">checked in</p>
          </div>
          {rsvpCount > 0 && (
            <div>
              <p className="text-2xl font-bold text-gray-900">{rsvpCount}</p>
              <p className="text-xs text-gray-500">RSVPs</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={showQr}
          className="px-4 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 font-medium"
        >
          📱 Show QR Code
        </button>
        <a
          href={`/api/events/${eventId}/qr?size=1000&download=1`}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50"
        >
          ⬇️ Download QR (PNG)
        </a>
        <button
          onClick={copyLink}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50"
        >
          🔗 Copy Link
        </button>
        <Link
          href={`/events/${eventId}/check-in`}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-stone-50"
        >
          📋 View Attendance
        </Link>
      </div>

      {qrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setQrOpen(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Check-in QR</h3>
                <p className="text-xs text-gray-500 mt-0.5 break-all">{checkInUrl}</p>
              </div>
              <button onClick={() => setQrOpen(false)} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Large QR for scanning directly from screen */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/events/${eventId}/qr?size=600`}
                alt="Check-in QR code"
                className="w-full h-auto"
              />
            </div>

            <div className="flex gap-2 mt-4">
              <a
                href={`/api/events/${eventId}/qr?size=1000&download=1`}
                className="flex-1 bg-sage-600 text-white text-center px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-sage-700"
              >
                Download PNG
              </a>
              <button
                onClick={copyLink}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-stone-50"
              >
                Copy Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
