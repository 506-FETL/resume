import { Archive, CheckSquare, MoreHorizontal, Search, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useShallow } from 'zustand/react/shallow'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useIsMobile } from '@/hooks/use-mobile'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import {
  APPLICATION_STATUS_CONFIG,
  TRACKER_METRIC_LABELS,
  TRACKER_SEARCH_INPUT_ID,
} from '../../const'
import { useTrackerFilterActions } from '../../hooks/use-tracker-filter-actions'
import useTrackerStore from '../../store'
import { selectTrackerListJobs } from '../../store/selectors'
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
  } = useTrackerStore(
    useShallow((state) => ({
      jobs: selectTrackerListJobs(state),
      loading: state.loading,
      error: state.error,
      isInitialized: state.isInitialized,
      viewMode: state.viewMode,
      filterStatus: state.filterStatus,
      metricFilter: state.metricFilter,
      searchKeyword: state.searchKeyword,
      setSearchKeyword: state.setSearchKeyword,
      showArchived: state.showArchived,
      setShowArchived: state.setShowArchived,
      isSelectMode: state.isSelectMode,
      enterSelectMode: state.enterSelectMode,
      exitSelectMode: state.exitSelectMode,
    })),
  )

  const {
    clearFilters,
    clearSearch,
    setShowArchived: setShowArchivedWithFocus,
  } = useTrackerFilterActions()

  const reduce = useReducedMotion()
  const isMobile = useIsMobile(640)

  const count = filterJobs(
    jobs,
    viewMode === 'list' ? filterStatus : null,
    searchKeyword,
    showArchived,
    viewMode === 'list' ? metricFilter : null,
  ).length

  const archivedCount = jobs.filter((job) => job.archived).length

  const activeLabel = filterStatus
    ? APPLICATION_STATUS_CONFIG[filterStatus].label
    : metricFilter
      ? TRACKER_METRIC_LABELS[metricFilter]
      : null

  const busy = loading || (!isInitialized && !error)

  return (
    <div className='shrink-0 border-b px-3 py-2'>
      <div className='flex flex-col gap-2 @min-[980px]/tracker:flex-row @min-[980px]/tracker:items-center @min-[980px]/tracker:gap-3'>
        <div className='flex shrink-0 items-center justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-2.5'>
            <h2 className='text-sm font-semibold sm:text-base'>
              {showArchived ? '已归档职位' : '职位进展'}
            </h2>
            <span className='rounded-md bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground'>
              {busy || error ? '—' : count}
            </span>
          </div>
          <ViewToggle />
        </div>
        <div className='flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:gap-2'>
          <div className='relative min-w-12 flex-1 @min-[980px]/tracker:max-w-sm'>
            <Search className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              id={TRACKER_SEARCH_INPUT_ID}
              type='search'
              aria-label='搜索职位'
              value={searchKeyword}
              placeholder='搜索职位…'
              className='rounded-lg pl-9 pr-9 shadow-none [&::-webkit-search-cancel-button]:appearance-none'
              onChange={(event) => setSearchKeyword(event.target.value)}
            />
            <AnimatePresence initial={false}>
              {searchKeyword && (
                <motion.div
                  className='absolute right-1 top-0.5'
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduce ? 0 : DURATION.fast }}
                >
                  <Button
                    size='icon-sm'
                    variant='ghost'
                    aria-label='清空搜索'
                    onClick={clearSearch}
                  >
                    <X className='size-3.5' />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <FilterMenu mobile={isMobile} />
          <AnimatePresence initial={false}>
            {activeLabel && (
              <PresenceDiv
                key='active-filter'
                initial={reduce ? false : { opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{
                  opacity: 0,
                  width: 0,
                  transition: {
                    duration: reduce ? 0 : DURATION.fast,
                    ease: EASE.in,
                  },
                }}
                transition={{
                  duration: reduce ? 0 : DURATION.base,
                  ease: EASE.out,
                }}
                className='shrink-0 overflow-hidden'
              >
                <Button
                  variant='secondary'
                  size='sm'
                  className='h-8 gap-1.5 whitespace-nowrap text-xs'
                  onClick={clearFilters}
                  aria-label={`清除${viewMode === 'board' ? '定位' : '筛选'}：${activeLabel}`}
                >
                  <span className='hidden sm:inline'>
                    {viewMode === 'board' ? '定位' : '筛选'}：
                  </span>
                  {activeLabel}
                  <X className='size-3' />
                </Button>
              </PresenceDiv>
            )}
            {showArchived && (
              <PresenceDiv
                key='archive-filter'
                initial={reduce ? false : { opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{
                  opacity: 0,
                  width: 0,
                  transition: {
                    duration: reduce ? 0 : DURATION.fast,
                    ease: EASE.in,
                  },
                }}
                transition={{
                  duration: reduce ? 0 : DURATION.base,
                  ease: EASE.out,
                }}
                className='shrink-0 overflow-hidden'
              >
                <Button
                  variant='secondary'
                  size='sm'
                  className='h-8 gap-1.5 whitespace-nowrap text-xs'
                  aria-label='退出归档视图'
                  onClick={() => setShowArchivedWithFocus(false)}
                >
                  <Archive className='size-3' />
                  <span className='hidden sm:inline'>正在查看归档</span>
                  <span className='sm:hidden'>已归档</span>
                  <X className='size-3' />
                </Button>
              </PresenceDiv>
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {!isMobile && viewMode === 'list' && (
              <motion.div
                key='sort-menu'
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : DURATION.fast }}
              >
                <SortMenu />
              </motion.div>
            )}
          </AnimatePresence>
          <div className='ml-auto shrink-0 @min-[620px]/tracker:hidden'>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  aria-label='职位工具'
                  className={cn(
                    'size-9',
                    (showArchived || isSelectMode) && 'bg-muted',
                  )}
                >
                  <MoreHorizontal className='size-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align='end'
                style={{
                  animationDuration: `${reduce ? 0 : DURATION.base}s`,
                  animationTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
                }}
              >
                <DropdownMenuItem
                  onSelect={() => setShowArchived(!showArchived)}
                >
                  <Archive className='size-4' />
                  {showArchived ? '返回在办职位' : `已归档（${archivedCount}）`}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={isSelectMode ? exitSelectMode : enterSelectMode}
                >
                  <CheckSquare className='size-4' />
                  {isSelectMode ? '退出批量管理' : '批量管理'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className='ml-auto hidden shrink-0 items-center gap-1 @min-[620px]/tracker:flex'>
            <Button
              variant='ghost'
              size='sm'
              className={cn(
                'h-9 gap-1.5 rounded-lg px-2 text-muted-foreground sm:px-3',
                showArchived && 'bg-muted text-foreground',
              )}
              aria-pressed={showArchived}
              onClick={() => setShowArchived(!showArchived)}
            >
              <Archive className='size-4' />
              <span className='hidden sm:inline'>已归档</span>
              <span className='sr-only sm:hidden'>已归档</span>
              {archivedCount > 0 && (
                <span className='hidden text-xs tabular-nums sm:inline'>
                  {archivedCount}
                </span>
              )}
            </Button>
            <Button
              variant='ghost'
              size='sm'
              className={cn(
                'h-9 gap-1.5 rounded-lg px-2 text-muted-foreground sm:px-3',
                isSelectMode && 'bg-muted text-foreground',
              )}
              aria-pressed={isSelectMode}
              aria-label={isSelectMode ? '退出批量管理' : '批量管理'}
              onClick={isSelectMode ? exitSelectMode : enterSelectMode}
            >
              <CheckSquare className='size-4' />
              <span className='hidden sm:inline'>批量管理</span>
            </Button>
          </div>
        </div>
      </div>
      <BatchActions />
    </div>
  )
}
