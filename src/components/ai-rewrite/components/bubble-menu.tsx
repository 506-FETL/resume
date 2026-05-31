import type { RewriteAction } from '../types'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { REWRITE_ACTION_LIST, REWRITE_ACTION_META } from '../const'

interface RewriteBubbleMenuProps {
  onAction: (action: RewriteAction) => void
}

export function RewriteBubbleMenu({ onAction }: RewriteBubbleMenuProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.97 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className="tiptap-toolbar origin-bottom will-change-transform"
      data-variant="floating"
    >
      {REWRITE_ACTION_LIST.map((action) => {
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
            className="h-8 gap-1"
          >
            <Icon className="size-4" />
            <span className="text-xs">{meta.label}</span>
          </Button>
        )
      })}
    </motion.div>
  )
}
