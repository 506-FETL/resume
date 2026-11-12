import AnimatedContent from '@/components/motion/animated-content'
import useAtsStore from '../../store'
import OverviewSummaryCard from './overview-summary-card'

export default function OptimizeDashboard() {
  const { currentAtsConfig, loading } = useAtsStore()

  return (
    <div className='min-w-0'>
      <AnimatedContent
        animationKey={
          currentAtsConfig ? 'summary' : loading ? 'loading' : 'empty'
        }
        className='min-w-0'
      >
        <OverviewSummaryCard loading={loading} />
      </AnimatedContent>
    </div>
  )
}
