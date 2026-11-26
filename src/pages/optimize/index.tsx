import { useSearchParams } from 'react-router-dom'
import { prepareOptimizeReport } from '@/lib/optimize-route'
import { useJobContextStore } from '@/lib/job-context-store'
import { JobContextBar } from '@/components/job-context/bar'
import { useEffect } from 'react'
import { PageLayout } from '@/components/layout/page-layout'
import AdvancedTools from './components/advanced-tools'
import IssueAnalysis from './components/analysis'
import OptimizeDashboard from './components/dashboard'
import AssessmentBasisCard from './components/dashboard/assessment-basis-card'
import Header from './components/header'
import RepairChecklist from './components/repair-checklist'
import useAtsStore from './store'
import useUserStore from '@/store/user'

function Optimize() {
  const jobContext = useJobContextStore((state) => state.context)
  const [params] = useSearchParams()
  const jobId = params.get('jobId') || null
  const target = jobId && jobContext?.id === jobId ? jobContext.resumeId : null
  const ownerId = useUserStore((state) => state.currentUser?.id)

  useEffect(() => {
    if (!ownerId) return

    if (target) {
      useAtsStore.getState().setAdvancedToolOpen(false)
      useAtsStore.getState().setAdvancedToolResumeContext(null)
    }

    prepareOptimizeReport(ownerId, jobId, target ?? undefined)
  }, [jobId, target, ownerId])

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
