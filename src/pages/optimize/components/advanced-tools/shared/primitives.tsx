import type { ComponentType, PropsWithChildren, ReactNode } from 'react'
import type { ToolTone } from './types'
import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { TOOL_TONE_CLASS_MAP } from './const'

export type { ToolTone } from './types'

export function ToolPanelCard({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <section
      className={cn(
        'min-w-0 space-y-4 border-t border-border/60 pt-5',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function ToolPanelHeader({
  action,
  badge,
  description,
  icon: Icon,
  title,
}: {
  action?: ReactNode
  badge?: ReactNode
  description?: string
  icon?: ComponentType<{ className?: string }>
  title: string
}) {
  return (
    <header>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
        <div className='flex min-w-0 flex-1 gap-3'>
          {Icon && (
            <div className='mt-1 shrink-0 text-muted-foreground'>
              <Icon className='size-4' />
            </div>
          )}
          <div className='min-w-0 flex-1 space-y-1.5'>
            <div className='flex flex-wrap items-center gap-2'>
              <h2 className='wrap-break-word text-base font-semibold leading-6'>
                {title}
              </h2>
              {badge}
            </div>
            {description && (
              <p className='text-sm leading-6 text-muted-foreground'>
                {description}
              </p>
            )}
          </div>
        </div>
        {action && (
          <div className='w-full shrink-0 lg:w-auto lg:self-start'>
            {action}
          </div>
        )}
      </div>
    </header>
  )
}

export function ToolPanelBody({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return <div className={cn('min-w-0 space-y-3', className)}>{children}</div>
}

export function ToolStatsGrid({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        'grid min-w-0 grid-cols-2 gap-x-6 gap-y-5 xl:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function ToolStatCard({
  badge,
  hint,
  icon: Icon,
  label,
  tone = 'default',
  value,
}: {
  badge?: ReactNode
  hint?: string
  icon?: ComponentType<{ className?: string }>
  label: string
  tone?: ToolTone
  value: string | number
}) {
  const toneClass = TOOL_TONE_CLASS_MAP[tone]

  return (
    <div className='h-full w-full min-w-0'>
      <div className='flex min-w-0 items-center gap-2.5'>
        {Icon && (
          <div
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-md',
              toneClass.icon,
            )}
          >
            <Icon className='size-4' />
          </div>
        )}
        <p className='min-w-0 text-sm font-medium leading-5 text-muted-foreground'>
          {label}
        </p>
      </div>
      <div className='mt-2 flex flex-wrap items-end justify-between gap-2'>
        <p className='text-xl font-semibold tracking-tight text-foreground tabular-nums md:text-2xl'>
          {value}
        </p>
        {badge}
      </div>
      {hint && (
        <p className='mt-2 text-xs leading-5 text-muted-foreground'>{hint}</p>
      )}
    </div>
  )
}

export function ToolEmptyState({
  description,
  title,
}: {
  description?: string
  title: string
}) {
  return (
    <div className='flex min-h-40 flex-col items-center justify-center px-4 py-8 text-center'>
      <div className='flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary'>
        <Sparkles className='size-5' />
      </div>
      <p className='mt-3 text-sm font-medium'>{title}</p>
      {description && (
        <p className='mt-2 max-w-xl text-sm leading-6 text-muted-foreground'>
          {description}
        </p>
      )}
    </div>
  )
}

export function ToolMetaBadge({
  children,
  tone = 'default',
}: PropsWithChildren<{ tone?: ToolTone }>) {
  const toneClass = TOOL_TONE_CLASS_MAP[tone]

  return (
    <Badge
      variant='outline'
      className={cn('rounded-full border', toneClass.badge)}
    >
      {children}
    </Badge>
  )
}
