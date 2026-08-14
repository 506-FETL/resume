import type { ComponentType, PropsWithChildren, ReactNode } from 'react'
import type { ToolTone } from './types'
import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { TOOL_TONE_CLASS_MAP } from './const'

export type { ToolTone } from './types'

export function ToolPanelCard({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <Card className={cn('min-w-0 border-border/60 bg-card shadow-none', className)}>
      {children}
    </Card>
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
    <CardHeader className="border-b border-border/50 p-4 md:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 gap-3">
          {Icon && (
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="wrap-break-word text-base font-semibold leading-tight">{title}</CardTitle>
              {badge}
            </div>
            {description && <p className="text-sm leading-6 text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action && <div className="w-full shrink-0 lg:w-auto lg:self-start">{action}</div>}
      </div>
    </CardHeader>
  )
}

export function ToolPanelBody({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return <CardContent className={cn('min-w-0 p-4 md:p-5', className)}>{children}</CardContent>
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
    <div className="h-full w-full min-w-0 rounded-lg border border-border/60 bg-muted/10 p-3.5 md:p-4">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', toneClass.icon)}>
            <Icon className="size-4" />
          </div>
        )}
        <p className="min-w-0 text-sm font-medium leading-5 text-muted-foreground">{label}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <p className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{value}</p>
        {badge}
      </div>
      {hint && <p className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function ToolEmptyState({
  description,
  title,
}: {
  description: string
  title: string
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center">
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Sparkles className="size-5" />
      </div>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

export function ToolMetaBadge({
  children,
  tone = 'default',
}: PropsWithChildren<{ tone?: ToolTone }>) {
  const toneClass = TOOL_TONE_CLASS_MAP[tone]

  return (
    <Badge variant="outline" className={cn('rounded-full border', toneClass.badge)}>
      {children}
    </Badge>
  )
}
