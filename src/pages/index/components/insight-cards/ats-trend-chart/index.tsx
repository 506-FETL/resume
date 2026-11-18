import type { ChartConfig } from '@/components/ui/chart'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { AtsTrendPoint } from '../../../insights'
import { CHART_HEIGHT, NUMERIC_AXIS_CHART_MARGIN } from '../const'

const trendConfig = {
  score: { label: 'ATS 分', color: 'var(--chart-2)' },
} satisfies ChartConfig

export default function AtsTrendChart({ trend }: { trend: AtsTrendPoint[] }) {
  const reduceMotion = useReducedMotion()

  return (
    <ChartContainer config={trendConfig} className={cn(CHART_HEIGHT, 'w-full')}>
      <AreaChart
        accessibilityLayer
        data={trend}
        margin={NUMERIC_AXIS_CHART_MARGIN}
      >
        <defs>
          <linearGradient id='ats-trend-fill' x1='0' y1='0' x2='0' y2='1'>
            <stop offset='5%' stopColor='var(--chart-2)' stopOpacity={0.3} />
            <stop offset='95%' stopColor='var(--chart-2)' stopOpacity={0.02} />
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
  )
}
