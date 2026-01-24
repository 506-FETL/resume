import { useEffect } from 'react'
import AdvancedTools from './components/advanced-tools'
import IssueAnalysis from './components/analysis'
import OptimizeDashboard from './components/dashboard'
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
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      <Header />
      <OptimizeDashboard />

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        <div className="lg:col-span-8 space-y-8">
          <IssueAnalysis />
          <AdvancedTools />
        </div>

        <div className="lg:col-span-4 space-y-8">
          <RepairChecklist />
          <ProTips />
        </div>
      </div>
    </div>
  )
}

export default Optimize
