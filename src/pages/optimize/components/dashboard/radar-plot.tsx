import type { ChartConfig } from '@/components/ui/chart'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts'
import { DURATION } from '@/lib/motion'
import { SCORE_LABELS } from '../../const'

const chartConfig = {
  score: {
    label: '得分',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

export default function RadarPlot({
  chartData,
}: {
  chartData: Array<{
    category: string
    score: number
    raw: number
    max: number
    rationale?: string
  }>
}) {
  const reduceMotion = useReducedMotion()

  return (
    <ChartContainer
      aria-label='ATS 五维评分雷达图'
      config={chartConfig}
      className='mx-auto h-full w-full flex-none aspect-auto'
    >
      <RadarChart
        accessibilityLayer
        data={chartData}
        cx='50%'
        cy='50%'
        margin={{ top: 30, right: 52, bottom: 30, left: 52 }}
        outerRadius='64%'
      >
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(value) =>
                SCORE_LABELS[value as keyof typeof SCORE_LABELS] || value
              }
              formatter={(value, _, item) => (
                <div className='max-w-64 space-y-1.5'>
                  <div className='flex items-center gap-1'>
                    <span className='font-medium'>{item.payload.raw}</span>
                    <span className='text-muted-foreground'>/</span>
                    <span className='text-muted-foreground'>
                      {item.payload.max}
                    </span>
                    <span className='ml-1 text-xs text-muted-foreground'>
                      ({value}
                      %)
                    </span>
                  </div>
                  {item.payload.rationale && (
                    <p className='whitespace-normal text-xs leading-5 text-muted-foreground'>
                      {item.payload.rationale}
                    </p>
                  )}
                </div>
              )}
            />
          }
        />
        <PolarAngleAxis
          dataKey='category'
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickLine={false}
        />
        <PolarGrid gridType='polygon' stroke='var(--border)' />
        <Radar
          isAnimationActive={!reduceMotion}
          animationDuration={DURATION.slow * 1000}
          animationEasing='ease-out'
          dataKey='score'
          fill='var(--chart-1)'
          fillOpacity={0.28}
          stroke='var(--chart-1)'
          strokeWidth={2}
        />
      </RadarChart>
    </ChartContainer>
  )
}
