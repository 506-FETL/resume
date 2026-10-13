import AnimatedContent from '@/components/motion/animated-content'
import useAtsStore from '../../store'
import OverviewSummaryCard from './overview-summary-card'
import ScoresRadarChart from './scores-radar-chart'

export default function OptimizeDashboard() {
  const { currentAtsConfig, loading } = useAtsStore()
  const { fixChecklist, scores } = currentAtsConfig || {}

  const totalTasks = fixChecklist?.length || 0
  const completedTasks = fixChecklist?.filter(item => item.isDone).length || 0
  const progress = !currentAtsConfig
    ? 0
    : totalTasks === 0
      ? 100
      : Math.round((completedTasks / totalTasks) * 100)

  return (
    <div className="grid min-w-0 items-start gap-4 md:gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,.65fr)]">
      <AnimatedContent animationKey={loading ? 'loading' : currentAtsConfig ? 'summary' : 'empty'} className="min-w-0">
        <OverviewSummaryCard
          completedTasks={completedTasks}
          loading={loading}
          progress={progress}
          totalTasks={totalTasks}
        />
      </AnimatedContent>
      <ScoresRadarChart scores={scores} loading={loading} />
    </div>
  )
}
