import type { ViewMode } from '../../types'
import { Kanban, List } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import useTrackerStore from '../../store'

export function ViewToggle() {
  const { viewMode, setViewMode } = useTrackerStore(useShallow(state => ({
    viewMode: state.viewMode,
    setViewMode: state.setViewMode,
  })))

  return (
    <Tabs
      value={viewMode}
      className="shrink-0"
      onValueChange={(value) => {
        if (value)
          setViewMode(value as ViewMode)
      }}
    >
      <TabsList className="h-9 rounded-lg bg-muted/70 p-1">
        <TabsTrigger value="list" aria-label="切换到列表视图" className="gap-1.5">
          <List data-icon="inline-start" />
          列表
        </TabsTrigger>
        <TabsTrigger value="board" aria-label="切换到看板视图" className="gap-1.5">
          <Kanban data-icon="inline-start" />
          看板
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
