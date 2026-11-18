import type { ChartConfig } from '@/components/ui/chart'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { ActivityDay } from '../../../insights'
import { CHART_HEIGHT, CHART_MARGIN } from '../const'

const activityConfig = {
  edits: { label: '编辑', color: 'var(--chart-1)' },
  applies: { label: '投递', color: 'var(--chart-3)' },
} satisfies ChartConfig

export default function ActivityChart({
  activity,
}: {
  activity: ActivityDay[]
}) {
  const reduceMotion = useReducedMotion()

  return (
    <ChartContainer
      config={activityConfig}
      className={cn(CHART_HEIGHT, 'w-full')}
    >
      <BarChart accessibilityLayer data={activity} margin={CHART_MARGIN}>
        <CartesianGrid
          vertical={false}
          stroke='var(--border)'
          strokeDasharray='3 3'
        />
        <XAxis
          dataKey='label'
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={28}
          tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar
          isAnimationActive={!reduceMotion}
          animationDuration={DURATION.slow * 1000}
          animationEasing='ease-out'
          dataKey='edits'
          stackId='a'
          fill='var(--chart-1)'
          radius={[0, 0, 0, 0]}
          maxBarSize={28}
        />
        <Bar
          isAnimationActive={!reduceMotion}
          animationDuration={DURATION.slow * 1000}
          animationEasing='ease-out'
          dataKey='applies'
          stackId='a'
          fill='var(--chart-3)'
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ChartContainer>
  )
}
