import { Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import useAtsStore from '../../store'
import { AnalysisActions } from './analysis-actions'
import { AnalysisDialog } from './analysis-dialog'
import { ResumeManager } from './resume-manager'
import { celebrate } from './utils'

function Header() {
  const startAnalysis = useAtsStore(s => s.startAnalysis)
  const analysisState = useAtsStore(s => s.analysisState)
  const { status, logs, reasoning, content } = analysisState

  const [isOpen, setIsOpen] = useState(false)

  const hasAnalysis = useMemo(() => {
    return status !== 'idle' && (
      reasoning
      || content
      || Object.keys(logs).length > 0
    )
  }, [status, reasoning, content, logs])

  const isProcessing = status !== 'idle' && status !== 'complete'

  useEffect(() => {
    if (!isProcessing)
      return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isProcessing])

  const handleStartAnalysis = useCallback(() => {
    setIsOpen(true)
    startAnalysis({ onComplete: celebrate })
  }, [startAnalysis])

  const handleViewAnalysis = useCallback(() => {
    setIsOpen(true)
  }, [])

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2">
            <Sparkles className="size-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">ATS 优化助手</h1>
        </div>

        <div className="flex flex-row gap-2 flex-wrap items-center">
          <ResumeManager />
          <AnalysisActions
            hasAnalysis={Boolean(hasAnalysis)}
            isProcessing={isProcessing}
            onViewAnalysis={handleViewAnalysis}
            onStartAnalysis={handleStartAnalysis}
          />

        </div>
      </div>

      <AnalysisDialog open={isOpen} onOpenChange={setIsOpen} />
    </div>
  )
}

export default Header
