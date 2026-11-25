import { createDeferredComponent } from '@/components/deferred-content'
import { DashboardChartSkeleton } from '@/components/page-skeletons/dashboard'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Activity, ArrowRight, CalendarDays } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { ActivityDay, DashboardResources } from '../../../insights'
import { CardHead } from '../card-head/index'
import { ChartEmpty } from '../chart-empty/index'
import { ChartViewport } from '../chart-viewport'

const ActivityChart = createDeferredComponent(
  () => import('../activity-chart'),
  '本周活跃度',
  <DashboardChartSkeleton />,
  { wrapFallback: false },
)

export function ActivityCard({
  activity,
  loading,
  edits,
  jobs,
}: {
  activity: ActivityDay[]
  loading: boolean
  edits: DashboardResources['weeklyEdits']
  jobs: DashboardResources['jobs']
}) {
  const navigate = useNavigate()
  const total = activity.reduce((sum, day) => sum + day.total, 0)
  const hasData = total > 0

  const missing = [
    !edits.hasLoaded && (edits.error ? '编辑数据暂不可用' : '编辑数据加载中'),
    !jobs.hasLoaded && (jobs.error ? '投递数据暂不可用' : '投递数据加载中'),
  ]
    .filter(Boolean)
    .join('，')

  return (
    <Card className='flex min-w-0 flex-col gap-0 rounded-none border-0 border-t bg-transparent py-5 shadow-none ring-0'>
      <CardHead
        icon={<Activity className='size-4' />}
        title='本周活跃度'
        description={missing || '本周的编辑与投递'}
      />
      <CardContent className='min-w-0 flex-1 px-0 pt-0'>
        <AnimatedContent
          animationKey={
            hasData
              ? 'ready'
              : loading
                ? 'loading'
                : missing
                  ? 'error'
                  : 'empty'
          }
        >
          {hasData ? (
            <ChartViewport>
              <ActivityChart activity={activity} />
            </ChartViewport>
          ) : loading ? (
            <DashboardChartSkeleton />
          ) : missing ? (
            <ChartEmpty
              icon={<CalendarDays className='size-4' aria-hidden />}
              title='本周活动数据不完整'
              description='请重试未能加载的数据。'
            />
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
