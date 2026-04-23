'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CalEvent {
  id: string
  name: string
  event_date: string
  effective_end_date: string
  status: string
}

const STATUS_DOT: Record<string, string> = {
  published: 'bg-green-500',
  draft:     'bg-butter-500',
  past:      'bg-stone-400',
}

function startOfMonth(y: number, m: number): Date { return new Date(y, m, 1) }
function daysInMonth(y: number, m: number): number { return new Date(y, m + 1, 0).getDate() }
function formatYMD(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function EventsCalendar({ events }: { events: CalEvent[] }) {
  const now = new Date()
  const [viewYear, setViewYear]   = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth()) // 0-11

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const e of events) {
      // Expand multi-day events across their date range
      const start = e.event_date
      const end = e.effective_end_date || e.event_date
      const sd = new Date(start + 'T00:00:00')
      const ed = new Date(end + 'T00:00:00')
      const d = new Date(sd)
      while (d <= ed) {
        const key = formatYMD(d.getFullYear(), d.getMonth(), d.getDate())
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(e)
        d.setDate(d.getDate() + 1)
      }
    }
    return map
  }, [events])

  const first = startOfMonth(viewYear, viewMonth)
  const totalDays = daysInMonth(viewYear, viewMonth)
  const leadingBlanks = first.getDay() // 0=Sun … 6=Sat
  const cells: Array<{ date: Date | null; ymd: string; isToday: boolean }> = []
  for (let i = 0; i < leadingBlanks; i++) cells.push({ date: null, ymd: '', isToday: false })
  const todayYmd = formatYMD(now.getFullYear(), now.getMonth(), now.getDate())
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(viewYear, viewMonth, d)
    const ymd = formatYMD(viewYear, viewMonth, d)
    cells.push({ date, ymd, isToday: ymd === todayYmd })
  }
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push({ date: null, ymd: '', isToday: false })

  const monthLabel = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const goPrev = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11) }
    else setViewMonth(viewMonth - 1)
  }
  const goNext = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0) }
    else setViewMonth(viewMonth + 1)
  }
  const goToday = () => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()) }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button onClick={goToday} className="px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-stone-50">
            Today
          </button>
          <button onClick={goPrev} aria-label="Previous month" className="p-1.5 text-gray-600 border border-gray-300 rounded-md hover:bg-stone-50">
            <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <button onClick={goNext} aria-label="Next month" className="p-1.5 text-gray-600 border border-gray-300 rounded-md hover:bg-stone-50">
            <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        {/* Weekday header */}
        <div className="grid grid-cols-7 bg-stone-50 border-b border-gray-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="px-2 py-2 text-[11px] uppercase tracking-wide text-gray-500 font-medium">
              {d}
            </div>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((c, i) => {
            if (!c.date) {
              return <div key={i} className="min-h-[90px] sm:min-h-[110px] bg-stone-50/50 border-r border-b border-gray-100" />
            }
            const dayEvents = eventsByDay.get(c.ymd) ?? []
            return (
              <div
                key={i}
                className={`min-h-[90px] sm:min-h-[110px] border-r border-b border-gray-100 p-1.5 ${
                  c.isToday ? 'bg-sage-50/60' : ''
                }`}
              >
                <div className={`text-xs font-medium mb-1 ${c.isToday ? 'text-sage-800' : 'text-gray-500'}`}>
                  {c.date.getDate()}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((e) => (
                    <Link
                      key={`${e.id}-${c.ymd}`}
                      href={`/events/${e.id}`}
                      className="block text-[11px] leading-tight bg-white border border-gray-200 rounded px-1.5 py-1 hover:border-sage-300 hover:shadow-sm"
                    >
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${STATUS_DOT[e.status] ?? 'bg-gray-400'}`} />
                      <span className="text-gray-800">{e.name}</span>
                    </Link>
                  ))}
                  {dayEvents.length > 3 && (
                    <p className="text-[10px] text-gray-400 pl-1.5">+{dayEvents.length - 3} more</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
