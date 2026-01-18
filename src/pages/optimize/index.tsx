import { useEffect } from 'react'
import { AdvancedTools } from './components/advanced-tools'
import Header from './components/header'
import { IssueAnalysis } from './components/issue-analysis'
import { OptimizeDashboard } from './components/optimize-dashboard'
import { ProTips } from './components/pro-tips'
import { RepairChecklist } from './components/repair-checklist'
import { MOCK_ISSUES } from './const'
import useAtsStore from './store'

function Optimize() {
  const { init } = useAtsStore()

  useEffect(() => {
    init()
  }, [init])

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6 overflow-x-hidden">
      <Header />
      <OptimizeDashboard />

      <div className="grid gap-6 md:grid-cols-12">
        <div className="md:col-span-8 space-y-6">
          <IssueAnalysis issues={MOCK_ISSUES} />
          <AdvancedTools />
        </div>

        <div className="md:col-span-4 space-y-6">
          <RepairChecklist />
          <ProTips />
        </div>
      </div>
    </div>
  )
}

export default Optimize
