import type { RewriteAction } from '../types'
import type { BubbleDisplayMode } from '../utils/bubble-positioning'
import { Ellipsis } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { REWRITE_ACTION_LIST, REWRITE_ACTION_META } from '../const'

interface RewriteBubbleMenuProps {
  mode: Exclude<BubbleDisplayMode, 'hidden'>
  measuring?: boolean
  onAction: (action: RewriteAction) => void
  onFullWidthChange?: (width: number) => void
}

export function RewriteBubbleMenu({
  mode,
  measuring = false,
  onAction,
  onFullWidthChange,
}: RewriteBubbleMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const measureRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = measureRef.current
    if (!measuring || !element || !onFullWidthChange)
      return

    const reportWidth = () => {
      onFullWidthChange(element.getBoundingClientRect().width)
    }
    const observer = new ResizeObserver(reportWidth)
    observer.observe(element)
    reportWidth()

    return () => observer.disconnect()
  }, [measuring, onFullWidthChange])

  const renderActionButtons = () => REWRITE_ACTION_LIST.map((action) => {
    const meta = REWRITE_ACTION_META[action]
    const Icon = meta.icon

    return (
      <Button
        key={action}
        type="button"
        size="sm"
        variant="ghost"
        title={meta.description}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0)
            return

          event.preventDefault()
          onAction(action)
        }}
        onClick={(event) => {
          if (event.detail === 0)
            onAction(action)
        }}
      >
        <Icon data-icon="inline-start" />
        <span>{meta.label}</span>
      </Button>
    )
  })

  if (measuring || mode === 'full') {
    return (
      <div
        ref={measuring ? measureRef : undefined}
        className={cn(
          'tiptap-toolbar',
          measuring && 'ai-rewrite-bubble-measure-content',
        )}
        data-variant="floating"
      >
        {renderActionButtons()}
      </div>
    )
  }

  return (
    <div className="tiptap-toolbar" data-variant="floating">
      <DropdownMenu
        modal={false}
        open={menuOpen}
        onOpenChange={setMenuOpen}
      >
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="更多 AI 改写操作"
          >
            <Ellipsis data-icon="inline-start" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" sideOffset={6}>
          <DropdownMenuGroup>
            {REWRITE_ACTION_LIST.map((action) => {
              const meta = REWRITE_ACTION_META[action]
              const Icon = meta.icon

              return (
                <DropdownMenuItem
                  key={action}
                  onSelect={(event) => {
                    event.preventDefault()
                    onAction(action)
                    setMenuOpen(false)
                  }}
                >
                  <Icon data-icon="inline-start" />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span>{meta.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {meta.description}
                    </span>
                  </span>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
