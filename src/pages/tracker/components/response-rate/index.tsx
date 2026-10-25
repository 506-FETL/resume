import { CircleHelp } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
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
  const rate = useCountUp(stats.responseRate, DURATION.slow * 1000)
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
          <p>还没有记录投递或后续进展，暂时无法计算。</p>
        ) : (
          <p>
            曾进入测评或后续阶段的职位有 {stats.responded}{' '}
            个，曾进入已投递或后续阶段的职位共有 {stats.historicalApplied} 个。
          </p>
        )}
        <p className='text-muted-foreground'>
          按你记录过的阶段估算，包含已结束和已归档职位，不随当前搜索变化。这个比例不能反映实际收到回复的次数。
        </p>
      </PopoverContent>
    </Popover>
  )
}

export default memo(ResponseRate)
