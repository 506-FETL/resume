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
import { Spinner } from '@/components/ui/spinner'
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

  const {
    state: currentState,
    generate,
    abort,
    reset,
    discardDraft,
  } = useJdVariantGenerator(parentResumeId)

  const [closingState, setClosingState] = useState<typeof currentState | null>(
    null,
  )

  const [discarding, setDiscarding] = useState(false)

  const state =
    open && !discarding ? currentState : (closingState ?? currentState)

  const shouldReduceMotion = useReducedMotion()

  const startGenerate = useCallback(() => {
    generate({ parentResumeId, jdText: jd })
  }, [generate, parentResumeId, jd])

  // 自动跳过 Step 1（来自 optimize 入口的预填）
  useEffect(() => {
    if (
      open &&
      skipInputStep &&
      !discarding &&
      currentState.phase === 'idle' &&
      initialJd.trim().length >= MIN_JD_CHARS
    ) {
      generate({ parentResumeId, jdText: initialJd })
    }
  }, [
    open,
    skipInputStep,
    discarding,
    currentState.phase,
    initialJd,
    generate,
    parentResumeId,
  ])

  useEffect(() => {
    if (open && currentState.phase === 'idle') {
      setJd(initialJd)
    }
  }, [initialJd, open, currentState.phase])

  const handleOpenChange = (next: boolean) => {
    if (!next && discarding) return

    if (!next) setClosingState(state)

    if (!next && (state.phase === 'parsing' || state.phase === 'rewriting')) {
      toast.info('正在后台生成，可在“派生任务”查看进度')
    }
    if (!next && state.phase === 'idle') {
      reset()
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
          : state.phase === 'success'
            ? 4
            : state.draftResumeId
              ? 3
              : 2

  const canStart = jd.trim().length >= MIN_JD_CHARS

  const handleDiscardTask = async () => {
    if (discarding) return

    setClosingState(state)
    setDiscarding(true)

    try {
      await discardDraft()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '丢弃失败，请重试')
    } finally {
      setDiscarding(false)
    }
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
      handleOpenChange(false)
      reset()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '关联失败，请重试')
    } finally {
      setOpening(false)
    }
  }

  const footer = (() => {
    if (state.phase === 'idle') {
      return (
        <Button type='button' disabled={!canStart} onClick={startGenerate}>
          生成岗位版本
        </Button>
      )
    }

    if (state.phase === 'parsing' || state.phase === 'rewriting') {
      return (
        <>
          <Button type='button' variant='ghost' onClick={abort}>
            取消生成
          </Button>
          <Button
            type='button'
            variant='outline'
            onClick={() => handleOpenChange(false)}
          >
            后台生成
          </Button>
        </>
      )
    }

    if (state.phase === 'error') {
      return (
        <>
          <Button
            type='button'
            variant='outline'
            disabled={discarding}
            onClick={handleDiscardTask}
          >
            {discarding && <Spinner />}
            {discarding ? '正在丢弃…' : '丢弃草稿'}
          </Button>
          <Button
            type='button'
            disabled={!canStart || discarding}
            onClick={startGenerate}
          >
            重试
          </Button>
        </>
      )
    }

    if (state.phase === 'aborted') {
      return (
        <>
          <Button
            type='button'
            variant='outline'
            disabled={discarding}
            onClick={handleDiscardTask}
          >
            {discarding && <Spinner />}
            {discarding ? '正在丢弃…' : '丢弃草稿'}
          </Button>
          <Button
            type='button'
            disabled={!canStart || discarding}
            onClick={startGenerate}
          >
            重新生成
          </Button>
        </>
      )
    }

    return (
      <>
        <Button
          type='button'
          variant='outline'
          disabled={discarding || opening}
          onClick={handleDiscardTask}
        >
          {discarding && <Spinner />}
          {discarding ? '正在丢弃…' : '丢弃'}
        </Button>
        <Button
          type='button'
          disabled={!state.draftResumeId || opening || discarding}
          onClick={handleOpenResult}
        >
          {opening && <Spinner />}
          {opening
            ? jobId
              ? '正在关联岗位…'
              : '正在打开…'
            : jobId
              ? '用于此岗位并打开'
              : '打开新简历'}
        </Button>
      </>
    )
  })()

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      contentClassName='h-[min(88dvh,48rem)] max-h-[calc(100dvh-2rem)] sm:max-w-[min(60rem,calc(100vw-3rem))] data-[swipe-axis=y]:[--drawer-content-height:90dvh] data-[swipe-axis=y]:[--drawer-content-max-height:90dvh]'
    >
      <ResponsiveDialogContent className='min-h-0 overflow-hidden'>
        <ResponsiveDialogHeader className='shrink-0 gap-4 border-b px-5 py-4 text-left sm:px-7 sm:py-5'>
          <ResponsiveDialogTitle>岗位定制</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className='sr-only'>
            根据职位描述调整简历表述，并另存一份岗位版本。
          </ResponsiveDialogDescription>
          <GeneratorStepIndicator phase={state.phase} step={stepIndex} />
        </ResponsiveDialogHeader>

        <ScrollArea className='min-h-0 flex-1 overflow-hidden [&_[data-slot=scroll-area-viewport]]:overscroll-contain'>
          <div className='px-5 py-5 sm:px-7 sm:py-6'>
            <AnimatePresence mode='wait' initial={false}>
              <motion.div
                key={state.phase}
                initial={{
                  opacity: 0,
                  transform: shouldReduceMotion ? 'none' : 'translateY(8px)',
                }}
                animate={{ opacity: 1, transform: 'translateY(0px)' }}
                exit={{
                  opacity: 0,
                  transform: shouldReduceMotion ? 'none' : 'translateY(-4px)',
                  transition: {
                    duration: shouldReduceMotion ? 0 : DURATION.fast,
                  },
                }}
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
                    <AlertTitle>岗位版本生成失败</AlertTitle>
                    <AlertDescription>
                      {state.errorMessage ?? '生成失败，请稍后重试。'}
                    </AlertDescription>
                  </Alert>
                )}
                {state.phase === 'aborted' && (
                  <Alert>
                    <AlertCircle aria-hidden />
                    <AlertTitle>已取消生成</AlertTitle>
                    <AlertDescription>
                      {state.errorMessage ??
                        (state.draftResumeId
                          ? '已保留草稿，可以重新生成或丢弃。'
                          : '尚未创建草稿，可以重新生成。')}
                    </AlertDescription>
                  </Alert>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </ScrollArea>

        <ResponsiveDialogFooter
          aria-busy={discarding}
          className='shrink-0 gap-3 border-t bg-background px-5 py-4 sm:px-7'
        >
          <div className='flex w-full flex-wrap items-center justify-between gap-3'>
            <p className='text-xs text-muted-foreground'>
              {discarding
                ? '正在丢弃草稿，请稍候…'
                : state.phase === 'idle'
                  ? '生成后保留原简历'
                  : state.phase === 'parsing' || state.phase === 'rewriting'
                    ? '关闭此窗口后会继续生成'
                    : state.phase === 'success'
                      ? '新简历已保存，可继续编辑'
                      : '可重新生成或丢弃任务'}
            </p>
            <div className='ml-auto flex flex-wrap justify-end gap-2'>
              {footer}
            </div>
          </div>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
