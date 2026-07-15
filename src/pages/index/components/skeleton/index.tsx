import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const STAT_SKELETON_KEYS = ['stat-1', 'stat-2', 'stat-3', 'stat-4'] as const
const ACTION_SKELETON_KEYS = ['action-1', 'action-2', 'action-3', 'action-4'] as const
const ACTIVITY_SKELETON_KEYS = ['activity-1', 'activity-2', 'activity-3'] as const
const CHART_SKELETON_KEYS = ['chart-1', 'chart-2', 'chart-3'] as const

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      {STAT_SKELETON_KEYS.map(key => (
        <Card key={key}>
          <CardContent className="p-4 md:p-5">
            <div className="flex items-start gap-3">
              <Skeleton className="size-8 rounded-lg shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
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
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-3 w-24" />
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          <div className="grid gap-2.5 grid-cols-2 h-full">
            {ACTION_SKELETON_KEYS.map(key => (
              <Skeleton key={key} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-3 w-24" />
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          <div className="flex flex-col gap-1">
            {ACTIVITY_SKELETON_KEYS.map(key => (
              <div key={key} className="flex items-center gap-3 p-2">
                <Skeleton className="size-9 rounded-lg shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5">
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
      {CHART_SKELETON_KEYS.map(key => (
        <Card key={key} className="h-80">
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
