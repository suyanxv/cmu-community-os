export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-stone-200 rounded-md animate-pulse ${className}`} />
}

export function CardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="h-4 w-4/5" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
  )
}

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} />)}
    </div>
  )
}

export function TableRowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
          <Skeleton className="h-4 flex-1 max-w-[40%]" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  )
}
