'use client'

import { Printer } from 'lucide-react'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 font-medium"
    >
      <Printer className="w-4 h-4" strokeWidth={1.75} /> Print / Save as PDF
    </button>
  )
}
