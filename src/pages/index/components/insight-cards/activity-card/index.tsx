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
import { Activity, ArrowRight, CalendarDays } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { ActivityDay } from '../../../insights'
import { CHART_HEIGHT } from '../const'
import { CHART_MARGIN } from '../const'
import { CardHead } from '../card-head/index'
import { ChartEmpty } from '../chart-empty/index'

// ==================== 本周活跃度 ====================
const activityConfig = {
  edits: { label: '编辑', color: 'var(--chart-1)' },
  applies: { label: '投递', color: 'var(--chart-3)' },
} satisfies ChartConfig

export function ActivityCard({
  activity,
  loading,
}: {
  activity: ActivityDay[]
  loading: boolean
}) {
  const reduceMotion = useReducedMotion()
  const navigate = useNavigate()
  const total = activity.reduce((sum, day) => sum + day.total, 0)
  const hasData = total > 0

  return (
    <Card className='flex min-w-0 flex-col gap-0 rounded-none border-0 border-t bg-transparent py-5 shadow-none ring-0'>
      <CardHead
        icon={<Activity className='size-4' />}
        title='本周活跃度'
        description='本周的编辑与投递'
      />
      <CardContent className='min-w-0 flex-1 px-0 pt-0'>
        <AnimatedContent
          animationKey={loading ? 'loading' : hasData ? 'ready' : 'empty'}
        >
          {loading ? (
            <DashboardChartSkeleton />
          ) : total > 0 ? (
            <ChartContainer
              config={activityConfig}
              className={cn(CHART_HEIGHT, 'w-full')}
            >
              <BarChart
                accessibilityLayer
                data={activity}
                margin={CHART_MARGIN}
              >
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
          ) : (
            <ChartEmpty
              icon={<CalendarDays className='size-4' aria-hidden />}
              title='本周暂无活动'
              description='编辑简历或记录投递后，在这里查看。'
            >
              <Button
                variant='outline'
                size='sm'
                onClick={() => navigate('/resume')}
              >
                管理简历
                <ArrowRight aria-hidden />
              </Button>
            </ChartEmpty>
          )}
        </AnimatedContent>
      </CardContent>
    </Card>
  )
}
