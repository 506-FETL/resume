import type { RewriteAction } from '../types'
import { Button } from '@/components/ui/button'
import { REWRITE_ACTION_LIST, REWRITE_ACTION_META } from '../const'

interface RewriteBubbleMenuProps {
  onAction: (action: RewriteAction) => void
}

export function RewriteBubbleMenu({ onAction }: RewriteBubbleMenuProps) {
  return (
    <div className="tiptap-toolbar" data-variant="floating">
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
            onMouseDown={event => event.preventDefault()}
            onClick={() => onAction(action)}
            className="h-8 gap-1"
          >
            <Icon className="size-4" />
            <span className="text-xs">{meta.label}</span>
          </Button>
        )
      })}
    </div>
  )
}
