import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const widths = {
  default: 'max-w-7xl',
  wide: 'max-w-[1600px]',
  narrow: 'max-w-4xl',
}

/** Opt-in application layout. Resume documents and template pages keep their own typography. */
export function PageLayout({ width = 'default', className, ...props }: ComponentProps<'div'> & { width?: keyof typeof widths }) {
  return <div className={cn('mx-auto flex w-full min-w-0 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8', widths[width], className)} {...props} />
}

export function PageHeader({ title, description, actions, children }: { title: string, description?: ReactNode, actions?: ReactNode, children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-2xl leading-8 font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
