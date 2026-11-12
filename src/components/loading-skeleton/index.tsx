import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { Skeleton } from '@/components/ui/skeleton'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface LoadingRegionProps {
  label: string
  className?: string
  children: ReactNode
}

export function LoadingRegion({
  label,
  className,
  children,
}: LoadingRegionProps) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      role='status'
      aria-busy='true'
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : DURATION.fast, ease: EASE.out }}
      className={className}
    >
      <span className='sr-only'>{label}</span>
      {children}
    </motion.div>
  )
}

interface ContentSkeletonProps {
  label?: string
  className?: string
  rows?: number
}

export function ContentSkeleton({
  label = '正在加载内容',
  className,
  rows = 3,
}: ContentSkeletonProps) {
  return (
    <LoadingRegion label={label} className={cn('space-y-4 p-4', className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className='space-y-2'>
          <Skeleton className='h-4 w-2/5 max-w-48' />
          <Skeleton className='h-3 w-full' />
          <Skeleton className='h-3 w-3/4' />
        </div>
      ))}
    </LoadingRegion>
  )
}

interface PaperSkeletonProps {
  label?: string
  className?: string
  compact?: boolean
}

export function PaperSkeleton({
  label,
  className,
  compact = false,
}: PaperSkeletonProps) {
  return (
    <div
      role={label ? 'status' : undefined}
      aria-hidden={label ? undefined : true}
      className={cn(
        'aspect-[210/297] w-full overflow-hidden bg-background p-[10%]',
        className,
      )}
    >
      {label && <span className='sr-only'>{label}</span>}
      <Skeleton className='mb-[8%] h-[4%] min-h-1 w-2/5 rounded-sm' />
      <Skeleton className='mb-[12%] h-[2%] min-h-0.5 w-3/5 rounded-sm' />
      {Array.from({ length: compact ? 2 : 3 }, (_, index) => (
        <div key={index} className='mb-[10%] space-y-[5%]'>
          <Skeleton className='h-1.5 w-1/4 rounded-sm' />
          <Skeleton className='h-1 w-full rounded-sm' />
          <Skeleton className='h-1 w-4/5 rounded-sm' />
        </div>
      ))}
    </div>
  )
}

export function FormSkeleton({
  label = '正在加载表单',
  className,
  rows = 3,
}: ContentSkeletonProps) {
  return (
    <LoadingRegion label={label} className={cn('space-y-5 p-4', className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className='space-y-2'>
          <Skeleton className='h-3 w-20' />
          <Skeleton className='h-9 w-full' />
        </div>
      ))}
    </LoadingRegion>
  )
}
