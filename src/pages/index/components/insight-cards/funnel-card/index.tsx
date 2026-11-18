import { createDeferredComponent } from '@/components/deferred-content'
import { DashboardChartSkeleton } from '@/components/page-skeletons/dashboard'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { BriefcaseBusiness, Plus, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { FunnelStage } from '../../../insights'
import { CardHead } from '../card-head/index'
import { ChartEmpty } from '../chart-empty/index'
import { ChartViewport } from '../chart-viewport'

const FunnelChart = createDeferredComponent(
  () => import('../funnel-chart'),
  '求职漏斗',
  <DashboardChartSkeleton />,
  { wrapFallback: false },
)

export function FunnelCard({
  funnel,
  loading,
}: {
  funnel: FunnelStage[]
  loading: boolean
}) {
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
            <ChartViewport>
              <FunnelChart funnel={funnel} />
            </ChartViewport>
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
