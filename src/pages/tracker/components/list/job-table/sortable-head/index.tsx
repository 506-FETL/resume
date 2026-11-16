import type { TrackerSortBy } from '../../../../types'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface SortableHeadProps {
  field: TrackerSortBy
  label: string
  sortBy: TrackerSortBy
  sortDir: 'asc' | 'desc'
  onSort: (field: TrackerSortBy) => void
}

export function SortableHead({
  field,
  label,
  sortBy,
  sortDir,
  onSort,
}: SortableHeadProps) {
  const isActive = sortBy === field
  const isDaysActive = field === 'status' && sortBy === 'days'
  const reduceMotion = useReducedMotion()

  return (
    <th
      aria-sort={
        isActive || isDaysActive
          ? sortDir === 'asc'
            ? 'ascending'
            : 'descending'
          : 'none'
      }
      className={cn(
        'px-3 py-3 text-left font-medium',
        field === 'company' && 'w-[32%] @min-[880px]/jobs:w-[26%]',
        field === 'status' &&
          'w-[24%] @min-[680px]/jobs:w-[20%] @min-[880px]/jobs:w-[16%]',
        field === 'updated' && 'hidden w-[13%] @min-[1100px]/jobs:table-cell',
      )}
    >
      <button
        type='button'
        onClick={() => onSort(field)}
        className={cn(
          'inline-flex items-center gap-1 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isActive && 'text-foreground',
        )}
        style={{ transitionDuration: `${reduceMotion ? 0 : DURATION.fast}s` }}
      >
        {label}
        {isActive &&
          (sortDir === 'asc' ? (
            <ArrowUp className='size-3' />
          ) : (
            <ArrowDown className='size-3' />
          ))}
      </button>
      {field === 'status' && (
        <button
          type='button'
          onClick={() => onSort('days')}
          className={cn(
            'mt-1 flex items-center gap-1 rounded-sm text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isDaysActive && 'text-foreground',
          )}
          aria-label='按未更新时间排序'
        >
          未更新时间
          {isDaysActive &&
            (sortDir === 'asc' ? (
              <ArrowUp className='size-3' />
            ) : (
              <ArrowDown className='size-3' />
            ))}
        </button>
      )}
    </th>
  )
}
