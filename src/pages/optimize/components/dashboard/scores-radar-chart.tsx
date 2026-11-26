import type { Scores } from '../../types'
import type { ComponentProps } from 'react'
import { createDeferredComponent } from '@/components/deferred-content'
import { Activity } from 'lucide-react'
import { useInView } from 'motion/react'
import { useRef, useMemo } from 'react'
import AnimatedContent from '@/components/motion/animated-content'
import { LoadingRegion } from '@/components/loading-skeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { SCORE_LABELS } from '../../const'

interface ScoresRadarChartProps {
  scores: Scores | undefined
  loading?: boolean
  embedded?: boolean
}

const RadarPlot = createDeferredComponent<
  ComponentProps<typeof import('./radar-plot').default>
>(
  () => import('./radar-plot'),
  '评分图表',
  <Skeleton className='h-full w-full' />,
  { wrapFallback: false },
)

export default function ScoresRadarChart({
  scores,
  loading = false,
  embedded = false,
}: ScoresRadarChartProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const visible = useInView(viewportRef, { once: true, margin: '150px 0px' })

  const chartData = useMemo(() => {
    if (!scores) return []

    return Object.entries(scores).map(([key, value]) => ({
      category: SCORE_LABELS[key as keyof typeof SCORE_LABELS] || key,
      score: Math.round((value.score / value.max) * 100),
      raw: value.score,
      max: value.max,
      rationale: value.rationale,
    }))
  }, [scores])

  const content = (
    <div ref={viewportRef} className='flex min-h-0 min-w-0 flex-col'>
      <div className='flex items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <Activity aria-hidden className='size-4 text-muted-foreground' />
          <p className='text-sm font-medium'>能力雷达图</p>
        </div>
        <span className='text-xs text-muted-foreground'>五维评分</span>
      </div>

      <AnimatedContent
        animationKey={
          loading ? 'loading' : chartData.length > 0 ? 'chart' : 'empty'
        }
      >
        {loading ? (
          <LoadingRegion
            label='正在读取评分'
            className={cn('w-full py-4', embedded ? 'h-56' : 'h-72 sm:h-80')}
          >
            <Skeleton className='h-full w-full rounded-sm' />
          </LoadingRegion>
        ) : chartData.length > 0 ? (
          <>
            <div
              className={cn(
                'mx-auto w-full',
                embedded ? 'h-56 max-w-72' : 'h-72 max-w-[24rem] sm:h-80',
              )}
            >
              {visible ? <RadarPlot chartData={chartData} /> : null}
            </div>

            <div
              className={cn(
                'grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border/60 pt-3 text-xs',
                !embedded && 'sm:grid-cols-3 xl:grid-cols-2',
              )}
            >
              {chartData.map((item) => (
                <div
                  key={item.category}
                  className='flex min-w-0 items-center justify-between gap-2'
                >
                  <span className='truncate text-muted-foreground'>
                    {item.category}
                  </span>
                  <span className='shrink-0 font-medium'>
                    {item.raw}/{item.max}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className='flex min-h-24 flex-1 items-center justify-center text-sm text-muted-foreground'>
            暂无评分数据
          </div>
        )}
      </AnimatedContent>
    </div>
  )

  return embedded ? (
    content
  ) : (
    <section className='min-w-0 border-t pt-6'>{content}</section>
  )
}
