import { useEffect } from 'react'
import { PageLayout } from '@/components/layout/page-layout'
import AdvancedTools from './components/advanced-tools'
import IssueAnalysis from './components/analysis'
import OptimizeDashboard from './components/dashboard'
import AssessmentBasisCard from './components/dashboard/assessment-basis-card'
import ScoresRadarChart from './components/dashboard/scores-radar-chart'
import Header from './components/header'
import ProTips from './components/pro-tips'
import RepairChecklist from './components/repair-checklist'
import useAtsStore from './store'

function Optimize() {
  const init = useAtsStore((state) => state.init)
  const scores = useAtsStore((state) => state.currentAtsConfig?.scores)
  const loading = useAtsStore((state) => state.loading)

  useEffect(() => {
    init()
  }, [init])

  return (
    <PageLayout>
      <Header />
      <OptimizeDashboard />

      <div className='grid min-w-0 items-start gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]'>
        <div className='min-w-0 xl:col-start-1 xl:row-start-1'>
          <IssueAnalysis />
        </div>

        <div className='min-w-0 xl:col-start-2 xl:row-start-1'>
          <RepairChecklist />
        </div>

        <div className='min-w-0 xl:col-start-1 xl:row-start-2'>
          <AssessmentBasisCard />
        </div>
        <div className='min-w-0 xl:col-start-2 xl:row-start-2'>
          <ScoresRadarChart scores={scores} loading={loading} />
        </div>
      </div>
      <ProTips />
      <AdvancedTools />
    </PageLayout>
  )
}

export default Optimize
