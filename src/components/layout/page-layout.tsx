import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** 固定工作区的列表自行滚动，页头和分页共用页面边界。 */
export function PageLayout({
  workspace = false,
  className,
  ...props
}: ComponentProps<'div'> & {
  workspace?: boolean
}) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-(--page-section-gap) px-4 py-6 [--page-section-gap:--spacing(8)] sm:px-6 sm:py-8 lg:px-8 [@media(max-height:500px)]:py-2 [@media(max-height:500px)]:[--page-section-gap:--spacing(2)]',
        workspace && '@container/workspace h-full min-h-0',
        className,
      )}
      {...props}
    />
  )
}

export function PageTitle({ className, ...props }: ComponentProps<'h1'>) {
  return (
    <h1
      className={cn(
        'text-2xl leading-tight font-semibold tracking-tight text-foreground sm:text-[1.75rem]',
        className,
      )}
      {...props}
    />
  )
}

export function PageHeader({
  title,
  description,
  actions,
  children,
  layout = 'stacked',
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  layout?: 'stacked' | 'compact'
}) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-start justify-between gap-x-6 gap-y-4',
        layout === 'compact' &&
          'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-x-4',
      )}
    >
      <div
        className={cn(
          'min-w-0 self-start space-y-1.5',
          layout === 'compact' &&
            'flex flex-wrap items-baseline gap-x-2 gap-y-1 space-y-0',
        )}
      >
        <PageTitle>{title}</PageTitle>
        {description && (
          <p className='text-sm leading-relaxed text-muted-foreground'>
            {description}
          </p>
        )}
        {layout === 'stacked' && children}
      </div>
      {layout === 'compact' && children && (
        <div className='col-span-2 row-start-2 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-1'>
          {children}
        </div>
      )}
      {actions && (
        <div
          className={cn(
            'flex max-w-full flex-wrap items-center gap-2',
            layout === 'compact' && 'col-start-2 row-start-1 lg:col-start-3',
          )}
        >
          {actions}
        </div>
      )}
    </header>
  )
}
