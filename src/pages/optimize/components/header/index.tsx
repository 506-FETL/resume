import { useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/page-layout'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import useAtsStore from '../../store'
import { AnalysisActions } from './analysis-actions'
import { AnalysisDialog } from './analysis-dialog'
import { ResumeManager } from './resume-manager'
import { celebrate } from './utils'

function Header() {
  const startAnalysis = useAtsStore((s) => s.startAnalysis)
  const analysisState = useAtsStore((s) => s.analysisState)
  const loadError = useAtsStore((s) => s.loadError)
  const analysisError = useAtsStore((s) => s.analysisError)
  const hasReport = useAtsStore((s) => s.currentAtsConfig !== null)
  const init = useAtsStore((s) => s.init)
  const loading = useAtsStore((s) => s.loading)
  const reduceMotion = useReducedMotion()
  const { status, logs, reasoning, content } = analysisState

  const [isOpen, setIsOpen] = useState(false)

  const hasAnalysis = useMemo(() => {
    return (
      status !== 'idle' &&
      (reasoning || content || Object.keys(logs).length > 0)
    )
  }, [status, reasoning, content, logs])

  const isProcessing = status !== 'idle' && status !== 'complete'

  useEffect(() => {
    if (!isProcessing) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isProcessing])

  const handleStartAnalysis = useCallback(() => {
    setIsOpen(true)

    startAnalysis({
      onComplete: () => {
        if (!reduceMotion) celebrate()
      },
    })
  }, [startAnalysis, reduceMotion])

  const handleViewAnalysis = useCallback(() => {
    setIsOpen(true)
  }, [])

  return (
    <div className='min-w-0 space-y-4'>
      <PageHeader
        title='简历优化'
        description='先检测，再按优先级完善内容。'
        actions={
          <>
            <ResumeManager />
            <AnalysisActions
              hasAnalysis={Boolean(hasAnalysis)}
              isProcessing={isProcessing}
              onViewAnalysis={handleViewAnalysis}
              onStartAnalysis={handleStartAnalysis}
            />
          </>
        }
      />
      <AnimatedContent
        animationKey={
          isProcessing
            ? 'processing'
            : loadError
              ? 'load-error'
              : analysisError
                ? 'analysis-error'
                : 'idle'
        }
        className='empty:hidden'
      >
        {isProcessing ? (
          <p role='status' className='rounded-lg bg-muted px-4 py-3 text-sm'>
            正在检测简历，完成后会更新报告。你可以通过“查看分析”查看进度。
          </p>
        ) : loadError || analysisError ? (
          <div
            role='alert'
            className='flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm'
          >
            <p>
              {loadError
                ? '报告加载失败，请重试。'
                : '本次检测未完成，请重试。'}
              {hasReport && '已有报告仍可查看。'}
            </p>
            {loadError && (
              <Button
                size='sm'
                variant='outline'
                disabled={loading}
                onClick={() => {
                  init()
                }}
              >
                重新加载
              </Button>
            )}
          </div>
        ) : null}
      </AnimatedContent>
      <AnalysisDialog open={isOpen} onOpenChange={setIsOpen} />
    </div>
  )
}

export default Header
