import { ArrowDown, ArrowDownUp, ArrowUp } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
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
import { TRACKER_SORT_OPTIONS } from '../../const'
import useTrackerStore from '../../store'

export default function SortMenu() {
  const { sortBy, sortDir, setSort } = useTrackerStore(
    useShallow((state) => ({
      sortBy: state.sortBy,
      sortDir: state.sortDir,
      setSort: state.setSort,
    })),
  )

  const activeLabel =
    TRACKER_SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? '排序'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          aria-label={`排序：${activeLabel}，${sortDir === 'asc' ? '升序' : '降序'}`}
          className='size-9 gap-1.5 rounded-lg p-0 shadow-none sm:w-auto sm:px-3'
        >
          <ArrowDownUp className='size-4' />
          <span className='hidden sm:inline'>{activeLabel}</span>
          {sortDir === 'asc' ? (
            <ArrowUp className='hidden size-3.5 text-muted-foreground sm:block' />
          ) : (
            <ArrowDown className='hidden size-3.5 text-muted-foreground sm:block' />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-40'>
        <DropdownMenuLabel>排序方式</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {TRACKER_SORT_OPTIONS.map((option) => {
          const isActive = option.value === sortBy
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setSort(option.value)}
              className='justify-between'
            >
              <span className={cn(isActive && 'font-medium text-foreground')}>
                {option.label}
              </span>
              {isActive &&
                (sortDir === 'asc' ? (
                  <ArrowUp className='size-3.5' />
                ) : (
                  <ArrowDown className='size-3.5' />
                ))}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
