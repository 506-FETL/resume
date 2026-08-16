import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const TODO_SKELETON_KEYS = ['todo-1', 'todo-2', 'todo-3'] as const

export function TodoSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {TODO_SKELETON_KEYS.map(key => (
        <div key={key} className="flex items-center gap-3 rounded-lg border p-3">
          <Skeleton className="size-9 rounded-lg shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-2.5 w-3/5" />
          </div>
          <Skeleton className="size-4 rounded" />
        </div>
      ))}
    </div>
  )
}

export function StatSkeleton() {
  return (
    <Card>
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
  )
}
