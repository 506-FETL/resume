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
import type { FunnelStage } from '../../../insights'
import { CHART_HEIGHT, CHART_MARGIN } from '../const'

const funnelConfig = {
  count: { label: '岗位数', color: 'var(--chart-1)' },
} satisfies ChartConfig

export default function FunnelChart({ funnel }: { funnel: FunnelStage[] }) {
  const reduceMotion = useReducedMotion()

  return (
    <ChartContainer
      config={funnelConfig}
      className={cn(CHART_HEIGHT, 'w-full')}
    >
      <BarChart accessibilityLayer data={funnel} margin={CHART_MARGIN}>
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
          dataKey='count'
          fill='var(--chart-1)'
          radius={[4, 4, 0, 0]}
          maxBarSize={44}
        />
      </BarChart>
    </ChartContainer>
  )
}
