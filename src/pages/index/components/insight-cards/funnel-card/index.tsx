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
import { BriefcaseBusiness, Plus, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { FunnelStage } from '../../../insights'
import { CHART_HEIGHT } from '../const'
import { CHART_MARGIN } from '../const'
import { CardHead } from '../card-head/index'
import { ChartEmpty } from '../chart-empty/index'

// ==================== 求职漏斗图 ====================
const funnelConfig = {
  count: { label: '岗位数', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function FunnelCard({
  funnel,
  loading,
}: {
  funnel: FunnelStage[]
  loading: boolean
}) {
  const reduceMotion = useReducedMotion()
  const navigate = useNavigate()
  const hasData = funnel.some((stage) => stage.count > 0)

  return (
    <Card className='flex min-w-0 flex-col gap-0 rounded-none border-0 border-t bg-transparent py-5 shadow-none ring-0'>
      <CardHead
        icon={<TrendingUp className='size-4' />}
        title='求职漏斗'
        description='各阶段在办岗位分布'
      />
      <CardContent className='min-w-0 flex-1 px-0 pt-0'>
        <AnimatedContent
          animationKey={loading ? 'loading' : hasData ? 'ready' : 'empty'}
        >
          {loading ? (
            <DashboardChartSkeleton />
          ) : hasData ? (
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
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent />}
                />
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
          ) : (
            <ChartEmpty
              icon={<BriefcaseBusiness className='size-4' aria-hidden />}
              title='暂无在办岗位'
              description='添加目标岗位，开始记录求职进展。'
            >
              <Button
                variant='outline'
                size='sm'
                onClick={() => navigate('/tracker')}
              >
                <Plus aria-hidden />
                添加岗位
              </Button>
            </ChartEmpty>
          )}
        </AnimatedContent>
      </CardContent>
    </Card>
  )
}
