import { Archive, ArrowRight, BriefcaseBusiness, FilterX, Plus, RefreshCcw, SearchX, TriangleAlert } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { BOARD_COLUMNS } from '../../const'
import { useTrackerFilterActions } from '../../hooks/use-tracker-filter-actions'
import useTrackerStore from '../../store'

interface TrackerPageStateProps {
  mode: 'empty' | 'archived' | 'filtered' | 'error'
  onRetry: () => void
}

export function TrackerPageState({ mode, onRetry }: TrackerPageStateProps) {
  const { error, openAddDrawer, jobs } = useTrackerStore()
  const { focusSearchInput, clearSearchAndFilters, setShowArchived } = useTrackerFilterActions()
  const hasArchived = jobs.some(job => job.archived)
  const content = {
    empty: { icon: BriefcaseBusiness, title: '从一个心仪的职位开始', description: '记录公司与岗位，把投递、面试和下一步安排放在一起。' },
    archived: { icon: Archive, title: '还没有归档职位', description: '已结束的求职记录可以归档保存，方便以后回顾。' },
    filtered: { icon: SearchX, title: '没有找到匹配的职位', description: '试试其他关键词，或清除筛选条件查看全部职位。' },
    error: { icon: TriangleAlert, title: '职位暂时无法加载', description: error || '请稍后重试。' },
  }[mode]
  const Icon = content.icon

  return (
    <div className="flex min-h-80 flex-1 items-center justify-center px-5 py-12" role={mode === 'error' ? 'alert' : 'status'}>
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="mb-5 flex size-14 items-center justify-center rounded-2xl border bg-background text-muted-foreground shadow-xs"><Icon className="size-6" /></div>
        <h3 className="text-base font-semibold tracking-tight">{content.title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{content.description}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
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
        {mode === 'empty' && (
          <div className="mt-8 flex items-center gap-2 text-[11px] text-muted-foreground/80">
            <span>保存职位</span>
            <ArrowRight className="size-3" />
            <span>记录投递</span>
            <ArrowRight className="size-3" />
            <span>跟进面试</span>
          </div>
        )}
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
