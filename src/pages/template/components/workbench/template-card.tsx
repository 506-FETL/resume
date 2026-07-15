import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { LoaderCircle, MoreHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { cn } from '@/lib/utils'

interface TemplateCardAction {
  label: string
  onClick: () => void
  variant?: 'default' | 'outline' | 'secondary'
  className?: string
  loading?: boolean
  disabled?: boolean
  icon?: LucideIcon
}

interface TemplateCardProps {
  preview: ReactNode
  tags?: ReactNode
  hoverActions?: TemplateCardAction[]
  title?: string
  description?: string
  meta?: ReactNode
  footerActions?: TemplateCardAction[]
  trailing?: ReactNode
  contentClassName?: string
}

const HOVER_CAPABLE_QUERY = '(hover: hover) and (pointer: fine)'

function getHoverCapability() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.matchMedia(HOVER_CAPABLE_QUERY).matches
}

function useHoverCapability() {
  const [canHover, setCanHover] = useState(getHoverCapability)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia(HOVER_CAPABLE_QUERY)
    const handleChange = () => setCanHover(mediaQuery.matches)
    handleChange()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  return canHover
}

function ActionButton({ action, large = false, fullWidth = false }: { action: TemplateCardAction, large?: boolean, fullWidth?: boolean }) {
  return (
    <Button
      variant={action.variant ?? 'default'}
      size={large ? 'default' : 'sm'}
      className={cn(fullWidth && 'w-full justify-start', action.className)}
      disabled={action.loading || action.disabled}
      onClick={action.onClick}
    >
      {action.icon && <action.icon />}
      {action.loading ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
      {action.label}
    </Button>
  )
}

function MobileActionDrawer({
  actions,
  title,
  description,
}: {
  actions: TemplateCardAction[]
  title?: string
  description?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="justify-between">
          模板操作
          <MoreHorizontal />
        </Button>
      </DrawerTrigger>

      <DrawerContent className="rounded-t-[28px] border-border/70 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <DrawerHeader className="text-left">
          <DrawerTitle>{title ? `${title} · 操作` : '模板操作'}</DrawerTitle>
          <DrawerDescription>{description ?? '选择要执行的操作。'}</DrawerDescription>
        </DrawerHeader>

        <div className="grid gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-1">
          {actions.map(action => (
            <ActionButton
              key={action.label}
              action={{
                ...action,
                className: cn('h-11 rounded-md', action.className),
                onClick: () => {
                  setOpen(false)
                  action.onClick()
                },
              }}
              large
              fullWidth
            />
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

export function TemplateCard({
  preview,
  tags,
  hoverActions,
  title,
  description,
  meta,
  footerActions,
  trailing,
  contentClassName,
}: TemplateCardProps) {
  const canHover = useHoverCapability()

  return (
    <div className="group flex flex-col">
      <div className="relative max-h-80 md:max-h-90 lg:max-h-100 overflow-hidden border rounded-2xl">
        {preview}
        {canHover && hoverActions?.length
          ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/20 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
                <div className="pointer-events-auto flex flex-col items-stretch gap-3">
                  {hoverActions.map(action => (
                    <ActionButton key={action.label} action={action} large />
                  ))}
                </div>
              </div>
            )
          : null}
      </div>

      <div className={cn('flex flex-col gap-2 pt-3', contentClassName)}>
        {title || trailing
          ? (
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  {title ? <h3 className="text-sm font-semibold tracking-tight">{title}</h3> : null}
                  {description ? <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p> : null}
                </div>
                {trailing}
              </div>
            )
          : null}

        {meta ? <div className="text-xs text-muted-foreground">{meta}</div> : null}

        {!canHover && hoverActions?.length
          ? (
              <MobileActionDrawer
                actions={hoverActions}
                title={title}
                description={description}
              />
            )
          : null}

        {footerActions?.length
          ? (
              <div className="flex flex-wrap gap-2">
                {footerActions.map(action => (
                  <ActionButton key={action.label} action={action} />
                ))}
              </div>
            )
          : null}

        {tags ? <div className="flex flex-wrap items-center gap-1.5">{tags}</div> : null}
      </div>
    </div>
  )
}
