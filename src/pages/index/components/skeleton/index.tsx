import type { ReactNode } from 'react'
import { LoadingRegion, PaperSkeleton } from '@/components/loading-skeleton'
import { Skeleton } from '@/components/ui/skeleton'

const TODO_SKELETON_KEYS = ['todo-1', 'todo-2', 'todo-3'] as const

export function TodoSkeleton() {
  return (
    <div className='flex flex-col gap-2.5'>
      {TODO_SKELETON_KEYS.map((key) => (
        <div key={key} className='flex items-center gap-3 border-b py-3'>
          <Skeleton className='size-9 rounded-lg shrink-0' />
          <div className='flex-1 flex flex-col gap-2'>
            <Skeleton className='h-3.5 w-2/5' />
            <Skeleton className='h-2.5 w-3/5' />
          </div>
          <Skeleton className='size-4 rounded' />
        </div>
      ))}
    </div>
  )
}

export function StatSkeleton({
  title,
  icon,
}: {
  title: string
  icon: ReactNode
}) {
  return (
    <LoadingRegion
      label={`正在加载${title}`}
      className='flex h-full min-w-0 flex-col gap-1.5 py-3'
    >
      <div className='flex items-center gap-2'>
        {icon}
        <p className='text-xs font-medium text-muted-foreground'>{title}</p>
      </div>
      <Skeleton className='h-8 w-10' />
      <Skeleton className='h-4 w-24' />
    </LoadingRegion>
  )
}

export function RecentResumesSkeleton() {
  return (
    <LoadingRegion
      label='正在加载最近简历'
      className='grid gap-3 md:grid-cols-2'
    >
      {[0, 1].map((item) => (
        <div
          key={item}
          className='grid min-w-0 grid-cols-[88px_minmax(0,1fr)] overflow-hidden rounded-lg border sm:grid-cols-[120px_minmax(0,1fr)]'
        >
          <div className='bg-muted/25 px-2.5 py-3 sm:px-3.5'>
            <PaperSkeleton compact />
          </div>
          <div className='flex min-w-0 flex-col gap-3 p-3 sm:p-4'>
            <Skeleton className='h-4 w-16' />
            <Skeleton className='h-5 w-3/4' />
            <Skeleton className='h-3 w-1/2' />
            <Skeleton className='mt-auto h-7 w-24' />
          </div>
        </div>
      ))}
    </LoadingRegion>
  )
}

export function TimelineSkeleton() {
  return (
    <LoadingRegion label='正在加载动态' className='space-y-4'>
      {[0, 1, 2].map((item) => (
        <div key={item} className='flex items-start gap-3'>
          <Skeleton className='size-7 shrink-0 rounded-full' />
          <div className='flex-1 space-y-2 py-1'>
            <Skeleton className='h-3.5 w-3/4' />
            <Skeleton className='h-3 w-1/3' />
          </div>
        </div>
      ))}
    </LoadingRegion>
  )
}
