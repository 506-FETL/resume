import { useEffect } from 'react'
import AdvancedTools from './components/advanced-tools'
import IssueAnalysis from './components/analysis'
import OptimizeDashboard from './components/dashboard'
import AssessmentBasisCard from './components/dashboard/assessment-basis-card'
import Header from './components/header'
import ProTips from './components/pro-tips'
import RepairChecklist from './components/repair-checklist'
import useAtsStore from './store'

function Optimize() {
  const { init } = useAtsStore()

  useEffect(() => {
    init()
  }, [init])

  return (
    <div className="relative min-w-0">
      <div className="sticky top-13 z-10">
        <ProTips />
      </div>
      <main className="mx-auto w-full max-w-[90rem] space-y-4 px-4 py-5 sm:px-6 md:space-y-6 md:py-8 lg:px-8">
        <Header />
        <OptimizeDashboard />

        <div className="grid min-w-0 items-start gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 xl:col-start-1 xl:row-start-1">
            <IssueAnalysis />
          </div>

          <div className="min-w-0 xl:sticky xl:top-26 xl:col-start-2 xl:row-span-2 xl:row-start-1">
            <RepairChecklist />
          </div>

          <div className="min-w-0 xl:col-start-1 xl:row-start-2">
            <AssessmentBasisCard />
          </div>
        </div>
        <AdvancedTools />
      </main>
    </div>
  )
}

export default Optimize
