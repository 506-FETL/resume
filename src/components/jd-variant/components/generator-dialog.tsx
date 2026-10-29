import { bindJobResume, useJobContextStore } from '@/lib/job-context'
import type { RecentJd } from './steps/step-input'
import { AlertCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DURATION, EASE } from '@/lib/motion'
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
  jobId?: string
  initialJd?: string
  skipInputStep?: boolean
}

export function JdVariantDialog({
  open,
  onOpenChange,
  parentResumeId,
  onOpenResume,
  recentJds,
  jobId,
  initialJd = '',
  skipInputStep = false,
}: JdVariantDialogProps) {
  const [jd, setJd] = useState(initialJd)
  const [opening, setOpening] = useState(false)

  const { state, generate, abort, reset, discardDraft } =
    useJdVariantGenerator(parentResumeId)

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
      toast.info('正在后台生成，可在“派生任务”查看进度')
    }
    if (!next && state.phase === 'idle') {
      reset()
      setJd('')
    }

    onOpenChange(next)
  }

  const stepIndex =
    state.phase === 'idle'
      ? 1
      : state.phase === 'parsing'
        ? 2
        : state.phase === 'rewriting'
          ? 3
          : 4

  const total = 4
  const canStart = jd.trim().length >= MIN_JD_CHARS

  const handleDiscardTask = () => {
    discardDraft().catch(() => undefined)
    onOpenChange(false)
  }

  const handleOpenResult = async () => {
    if (!state.draftResumeId || opening) return

    setOpening(true)

    try {
      if (jobId) {
        const context = await bindJobResume(jobId, state.draftResumeId)

        if (useJobContextStore.getState().context?.id !== jobId) return

        useJobContextStore.getState().setContext(context)
        toast.success('已设为这个岗位准备中的简历')
      }

      onOpenResume(state.draftResumeId)
      onOpenChange(false)
      reset()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '关联失败，请重试')
    } finally {
      setOpening(false)
    }
  }

  const handleDiscardResult = () => {
    discardDraft().catch(() => undefined)
    reset()
    onOpenChange(false)
  }

  const footer = (() => {
    if (state.phase === 'idle') {
      return (
        <Button type='button' disabled={!canStart} onClick={startGenerate}>
          开始派生
        </Button>
      )
    }

    if (state.phase === 'parsing' || state.phase === 'rewriting') {
      return (
        <Button type='button' variant='outline' onClick={abort}>
          取消生成
        </Button>
      )
    }

    if (state.phase === 'error') {
      return (
        <>
          <Button type='button' variant='outline' onClick={handleDiscardTask}>
            放弃草稿
          </Button>
          <Button type='button' onClick={startGenerate}>
            重试
          </Button>
        </>
      )
    }

    if (state.phase === 'aborted') {
      return (
        <>
          <Button type='button' variant='outline' onClick={handleDiscardTask}>
            丢弃草稿
          </Button>
          <Button type='button' disabled={!jd.trim()} onClick={startGenerate}>
            重新生成
          </Button>
        </>
      )
    }

    return (
      <>
        <Button type='button' variant='outline' onClick={handleDiscardResult}>
          丢弃
        </Button>
        <Button
          type='button'
          disabled={!state.draftResumeId || opening}
          onClick={handleOpenResult}
        >
          {jobId ? '设为准备中的简历并打开' : '打开新简历'}
        </Button>
      </>
    )
  })()

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent className='min-h-0 sm:max-h-[82vh] sm:max-w-2xl'>
        <ResponsiveDialogHeader className='shrink-0 gap-3 border-b px-6 pb-5 pt-6 text-left'>
          <ResponsiveDialogTitle>岗位定制</ResponsiveDialogTitle>
          <ResponsiveDialogDescription aria-live='polite'>
            <span className='sr-only'>{`当前第 ${stepIndex} / ${total} 步`}</span>
          </ResponsiveDialogDescription>
          <GeneratorStepIndicator phase={state.phase} />
        </ResponsiveDialogHeader>

        <ScrollArea className='min-h-0 flex-1'>
          <div className='min-h-55 px-6 py-5'>
            <AnimatePresence mode='wait' initial={false}>
              <motion.div
                key={state.phase}
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -4 }}
                transition={{
                  duration: shouldReduceMotion ? 0 : DURATION.base,
                  ease: EASE.out,
                }}
              >
                {state.phase === 'idle' && (
                  <StepInput
                    value={jd}
                    onChange={setJd}
                    recentJds={recentJds}
                  />
                )}
                {state.phase === 'parsing' && (
                  <StepParsing
                    reasoning={state.parseReasoning}
                    keywords={state.keywords}
                  />
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
                  <StepResult
                    matchRate={state.matchRate}
                    changes={state.changes}
                  />
                )}
                {state.phase === 'error' && (
                  <Alert variant='destructive'>
                    <AlertCircle aria-hidden />
                    <AlertTitle>派生失败</AlertTitle>
                    <AlertDescription>
                      {state.errorMessage ?? '派生失败，请稍后重试。'}
                    </AlertDescription>
                  </Alert>
                )}
                {state.phase === 'aborted' && (
                  <Alert>
                    <AlertCircle aria-hidden />
                    <AlertTitle>已取消派生</AlertTitle>
                    <AlertDescription>草稿已保留。</AlertDescription>
                  </Alert>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </ScrollArea>

        <ResponsiveDialogFooter className='shrink-0 gap-2 border-t bg-background'>
          {footer}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
