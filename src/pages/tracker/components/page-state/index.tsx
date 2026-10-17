import { Archive, ArrowRight, BriefcaseBusiness, FilterX, Plus, RefreshCcw, SearchX, TriangleAlert } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { BOARD_COLUMNS } from '../../const'
import { useTrackerFilterActions } from '../../hooks/use-tracker-filter-actions'
import useTrackerStore from '../../store'
import { selectTrackerListJobs } from '../../store/selectors'

interface TrackerPageStateProps {
  mode: 'empty' | 'archived' | 'filtered' | 'error'
  onRetry: () => void
}

export function TrackerPageState({ mode, onRetry }: TrackerPageStateProps) {
  const { error, openAddDrawer, jobs } = useTrackerStore(useShallow(state => ({
    error: state.error,
    openAddDrawer: state.openAddDrawer,
    jobs: selectTrackerListJobs(state),
  })))
  const { focusSearchInput, clearSearchAndFilters, setShowArchived } = useTrackerFilterActions()
  const hasArchived = jobs.some(job => job.archived)
  const content = {
    empty: { icon: BriefcaseBusiness, title: '暂无职位', description: null },
    archived: { icon: Archive, title: '暂无归档职位', description: null },
    filtered: { icon: SearchX, title: '没有找到匹配的职位', description: null },
    error: { icon: TriangleAlert, title: '职位暂时无法加载', description: error || '请稍后重试。' },
  }[mode]
  const Icon = content.icon

  return (
    <div className="flex min-h-44 flex-1 items-center justify-center px-4 py-4 sm:min-h-80 sm:px-5 sm:py-12" role={mode === 'error' ? 'alert' : 'status'}>
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl border bg-background text-muted-foreground shadow-xs sm:mb-5 sm:size-14 sm:rounded-2xl"><Icon className="size-5 sm:size-6" /></div>
        <h3 className="text-base font-semibold tracking-tight">{content.title}</h3>
        {content.description && <p className="mt-2 text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">{content.description}</p>}
        <div className="mt-4 flex flex-wrap justify-center gap-2 sm:mt-6">
          {mode === 'error' && (
            <Button
              variant="outline"
              onClick={() => {
                focusSearchInput()
                onRetry()
              }}
            >
              <RefreshCcw />
              重新加载
            </Button>
          )}
          {mode === 'filtered' && (
            <Button
              variant="outline"
              onClick={clearSearchAndFilters}
            >
              <FilterX />
              清除搜索与筛选
            </Button>
          )}
          {mode === 'archived' && (
            <Button variant="outline" onClick={() => setShowArchived(false)}>
              <ArrowRight />
              返回职位进展
            </Button>
          )}
          {mode === 'empty' && (
            <Button onClick={openAddDrawer}>
              <Plus />
              新增职位
            </Button>
          )}
          {mode === 'empty' && hasArchived && (
            <Button variant="outline" onClick={() => setShowArchived(true)}>
              <Archive />
              查看已归档
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function TrackerSkeleton() {
  const viewMode = useTrackerStore(state => state.viewMode)
  const reduce = useReducedMotion()
  const still = reduce ? 'animate-none' : ''

  return (
    <div role="status" aria-label="正在加载职位" className="flex min-h-80 min-w-0 flex-1 overflow-hidden">
      {viewMode === 'board'
        ? (
            <div className="flex w-full gap-3">
              {BOARD_COLUMNS.slice(0, 5).map(column => (
                <div key={column.status} className="min-w-[232px] flex-1 space-y-4 rounded-xl bg-muted/40 p-3">
                  <Skeleton className={cn('h-4 w-20', still)} />
                  <div className="space-y-3 rounded-xl border bg-card p-4">
                    <Skeleton className={cn('size-8 rounded-lg', still)} />
                    <Skeleton className={cn('h-4 w-3/4', still)} />
                    <Skeleton className={cn('h-3 w-1/2', still)} />
                  </div>
                </div>
              ))}
            </div>
          )
        : (
            <div className="w-full space-y-3">
              {['first', 'second', 'third', 'fourth'].map(key => <Skeleton key={key} className={cn('h-20 w-full rounded-xl', still)} />)}
            </div>
          )}
      <span className="sr-only">正在加载职位</span>
    </div>
  )
}
