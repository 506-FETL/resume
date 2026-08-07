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
    <div className="flex h-14 shrink-0 items-center gap-1 px-3">
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, x: -6 }}
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <div className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-3.5" />
            </div>
            <p className="truncate text-sm font-semibold tracking-tight">GResume AI</p>
          </motion.div>
        )}
      </AnimatePresence>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
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
