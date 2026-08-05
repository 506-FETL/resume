import { PanelLeftClose, PanelLeftOpen, Sparkles } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface AssistantSidebarHeaderProps {
  expanded: boolean
  onToggle: () => void
}

export function AssistantSidebarHeader({ expanded, onToggle }: AssistantSidebarHeaderProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div className="flex h-16 shrink-0 items-center border-b px-3">
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, x: -8 }}
            className="flex min-w-0 flex-1 items-center gap-2.5"
          >
            <div className="flex size-8 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary shadow-xs">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">GResume AI</p>
              <p className="truncate text-[11px] text-muted-foreground">你的求职工作台</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={expanded ? '折叠对话侧栏' : '展开对话侧栏'}
            onClick={onToggle}
          >
            {expanded ? <PanelLeftClose /> : <PanelLeftOpen />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{expanded ? '折叠侧栏' : '展开侧栏'}</TooltipContent>
      </Tooltip>
    </div>
  )
}
