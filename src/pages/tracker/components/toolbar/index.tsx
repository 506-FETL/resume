import { Archive, CheckSquare, Flag, Search, X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useShallow } from 'zustand/react/shallow'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import { CompanyPicker } from '../drawer/company-picker'
import MobileStageFilter from '../mobile-stage-filter'
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
    filterCompanyId,
    focusedOnly,
    setFilterCompanyId,
    groupByCompany,
    setGroupByCompany,
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
      filterCompanyId: state.filterCompanyId,
      focusedOnly: state.focusedOnly,
      setFilterCompanyId: state.setFilterCompanyId,
      groupByCompany: state.groupByCompany,
      setGroupByCompany: state.setGroupByCompany,
    })),
  )

  const {
    clearFilters,
    clearSearch,
    setShowArchived: setShowArchivedWithFocus,
  } = useTrackerFilterActions()

  const reduce = useReducedMotion()
  const isMobile = useIsMobile()
  const effectiveViewMode = isMobile ? 'list' : viewMode

  const count = filterJobs(
    filterCompanyId
      ? jobs.filter((job) => job.tracker_company_id === filterCompanyId)
      : jobs,
    effectiveViewMode === 'list' ? filterStatus : null,
    searchKeyword,
    showArchived,
    effectiveViewMode === 'list' ? metricFilter : null,
    focusedOnly,
  ).length

  const archivedCount = jobs.filter((job) => job.archived).length

  const activeLabel = filterStatus
    ? APPLICATION_STATUS_CONFIG[filterStatus].label
    : metricFilter
      ? TRACKER_METRIC_LABELS[metricFilter]
      : null

  const busy = loading || (!isInitialized && !error)

  const actionTransition = {
    transitionDuration: `${reduce ? 0 : DURATION.fast}s`,
    transitionTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
  }

  const tooltipAnimation = {
    animationDuration: `${reduce ? 0 : DURATION.fast}s`,
    animationTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
  }

  return (
    <div className='shrink-0 py-1 md:border-b md:px-3 md:py-2'>
      <div className='flex flex-col gap-2 @min-[980px]/tracker:flex-row @min-[980px]/tracker:items-center @min-[980px]/tracker:gap-3'>
        <div className='hidden shrink-0 items-center justify-between gap-3 md:flex'>
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
        <div className='flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-3 md:gap-2'>
          <div className='flex min-w-0 basis-full items-center gap-2 md:@min-[620px]/tracker:flex-1 md:@min-[620px]/tracker:basis-72 @min-[980px]/tracker:max-w-lg'>
            <div className='relative min-w-0 flex-1'>
              <Search className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                id={TRACKER_SEARCH_INPUT_ID}
                type='search'
                aria-label='搜索职位'
                value={searchKeyword}
                placeholder='搜索职位…'
                className={cn(
                  'pl-9 pr-9 shadow-none [&::-webkit-search-cancel-button]:appearance-none',
                  isMobile
                    ? 'h-11 rounded-xl border-transparent bg-muted/50 dark:bg-muted/50'
                    : 'rounded-lg',
                )}
                onChange={(event) => {
                  if (isMobile && isSelectMode) enterSelectMode()

                  setSearchKeyword(event.target.value)
                }}
              />
              <AnimatePresence initial={false}>
                {searchKeyword && (
                  <PresenceDiv
                    className={cn(
                      'absolute right-1',
                      isMobile ? 'top-1.5' : 'top-0.5',
                    )}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduce ? 0 : DURATION.fast }}
                  >
                    <Button
                      size='icon-sm'
                      variant='ghost'
                      aria-label='清空搜索'
                      onClick={() => {
                        if (isMobile && isSelectMode) enterSelectMode()

                        clearSearch()
                      }}
                    >
                      <X className='size-3.5' />
                    </Button>
                  </PresenceDiv>
                )}
              </AnimatePresence>
            </div>
            <FilterMenu mobile={isMobile} />
          </div>
          {isMobile && (
            <div className='basis-full'>
              <MobileStageFilter />
            </div>
          )}
          <div className='min-w-0 flex-1 md:@min-[620px]/tracker:w-40 md:@min-[620px]/tracker:flex-none'>
            <label htmlFor='tracker-company-filter' className='sr-only'>
              按公司筛选
            </label>
            <CompanyPicker
              id='tracker-company-filter'
              value={filterCompanyId}
              onChange={setFilterCompanyId}
              allLabel='全部公司'
              inputClassName={
                isMobile
                  ? 'h-9 border-transparent bg-transparent shadow-none dark:bg-transparent [&>input]:pl-0'
                  : undefined
              }
            />
          </div>
          <div className='order-1 flex basis-full flex-wrap items-center gap-1.5 empty:hidden md:@min-[620px]/tracker:order-none md:@min-[620px]/tracker:basis-auto'>
            <AnimatePresence initial={false}>
              {!isMobile && effectiveViewMode === 'list' && (
                <PresenceDiv
                  key='company-group-toggle'
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduce ? 0 : DURATION.fast }}
                >
                  <Button
                    variant={groupByCompany ? 'secondary' : 'outline'}
                    size='sm'
                    className='h-9 whitespace-nowrap text-xs'
                    aria-pressed={groupByCompany}
                    onClick={() => setGroupByCompany(!groupByCompany)}
                  >
                    按公司分组
                  </Button>
                </PresenceDiv>
              )}
            </AnimatePresence>
            <AnimatePresence initial={false}>
              {activeLabel && !isMobile && (
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
                    aria-label={`清除${effectiveViewMode === 'board' ? '定位' : '筛选'}：${activeLabel}`}
                  >
                    <span className='hidden sm:inline'>
                      {effectiveViewMode === 'board' ? '定位' : '筛选'}：
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
                    onClick={() => {
                      if (isMobile && isSelectMode) enterSelectMode()

                      setShowArchivedWithFocus(false)
                    }}
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
              {!isMobile && effectiveViewMode === 'list' && (
                <PresenceDiv
                  key='sort-menu'
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduce ? 0 : DURATION.fast }}
                >
                  <SortMenu />
                </PresenceDiv>
              )}
            </AnimatePresence>
          </div>
          <div
            role='group'
            aria-label='职位工具'
            className='ml-auto flex shrink-0 items-center gap-1'
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  id='tracker-focus-filter'
                  variant={focusedOnly ? 'secondary' : 'ghost'}
                  size='icon'
                  aria-label='重点关注'
                  aria-pressed={focusedOnly}
                  className={cn(
                    'size-9 rounded-lg md:size-10 md:@min-[620px]/tracker:size-9 md:[@media(pointer:coarse)]:size-11',
                    focusedOnly
                      ? 'text-red-600 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400'
                      : 'text-muted-foreground',
                  )}
                  style={actionTransition}
                  onClick={() =>
                    useTrackerStore.getState().setFocusedOnly(!focusedOnly)
                  }
                >
                  <Flag
                    className='size-4'
                    fill={focusedOnly ? 'currentColor' : 'none'}
                    aria-hidden
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent style={tooltipAnimation}>
                {focusedOnly ? '显示全部职位' : '只看重点关注'}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showArchived ? 'secondary' : 'ghost'}
                  size='icon'
                  className={cn(
                    'size-9 rounded-lg md:size-10 md:@min-[620px]/tracker:size-9 md:[@media(pointer:coarse)]:size-11',
                    !showArchived && 'text-muted-foreground',
                  )}
                  style={actionTransition}
                  aria-label='已归档'
                  aria-pressed={showArchived}
                  onClick={() => {
                    if (isMobile && isSelectMode) enterSelectMode()

                    setShowArchived(!showArchived)
                  }}
                >
                  <Archive className='size-4' aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent style={tooltipAnimation}>
                {showArchived ? '返回在办职位' : `已归档（${archivedCount}）`}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isSelectMode ? 'secondary' : 'ghost'}
                  size='icon'
                  className={cn(
                    'size-9 rounded-lg md:size-10 md:@min-[620px]/tracker:size-9 md:[@media(pointer:coarse)]:size-11',
                    !isSelectMode && 'text-muted-foreground',
                  )}
                  style={actionTransition}
                  aria-pressed={isSelectMode}
                  id='tracker-batch-toggle'
                  aria-label={isSelectMode ? '退出批量管理' : '批量管理'}
                  onClick={isSelectMode ? exitSelectMode : enterSelectMode}
                >
                  <CheckSquare className='size-4' aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent style={tooltipAnimation}>
                {isSelectMode ? '退出批量管理' : '批量管理'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
      <BatchActions />
    </div>
  )
}
