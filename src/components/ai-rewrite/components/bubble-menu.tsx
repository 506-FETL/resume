import type { AnimationDefinition, Variants } from 'motion/react'
import type { RewriteAction } from '../types'
import type { BubbleDisplayMode } from '../utils/bubble-positioning'
import { Ellipsis } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
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
  visible?: boolean
  onAction: (action: RewriteAction) => void
  onFullWidthChange?: (width: number) => void
  onHidden?: () => void
}

export function RewriteBubbleMenu({
  mode,
  measuring = false,
  visible = true,
  onAction,
  onFullWidthChange,
  onHidden,
}: RewriteBubbleMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const measureRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

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

  const variants: Variants = {
    hidden: {
      opacity: 0,
      y: reduceMotion ? 0 : 6,
      scale: reduceMotion ? 1 : 0.96,
      transition: { duration: reduceMotion ? 0 : 0.1, ease: 'easeOut' },
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' },
    },
  }
  const animationState = visible ? 'visible' : 'hidden'
  const handleAnimationComplete = (definition: AnimationDefinition) => {
    if (definition === 'hidden')
      onHidden?.()
  }
  if (measuring) {
    return (
      <div
        ref={measureRef}
        className={cn(
          'tiptap-toolbar',
          'ai-rewrite-bubble-measure-content',
        )}
        data-mode="full"
        data-variant="floating"
      >
        {renderActionButtons()}
      </div>
    )
  }

  if (mode === 'full') {
    return (
      <motion.div
        initial={false}
        animate={animationState}
        variants={variants}
        onAnimationComplete={handleAnimationComplete}
        aria-hidden={!visible}
        inert={!visible}
        className={cn(
          'tiptap-toolbar origin-bottom will-change-transform',
          !visible && 'pointer-events-none',
        )}
        data-mode="full"
        data-variant="floating"
      >
        {renderActionButtons()}
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={false}
      animate={animationState}
      variants={variants}
      onAnimationComplete={handleAnimationComplete}
      aria-hidden={!visible}
      inert={!visible}
      className={cn(
        'tiptap-toolbar origin-bottom will-change-transform',
        !visible && 'pointer-events-none',
      )}
      data-mode="compact"
      data-variant="floating"
    >
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
    </motion.div>
  )
}
