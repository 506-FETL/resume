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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="size-5 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">ATS 优化助手</h1>
          </div>
          <p className="text-sm text-muted-foreground pl-11 max-w-lg">
            基于 AI 深度分析，为您提供专业的简历优化建议，提升通过 ATS 筛选的概率。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 pl-11">
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
