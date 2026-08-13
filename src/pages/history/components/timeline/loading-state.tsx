import { LoaderCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export default function TimelineLoadingState() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <Badge variant="secondary" className="w-fit">
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
          正在加载历史版本
        </Badge>
      </div>

      {[0, 1, 2].map(index => (
        <div key={index} className="relative flex flex-col gap-2 border-l border-dashed border-border/70 pl-5">
          <span className="absolute -left-1.75 top-4 size-3 rounded-full border bg-background" />
          <div className="rounded-xl border border-border/60 bg-muted/15 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-5 w-22 rounded-full" />
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Skeleton className="h-5 w-36 max-w-full" />
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3.5 w-40 max-w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
