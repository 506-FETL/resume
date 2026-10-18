import AnimatedContent from '@/components/motion/animated-content'
import useAtsStore from '../../store'
import OverviewSummaryCard from './overview-summary-card'

export default function OptimizeDashboard() {
  const { currentAtsConfig, loading } = useAtsStore()
  const { fixChecklist } = currentAtsConfig || {}

  const totalTasks = fixChecklist?.length || 0
  const completedTasks = fixChecklist?.filter(item => item.isDone).length || 0
  const progress = !currentAtsConfig
    ? 0
    : totalTasks === 0
      ? 100
      : Math.round((completedTasks / totalTasks) * 100)

  return (
    <div className="min-w-0">
      <AnimatedContent animationKey={loading ? 'loading' : currentAtsConfig ? 'summary' : 'empty'} className="min-w-0">
        <OverviewSummaryCard
          completedTasks={completedTasks}
          loading={loading}
          progress={progress}
          totalTasks={totalTasks}
        />
      </AnimatedContent>
    </div>
  )
}
