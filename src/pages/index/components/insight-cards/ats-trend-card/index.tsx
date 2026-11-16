import { DashboardChartSkeleton } from '@/components/page-skeletons/dashboard'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { ChartConfig } from '@/components/ui/chart'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION } from '@/lib/motion'
import { cn } from '@/lib/utils'
import {
  ArrowRight,
  FileSearch,
  LineChart as LineChartIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { AtsTrendPoint } from '../../../insights'
import { CHART_HEIGHT } from '../const'
import { NUMERIC_AXIS_CHART_MARGIN } from '../const'
import { CardHead } from '../card-head/index'
import { ChartEmpty } from '../chart-empty/index'

// ==================== ATS 分数趋势图 ====================
const trendConfig = {
  score: { label: 'ATS 分', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function AtsTrendCard({
  trend,
  loading,
}: {
  trend: AtsTrendPoint[]
  loading: boolean
}) {
  const reduceMotion = useReducedMotion()
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
            loading
              ? 'loading'
              : trend.length > 1
                ? 'ready'
                : hasData
                  ? 'summary'
                  : 'empty'
          }
        >
          {loading ? (
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
            <ChartContainer
              config={trendConfig}
              className={cn(CHART_HEIGHT, 'w-full')}
            >
              <AreaChart
                accessibilityLayer
                data={trend}
                margin={NUMERIC_AXIS_CHART_MARGIN}
              >
                <defs>
                  <linearGradient
                    id='ats-trend-fill'
                    x1='0'
                    y1='0'
                    x2='0'
                    y2='1'
                  >
                    <stop
                      offset='5%'
                      stopColor='var(--chart-2)'
                      stopOpacity={0.3}
                    />
                    <stop
                      offset='95%'
                      stopColor='var(--chart-2)'
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke='var(--border)'
                  strokeDasharray='3 3'
                />
                <XAxis
                  dataKey='index'
                  type='number'
                  domain={['dataMin', 'dataMax']}
                  ticks={trend.map((point) => point.index)}
                  interval={0}
                  tickMargin={8}
                  height={24}
                  tickFormatter={(value: number) => trend[value]?.label ?? ''}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                />
                <YAxis
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.fullLabel ?? ''
                      }
                    />
                  }
                />
                <Area
                  isAnimationActive={!reduceMotion}
                  animationDuration={DURATION.slow * 1000}
                  animationEasing='ease-out'
                  dataKey='score'
                  type='monotone'
                  stroke='var(--chart-2)'
                  strokeWidth={2}
                  fill='url(#ats-trend-fill)'
                  // 常驻数据点：每次检测都有一个圆点，hover 时放大，避免只有折线看不出「几次检测」
                  dot={{
                    r: 3,
                    fill: 'var(--chart-2)',
                    stroke: 'var(--background)',
                    strokeWidth: 1.5,
                  }}
                  activeDot={{
                    r: 5,
                    fill: 'var(--chart-2)',
                    stroke: 'var(--background)',
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ChartContainer>
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
