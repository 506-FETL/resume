import { Archive, CheckSquare, Search, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUS_CONFIG, TRACKER_METRIC_LABELS, TRACKER_SEARCH_INPUT_ID } from '../../const'
import { useTrackerFilterActions } from '../../hooks/use-tracker-filter-actions'
import useTrackerStore from '../../store'
import { filterJobs } from '../../utils'
import BatchActions from '../batch-actions'
import { ViewToggle } from '../header/view-toggle'
import FilterMenu from './filter-menu'
import SortMenu from './sort-menu'

export default function TrackerToolbar() {
  const {
    jobs,
    loading,
    error,
    isInitialized,
    viewMode,
    filterStatus,
    metricFilter,
    searchKeyword,
    setSearchKeyword,
    showArchived,
    setShowArchived,
    isSelectMode,
    enterSelectMode,
    exitSelectMode,
  } = useTrackerStore()
  const { clearFilters, clearSearch, setShowArchived: setShowArchivedWithFocus } = useTrackerFilterActions()
  const reduce = useReducedMotion()
  const count = filterJobs(jobs, viewMode === 'list' ? filterStatus : null, searchKeyword, showArchived, viewMode === 'list' ? metricFilter : null).length
  const archivedCount = jobs.filter(job => job.archived).length
  const activeLabel = filterStatus ? APPLICATION_STATUS_CONFIG[filterStatus].label : metricFilter ? TRACKER_METRIC_LABELS[metricFilter] : null
  const busy = loading || (!isInitialized && !error)

  return (
    <div className="shrink-0 border-b px-4 py-4 sm:px-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="text-sm font-semibold sm:text-base">{showArchived ? '已归档职位' : '职位进展'}</h2>
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{busy || error ? '—' : count}</span>
        </div>
        <ViewToggle />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 basis-full sm:max-w-80 sm:flex-1 sm:basis-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={TRACKER_SEARCH_INPUT_ID}
            type="search"
            aria-label="搜索职位"
            value={searchKeyword}
            placeholder="搜索公司、岗位或城市…"
            className="h-9 rounded-lg pl-9 pr-9 shadow-none [&::-webkit-search-cancel-button]:appearance-none"
            onChange={event => setSearchKeyword(event.target.value)}
          />
          <AnimatePresence initial={false}>
            {searchKeyword && (
              <motion.div className="absolute right-1 top-0.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : DURATION.fast }}>
                <Button size="icon-sm" variant="ghost" aria-label="清空搜索" onClick={clearSearch}><X className="size-3.5" /></Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <FilterMenu />
        <AnimatePresence initial={false}>
          {viewMode === 'list' && (
            <motion.div key="sort-menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : DURATION.fast }}><SortMenu /></motion.div>
          )}
        </AnimatePresence>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" className={cn('h-9 gap-1.5 rounded-lg px-2 text-muted-foreground sm:px-3', showArchived && 'bg-muted text-foreground')} aria-pressed={showArchived} onClick={() => setShowArchived(!showArchived)}>
            <Archive className="size-4" />
            <span className="hidden sm:inline">已归档</span>
            <span className="sr-only sm:hidden">已归档</span>
            {archivedCount > 0 && <span className="text-xs tabular-nums">{archivedCount}</span>}
          </Button>
          <Button variant="ghost" size="sm" className={cn('h-9 gap-1.5 rounded-lg px-2 text-muted-foreground sm:px-3', isSelectMode && 'bg-muted text-foreground')} aria-pressed={isSelectMode} aria-label={isSelectMode ? '退出批量管理' : '批量管理'} onClick={isSelectMode ? exitSelectMode : enterSelectMode}>
            <CheckSquare className="size-4" />
            <span className="hidden sm:inline">批量管理</span>
          </Button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {(showArchived || activeLabel) && (
          <motion.div
            key="filter-summary"
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0, transition: { duration: reduce ? 0 : DURATION.fast, ease: EASE.in } }}
            transition={{ duration: reduce ? 0 : DURATION.base, ease: EASE.out }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-2 pt-3 text-xs text-muted-foreground">
              {showArchived && (
                <Button variant="secondary" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setShowArchivedWithFocus(false)}>
                  <Archive className="size-3" />
                  正在查看归档
                  <X className="size-3" />
                  <span className="sr-only">退出归档</span>
                </Button>
              )}
              {activeLabel && (
                <Button variant="secondary" size="sm" className="h-7 gap-1.5 text-xs" onClick={clearFilters}>
                  {viewMode === 'board' ? '定位' : '筛选'}
                  ：
                  {activeLabel}
                  <X className="size-3" />
                  <span className="sr-only">清除条件</span>
                </Button>
              )}
              {viewMode === 'board' && activeLabel && <span>保留完整流程，突出相关阶段</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <BatchActions />
    </div>
  )
}
