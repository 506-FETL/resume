import type { ApplicationStatus } from '../../types'
import { ListFilter } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { APPLICATION_STATUS_CONFIG, APPLICATION_STATUS_ORDER } from '../../const'
import useTrackerStore from '../../store'

const ALL_VALUE = '__all__'

// 筛选可选项：全部 + 5 个正向阶段 + 已终止
const ALL_FILTER_STATUSES: (ApplicationStatus | null)[] = [null, ...APPLICATION_STATUS_ORDER, 'rejected']

export default function FilterMenu() {
  const { jobs, filterStatus, setFilterStatus } = useTrackerStore()

  const current = filterStatus ?? ALL_VALUE
  const activeLabel = filterStatus ? APPLICATION_STATUS_CONFIG[filterStatus].label : '全部'

  const getCount = (status: (typeof ALL_FILTER_STATUSES)[number]) =>
    status === null ? jobs.length : jobs.filter(j => j.status === status).length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ListFilter className="size-4" />
          {activeLabel}
          {filterStatus && <Badge variant="secondary" className="ml-0.5 rounded-full px-1.5">{getCount(filterStatus)}</Badge>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>按状态筛选</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={value => setFilterStatus(value === ALL_VALUE ? null : value as NonNullable<typeof filterStatus>)}
        >
          {ALL_FILTER_STATUSES.map((status) => {
            const value = status ?? ALL_VALUE
            const label = status === null ? '全部' : APPLICATION_STATUS_CONFIG[status].label
            return (
              <DropdownMenuRadioItem key={value} value={value} className="justify-between">
                <span>{label}</span>
                <span className="text-xs text-muted-foreground">{getCount(status)}</span>
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
