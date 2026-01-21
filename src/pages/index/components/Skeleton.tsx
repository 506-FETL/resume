import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={`stat-${i}`}>
          <CardContent className="p-4 md:p-5">
            <div className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-10" />
              </div>
            </div>
            <Skeleton className="mt-3 h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function EntrySkeleton() {
  return (
    <div className="grid gap-4 grid-cols-1 md:gap-5 md:grid-cols-2">
      {/* Quick Actions */}
      <Card className="flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-3 w-24" />
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          <div className="grid gap-2.5 grid-cols-2 h-full">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-3 w-24" />
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          <div className="space-y-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={`chart-${i}`} className="h-80">
          <CardHeader className="items-center pb-0">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20 mt-1" />
          </CardHeader>
          <CardContent className="pt-4">
            <Skeleton className="h-[180px] w-full rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
