import type { ApplicationStatus } from '../../types'
import { ArrowDown, ArrowUp, ListFilter } from 'lucide-react'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  APPLICATION_STATUS_CONFIG,
  APPLICATION_STATUS_DOT_CLASSES,
  APPLICATION_STATUS_ORDER,
  TRACKER_SORT_OPTIONS,
} from '../../const'
import useTrackerStore from '../../store'
import { selectTrackerListJobs } from '../../store/selectors'
import { filterJobs } from '../../utils'

const ALL_VALUE = '__all__'

const ALL_FILTER_STATUSES: (ApplicationStatus | null)[] = [
  null,
  ...APPLICATION_STATUS_ORDER,
  'rejected',
]

export default function FilterMenu({ mobile = false }: { mobile?: boolean }) {
  const {
    jobs,
    filterStatus,
    setFilterStatus,
    showArchived,
    focusedOnly,
    filterCompanyId,
    searchKeyword,
    viewMode,
  } = useTrackerStore(
    useShallow((state) => ({
      jobs: selectTrackerListJobs(state),
      filterStatus: state.filterStatus,
      setFilterStatus: state.setFilterStatus,
      showArchived: state.showArchived,
      focusedOnly: state.focusedOnly,
      filterCompanyId: state.filterCompanyId,
      searchKeyword: state.searchKeyword,
      viewMode: state.viewMode,
    })),
  )

  const { sortBy, sortDir, setSort } = useTrackerStore(
    useShallow((state) => ({
      sortBy: state.sortBy,
      sortDir: state.sortDir,
      setSort: state.setSort,
    })),
  )

  const current = filterStatus ?? ALL_VALUE

  const activeLabel = filterStatus
    ? APPLICATION_STATUS_CONFIG[filterStatus].label
    : '全部阶段'

  const sortLabel = TRACKER_SORT_OPTIONS.find(
    (option) => option.value === sortBy,
  )?.label

  const directionLabel = sortDir === 'asc' ? '升序' : '降序'

  const scopedJobs = useMemo(
    () =>
      filterJobs(
        filterCompanyId
          ? jobs.filter((job) => job.tracker_company_id === filterCompanyId)
          : jobs,
        null,
        searchKeyword,
        showArchived,
        null,
        focusedOnly,
      ),
    [jobs, searchKeyword, showArchived, filterCompanyId, focusedOnly],
  )

  const counts = useMemo(() => {
    const result = new Map<ApplicationStatus, number>()

    for (const job of scopedJobs)
      result.set(job.status, (result.get(job.status) ?? 0) + 1)

    return result
  }, [scopedJobs])

  const getCount = (status: (typeof ALL_FILTER_STATUSES)[number]) =>
    status === null ? scopedJobs.length : (counts.get(status) ?? 0)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={mobile ? 'secondary' : 'outline'}
          size='sm'
          aria-label={
            mobile
              ? `筛选与排序：${activeLabel}${viewMode === 'list' ? `，${sortLabel}，${directionLabel}` : ''}`
              : activeLabel
          }
          className='relative h-9 shrink-0 gap-1.5 rounded-lg px-2.5 shadow-none sm:px-3'
        >
          <ListFilter className='size-4' />
          <span>{mobile ? '筛选' : activeLabel}</span>
          {filterStatus && (
            <Badge
              variant='secondary'
              className='ml-0.5 hidden rounded-full px-1.5 sm:inline-flex'
            >
              {getCount(filterStatus)}
            </Badge>
          )}
          {filterStatus && (
            <span
              aria-hidden='true'
              className='absolute top-1 right-1 size-1.5 rounded-full bg-primary sm:hidden'
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align='end'
        className={
          mobile
            ? 'max-h-[min(36rem,75dvh)] w-60 overflow-y-auto p-1.5'
            : 'w-44'
        }
      >
        <DropdownMenuLabel>
          {viewMode === 'board' ? '定位到阶段' : '按阶段筛选'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(value) =>
            setFilterStatus(
              value === ALL_VALUE
                ? null
                : (value as NonNullable<typeof filterStatus>),
            )
          }
        >
          {ALL_FILTER_STATUSES.map((status) => {
            const value = status ?? ALL_VALUE

            const label =
              status === null ? '全部' : APPLICATION_STATUS_CONFIG[status].label

            return (
              <DropdownMenuRadioItem
                key={value}
                value={value}
                className='justify-between'
              >
                <span className='flex items-center gap-2'>
                  {status && (
                    <span
                      aria-hidden='true'
                      className={`size-1.5 rounded-full ${APPLICATION_STATUS_DOT_CLASSES[status]}`}
                    />
                  )}
                  {label}
                </span>
                <span className='text-xs text-muted-foreground'>
                  {getCount(status)}
                </span>
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
        {mobile && viewMode === 'list' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>排序方式</DropdownMenuLabel>
            {TRACKER_SORT_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onSelect={() => setSort(option.value)}
                aria-label={
                  sortBy === option.value
                    ? `${option.label}，当前${directionLabel}，再次选择切换方向`
                    : option.label
                }
                className='justify-between pl-8'
              >
                <span
                  className={
                    sortBy === option.value
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground'
                  }
                >
                  {option.label}
                </span>
                {sortBy === option.value &&
                  (sortDir === 'asc' ? (
                    <ArrowUp className='size-3.5' />
                  ) : (
                    <ArrowDown className='size-3.5' />
                  ))}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
