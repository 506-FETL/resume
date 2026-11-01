import { useJobContextStore } from '@/lib/job-context'
import { JobContextBar } from '@/components/job-context'
import { useEffect } from 'react'
import { PageLayout } from '@/components/layout/page-layout'
import AdvancedTools from './components/advanced-tools'
import IssueAnalysis from './components/analysis'
import OptimizeDashboard from './components/dashboard'
import AssessmentBasisCard from './components/dashboard/assessment-basis-card'
import Header from './components/header'
import RepairChecklist from './components/repair-checklist'
import useAtsStore from './store'

function Optimize() {
  const jobContext = useJobContextStore((state) => state.context)
  const init = useAtsStore((state) => state.init)

  useEffect(() => {
    if (jobContext?.resumeId) {
      useAtsStore.getState().setAdvancedToolOpen(false)
      useAtsStore.getState().setAdvancedToolResumeContext(null)
      useAtsStore.getState().setSelectedResume(jobContext.resumeId, 'online')
    }

    init()
  }, [init, jobContext])

  return (
    <PageLayout>
      <JobContextBar />
      <Header />
      <OptimizeDashboard />

      <div className='grid min-w-0 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_18rem] xl:gap-10'>
        <section
          id='optimization-findings'
          aria-label='待处理项'
          className='min-w-0 scroll-mt-6 xl:col-start-1 xl:row-start-1'
        >
          <IssueAnalysis />
        </section>

        <aside className='min-w-0 border-t pt-6 xl:col-start-2 xl:row-start-1 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6'>
          <RepairChecklist />
        </aside>
      </div>
      <AssessmentBasisCard />
      <AdvancedTools />
    </PageLayout>
  )
}

export default Optimize
