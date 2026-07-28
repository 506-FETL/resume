import type { TrackerSortBy } from '../../types'
import { ArrowDown, ArrowDownUp, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import useTrackerStore from '../../store'

const SORT_OPTIONS: { value: TrackerSortBy, label: string }[] = [
  { value: 'updated', label: '最近更新' },
  { value: 'created', label: '创建时间' },
  { value: 'days', label: '停留天数' },
  { value: 'company', label: '公司名称' },
  { value: 'status', label: '当前状态' },
]

export default function SortMenu() {
  const { sortBy, sortDir, setSort } = useTrackerStore()

  const activeLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? '排序'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ArrowDownUp className="size-4" />
          {activeLabel}
          {sortDir === 'asc'
            ? <ArrowUp className="size-3.5 text-muted-foreground" />
            : <ArrowDown className="size-3.5 text-muted-foreground" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>排序方式</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SORT_OPTIONS.map((option) => {
          const isActive = option.value === sortBy
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setSort(option.value)}
              className="justify-between"
            >
              <span className={cn(isActive && 'font-medium text-foreground')}>{option.label}</span>
              {isActive && (
                sortDir === 'asc'
                  ? <ArrowUp className="size-3.5" />
                  : <ArrowDown className="size-3.5" />
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
