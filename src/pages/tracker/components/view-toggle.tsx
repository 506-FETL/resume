// 视图切换
import type { ViewMode } from '../types'
import { Kanban, List } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ViewToggleProps {
  value: ViewMode
  onModeChange: (value: ViewMode) => void
}

export function ViewToggle({ value, onModeChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border p-1">
      {/* List */}
      <button
        type="button"
        className={cn(
          'inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm transition-colors',
          value === 'list'
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-muted',
        )}
        onClick={() => onModeChange('list')}
      >
        <List className="size-4 mr-1.5" />
        List
      </button>
      {/* Board */}
      <button
        type="button"
        className={cn(
          'inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm transition-colors',
          value === 'board'
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-muted',
        )}
        onClick={() => onModeChange('board')}
      >
        <Kanban className="size-4 mr-1.5" />
        Board
      </button>
    </div>
  )
}
