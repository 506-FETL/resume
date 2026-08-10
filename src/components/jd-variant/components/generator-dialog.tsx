import type { RecentJd } from './steps/step-input'
import { AlertCircle } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogFooter, ResponsiveDialogHeader, ResponsiveDialogTitle } from '@/components/ui/responsive-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MIN_JD_CHARS } from '../const'
import { useJdVariantGenerator } from '../hooks/use-generator'
import { GeneratorStepIndicator } from './generator-step-indicator'
import { StepInput } from './steps/step-input'
import { StepParsing } from './steps/step-parsing'
import { StepResult } from './steps/step-result'
import { StepRewriting } from './steps/step-rewriting'

export interface JdVariantDialogProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  parentResumeId: string
  onOpenResume: (draftId: string) => void
  recentJds: RecentJd[]
  initialJd?: string
  skipInputStep?: boolean
}

export function JdVariantDialog({
  open,
  onOpenChange,
  parentResumeId,
  onOpenResume,
  recentJds,
  initialJd = '',
  skipInputStep = false,
}: JdVariantDialogProps) {
  const [jd, setJd] = useState(initialJd)
  const { state, generate, abort, reset, discardDraft } = useJdVariantGenerator(parentResumeId)
  const shouldReduceMotion = useReducedMotion()

  const startGenerate = useCallback(() => {
    generate({ parentResumeId, jdText: jd })
  }, [generate, parentResumeId, jd])

  // 自动跳过 Step 1（来自 optimize 入口的预填）
  useEffect(() => {
    if (skipInputStep && state.phase === 'idle' && jd.trim().length > 0) {
      startGenerate()
    }
  }, [skipInputStep, state.phase, jd, startGenerate])

  useEffect(() => {
    if (open && state.phase === 'idle') {
      setJd(initialJd)
    }
  }, [initialJd, open, state.phase])

  const handleOpenChange = (next: boolean) => {
    if (!next && (state.phase === 'parsing' || state.phase === 'rewriting')) {
      toast.info('正在后台继续派生，可在右上角“派生任务”查看进度')
    }
    if (!next && state.phase === 'idle') {
      reset()
      setJd('')
    }
    onOpenChange(next)
  }

  const stepIndex = state.phase === 'idle' ? 1 : state.phase === 'parsing' ? 2 : state.phase === 'rewriting' ? 3 : 4
  const total = 4
  const canStart = jd.trim().length >= MIN_JD_CHARS

  const handleDiscardTask = () => {
    discardDraft().catch(() => undefined)
    onOpenChange(false)
  }

  const handleOpenResult = () => {
    if (state.draftResumeId) {
      onOpenResume(state.draftResumeId)
    }
    onOpenChange(false)
    reset()
  }

  const handleDiscardResult = () => {
    discardDraft().catch(() => undefined)
    reset()
    onOpenChange(false)
  }

  const footer = (() => {
    if (state.phase === 'idle') {
      return <Button type="button" disabled={!canStart} onClick={startGenerate}>开始派生</Button>
    }

    if (state.phase === 'parsing' || state.phase === 'rewriting') {
      return <Button type="button" variant="outline" onClick={abort}>取消生成</Button>
    }

    if (state.phase === 'error') {
      return (
        <>
          <Button type="button" variant="outline" onClick={handleDiscardTask}>放弃草稿</Button>
          <Button type="button" onClick={startGenerate}>重试</Button>
        </>
      )
    }

    if (state.phase === 'aborted') {
      return (
        <>
          <Button type="button" variant="outline" onClick={handleDiscardTask}>丢弃草稿</Button>
          <Button type="button" disabled={!jd.trim()} onClick={startGenerate}>重新生成</Button>
        </>
      )
    }

    return (
      <>
        <Button type="button" variant="outline" onClick={handleDiscardResult}>丢弃</Button>
        <Button type="button" disabled={!state.draftResumeId} onClick={handleOpenResult}>打开新简历</Button>
      </>
    )
  })()

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent className="min-h-0 sm:max-h-[82vh] sm:max-w-2xl">
        <ResponsiveDialogHeader className="shrink-0 gap-3 border-b px-6 pb-5 pt-6 text-left">
          <ResponsiveDialogTitle>JD 驱动派生简历</ResponsiveDialogTitle>
          <ResponsiveDialogDescription aria-live="polite">
            根据目标岗位局部优化简历文案，事实型字段保持不变。
            <span className="sr-only">{`当前第 ${stepIndex} / ${total} 步`}</span>
          </ResponsiveDialogDescription>
          <GeneratorStepIndicator phase={state.phase} />
        </ResponsiveDialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="min-h-[220px] px-6 py-5">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={state.phase}
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -4 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: 'easeOut' }}
              >
                {state.phase === 'idle' && (
                  <StepInput value={jd} onChange={setJd} recentJds={recentJds} />
                )}
                {state.phase === 'parsing' && (
                  <StepParsing reasoning={state.parseReasoning} keywords={state.keywords} />
                )}
                {state.phase === 'rewriting' && (
                  <StepRewriting
                    completedSections={state.completedSections}
                    changes={state.changes}
                    estimatedTotal={5}
                    reasoning={state.rewriteReasoning}
                  />
                )}
                {state.phase === 'success' && state.draftResumeId && (
                  <StepResult matchRate={state.matchRate} changes={state.changes} />
                )}
                {state.phase === 'error' && (
                  <Alert variant="destructive">
                    <AlertCircle aria-hidden />
                    <AlertTitle>派生失败</AlertTitle>
                    <AlertDescription>{state.errorMessage ?? '派生失败，请稍后重试。'}</AlertDescription>
                  </Alert>
                )}
                {state.phase === 'aborted' && (
                  <Alert>
                    <AlertCircle aria-hidden />
                    <AlertTitle>已取消派生</AlertTitle>
                    <AlertDescription>生成已取消，草稿仍保留。</AlertDescription>
                  </Alert>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </ScrollArea>

        <ResponsiveDialogFooter className="shrink-0 gap-2 border-t bg-background">
          {footer}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
