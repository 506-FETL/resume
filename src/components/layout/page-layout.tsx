import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const widths = {
  default: 'max-w-7xl',
  wide: 'max-w-[1600px]',
  narrow: 'max-w-4xl',
}

/** Workspaces own their panel scrolling; short viewports scroll the page as a fallback. */
export function PageLayout({
  width = 'default',
  workspace = false,
  className,
  ...props
}: ComponentProps<'div'> & {
  width?: keyof typeof widths
  workspace?: boolean
}) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full min-w-0 flex-col',
        workspace
          ? '@container/workspace h-full min-h-[30rem] gap-4 p-4 sm:p-6'
          : 'gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8',
        !workspace && widths[width],
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
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className='flex flex-wrap items-start justify-between gap-x-6 gap-y-4'>
      <div className='min-w-0 space-y-1.5'>
        <h1 className='text-2xl leading-tight font-semibold tracking-tight text-foreground sm:text-[1.75rem]'>
          {title}
        </h1>
        {description && (
          <p className='text-sm leading-relaxed text-muted-foreground'>
            {description}
          </p>
        )}
        {children}
      </div>
      {actions && (
        <div className='flex max-w-full flex-wrap items-center gap-2'>
          {actions}
        </div>
      )}
    </header>
  )
}
