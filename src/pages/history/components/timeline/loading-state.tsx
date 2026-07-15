import { LoaderCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export default function TimelineLoadingState() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 px-1">
        <Badge variant="secondary" className="w-fit">
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
          正在加载历史版本
        </Badge>
      </div>

      {[0, 1, 2].map(index => (
        <div key={index} className="relative flex flex-col gap-3 border-l border-dashed border-border pl-6">
          <span className="absolute -left-2.25 top-5 size-4 rounded-full border bg-background" />
          <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-8 w-16 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <Skeleton className="h-7 w-44 max-w-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
