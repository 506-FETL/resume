import type { ApplicationStatus } from '../../types'
import { ChevronDown } from 'lucide-react'
import { useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { BOARD_COLUMNS } from '../../const'
import useTrackerStore from '../../store'
import { selectTrackerListJobs } from '../../store/selectors'
import { filterJobs } from '../../utils'

export default function MobileStageFilter() {
  const {
    jobs,
    filterStatus,
    metricFilter,
    searchKeyword,
    showArchived,
    filterCompanyId,
    focusedOnly,
    loading,
    error,
    isInitialized,
  } = useTrackerStore(
    useShallow((state) => ({
      jobs: selectTrackerListJobs(state),
      filterStatus: state.filterStatus,
      metricFilter: state.metricFilter,
      searchKeyword: state.searchKeyword,
      showArchived: state.showArchived,
      filterCompanyId: state.filterCompanyId,
      focusedOnly: state.focusedOnly,
      loading: state.loading,
      error: state.error,
      isInitialized: state.isInitialized,
    })),
  )

  const stageTriggerRef = useRef<HTMLButtonElement>(null)
  const value = filterStatus ?? metricFilter ?? 'all'

  const scopedJobs = filterJobs(
    filterCompanyId
      ? jobs.filter((job) => job.tracker_company_id === filterCompanyId)
      : jobs,
    null,
    searchKeyword,
    showArchived,
    null,
    focusedOnly,
  )

  const unavailable = loading || !isInitialized || !!error

  const pendingCount = filterJobs(
    scopedJobs,
    null,
    '',
    showArchived,
    'pending',
  ).length

  const selectedStage = BOARD_COLUMNS.find((column) => column.status === value)

  const selectFilter = (next: string) => {
    const target =
      next === 'all' || next === 'pending'
        ? document.getElementById(`tracker-filter-${next}`)
        : stageTriggerRef.current

    target?.focus({ preventScroll: true })

    // 回焦可能再次触发 Radix 自动激活，读取最新值，保持本次选择幂等。
    const store = useTrackerStore.getState()

    if (next === (store.filterStatus ?? store.metricFilter ?? 'all')) return
    if (store.isSelectMode) store.enterSelectMode()

    if (next === 'pending') store.setMetricFilter('pending')
    else
      store.setFilterStatus(next === 'all' ? null : (next as ApplicationStatus))
  }

  return (
    <div className='flex min-w-0 items-center justify-between gap-2'>
      <Tabs
        value={value}
        onValueChange={selectFilter}
        className='min-w-0 shrink-0 pb-1.5'
      >
        <TabsList variant='line' aria-label='筛选职位' className='h-11 gap-3'>
          {[
            { value: 'all', label: '全部', count: scopedJobs.length },
            { value: 'pending', label: '待跟进', count: pendingCount },
          ].map((option) => (
            <TabsTrigger
              key={option.value}
              id={`tracker-filter-${option.value}`}
              value={option.value}
              aria-controls='tracker-mobile-results'
              className='h-11 flex-none gap-1.5 px-1 text-sm'
            >
              {option.label}
              <span className='text-xs tabular-nums text-muted-foreground'>
                {unavailable ? '—' : option.count}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={stageTriggerRef}
            id={
              selectedStage ? `tracker-filter-${value}` : 'tracker-filter-stage'
            }
            variant='ghost'
            aria-label={`按阶段筛选：${selectedStage?.label ?? '全部阶段'}`}
            aria-pressed={Boolean(selectedStage)}
            className={cn(
              'h-10 min-w-0 gap-1.5 rounded-lg px-2 text-sm font-normal text-muted-foreground',
              selectedStage && 'bg-muted font-medium text-foreground',
            )}
          >
            <span className='truncate'>
              {selectedStage?.label ?? '全部阶段'}
            </span>
            <ChevronDown className='size-3.5' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-44'>
          <DropdownMenuRadioGroup
            value={selectedStage?.status ?? 'all'}
            onValueChange={selectFilter}
          >
            <DropdownMenuRadioItem value='all'>全部阶段</DropdownMenuRadioItem>
            {BOARD_COLUMNS.map((column) => (
              <DropdownMenuRadioItem
                key={column.status}
                value={column.status}
                className='justify-between gap-4'
              >
                {column.label}
                <span className='text-xs tabular-nums text-muted-foreground'>
                  {unavailable
                    ? '—'
                    : scopedJobs.filter((job) => job.status === column.status)
                        .length}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
