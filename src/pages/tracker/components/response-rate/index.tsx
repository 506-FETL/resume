import { CircleHelp } from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { memo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useCountUp } from '../../hooks/use-count-up'
import { useTrackerOverview } from '../../hooks/use-tracker-overview'

function ResponseRate() {
  const { stats, busy, error } = useTrackerOverview()
  const reduce = useReducedMotion()
  const rate = useCountUp(stats.responseRate)
  const available = !error && stats.historicalApplied > 0

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant='ghost'
          size='sm'
          aria-label={`响应率：${busy ? '加载中' : error ? '暂不可用' : available ? `${stats.responseRate}%` : '暂无数据'}，查看计算说明`}
          className='h-8 gap-1 rounded-md px-1.5 text-xs text-muted-foreground sm:gap-1.5 sm:px-2'
        >
          响应率
          {busy ? (
            <Skeleton className={cn('h-3.5 w-8', reduce && 'animate-none')} />
          ) : (
            <span className='font-semibold tabular-nums text-foreground'>
              {available ? `${rate}%` : '—'}
            </span>
          )}
          <CircleHelp aria-hidden className='size-3.5!' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        className='w-72 max-w-[calc(100vw-2rem)] gap-2 text-xs leading-5'
        style={{
          animationDuration: `${reduce ? 0 : DURATION.base}s`,
          animationTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
        }}
      >
        <p className='font-medium'>响应率怎么算？</p>
        {busy ? (
          <p role='status'>正在加载职位记录…</p>
        ) : error ? (
          <p>职位记录加载失败，暂时无法计算。</p>
        ) : stats.historicalApplied === 0 ? (
          <p>还没有确认的投递留档，暂时无法计算。</p>
        ) : (
          <p>
            已留档的投递中，进入测评或后续阶段的岗位有 {stats.responded}{' '}
            个，确认投递的岗位共有 {stats.historicalApplied} 个。
          </p>
        )}
        <p className='text-muted-foreground'>
          包含已结束和已归档岗位，不随搜索或公司筛选变化。后续进展按阶段记录计算，不代表实际回复次数。
        </p>
        {stats.unresolvedSubmissions > 0 && (
          <p className='text-muted-foreground'>
            还有 {stats.unresolvedSubmissions}{' '}
            个岗位的历史投递待确认，暂未计入。
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}

export default memo(ResponseRate)
