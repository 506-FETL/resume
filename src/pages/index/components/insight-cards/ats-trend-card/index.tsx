import { createDeferredComponent } from '@/components/deferred-content'
import { DashboardChartSkeleton } from '@/components/page-skeletons/dashboard'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  ArrowRight,
  FileSearch,
  LineChart as LineChartIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { AtsTrendPoint } from '../../../insights'
import { CardHead } from '../card-head/index'
import { ChartEmpty } from '../chart-empty/index'
import { ChartViewport } from '../chart-viewport'

const AtsTrendChart = createDeferredComponent(
  () => import('../ats-trend-chart'),
  'ATS 分数趋势',
  <DashboardChartSkeleton />,
  { wrapFallback: false },
)

export function AtsTrendCard({
  trend,
  loading,
  unavailable,
}: {
  trend: AtsTrendPoint[]
  loading: boolean
  unavailable: boolean
}) {
  const navigate = useNavigate()
  // 至少两次检测才绘制趋势，单次检测展示分数与时间摘要。
  const hasData = trend.length > 0

  return (
    <Card className='flex min-w-0 flex-col gap-0 rounded-none border-0 border-t bg-transparent py-5 shadow-none ring-0'>
      <CardHead
        icon={<LineChartIcon className='size-4' />}
        title='ATS 分数趋势'
        description='最近 8 次检测得分'
      />
      <CardContent className='min-w-0 flex-1 px-0 pt-0'>
        <AnimatedContent
          animationKey={
            unavailable
              ? 'error'
              : loading
                ? 'loading'
                : trend.length > 1
                  ? 'ready'
                  : hasData
                    ? 'summary'
                    : 'empty'
          }
        >
          {unavailable ? (
            <p className='py-2 text-sm text-muted-foreground'>
              暂时无法读取检测趋势
            </p>
          ) : loading ? (
            <DashboardChartSkeleton />
          ) : trend.length === 1 ? (
            <div className='flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2'>
              <span className='text-2xl font-semibold tabular-nums'>
                {trend[0].score}
                <span className='ml-1 text-xs font-normal text-muted-foreground'>
                  分
                </span>
              </span>
              <span className='text-xs text-muted-foreground'>
                {trend[0].fullLabel} · 再次检测后展示趋势
              </span>
            </div>
          ) : hasData ? (
            <ChartViewport>
              <AtsTrendChart trend={trend} />
            </ChartViewport>
          ) : (
            <ChartEmpty
              icon={<FileSearch className='size-4' aria-hidden />}
              title='暂无检测记录'
              description='检测简历，了解得分与改进建议。'
            >
              <Button
                variant='outline'
                size='sm'
                onClick={() => navigate('/optimize')}
              >
                检测简历
                <ArrowRight aria-hidden />
              </Button>
            </ChartEmpty>
          )}
        </AnimatedContent>
      </CardContent>
    </Card>
  )
}
