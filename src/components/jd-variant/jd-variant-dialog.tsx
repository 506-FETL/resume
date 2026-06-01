import type { RecentJd } from './steps/step-input'
import { AlertCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogHeader, ResponsiveDialogTitle } from '@/components/ui/responsive-dialog'
import { StepInput } from './steps/step-input'
import { StepParsing } from './steps/step-parsing'
import { StepResult } from './steps/step-result'
import { StepRewriting } from './steps/step-rewriting'
import { useJdVariantGenerator } from './use-jd-variant-generator'

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
  const [confirmClose, setConfirmClose] = useState(false)
  const { state, generate, abort, reset, discardDraft } = useJdVariantGenerator()

  const startGenerate = useCallback(() => {
    generate({ parentResumeId, jdText: jd })
  }, [generate, parentResumeId, jd])

  // 自动跳过 Step 1（来自 optimize 入口的预填）
  useEffect(() => {
    if (skipInputStep && state.phase === 'idle' && jd.trim().length > 0) {
      startGenerate()
    }
  }, [skipInputStep, state.phase, jd, startGenerate])

  const handleOpenChange = (next: boolean) => {
    if (!next && (state.phase === 'parsing' || state.phase === 'rewriting')) {
      setConfirmClose(true)
      return
    }
    if (!next) {
      reset()
      setJd('')
    }
    onOpenChange(next)
  }

  const stepIndex = state.phase === 'idle' ? 1 : state.phase === 'parsing' ? 2 : state.phase === 'rewriting' ? 3 : 4
  const total = 4

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
        <ResponsiveDialogContent className="max-w-xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>JD 驱动派生简历</ResponsiveDialogTitle>
            <ResponsiveDialogDescription aria-live="polite">
              第
              {' '}
              {stepIndex}
              {' '}
              /
              {' '}
              {total}
              {' '}
              步
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {state.phase === 'error' && state.errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertTitle>派生失败</AlertTitle>
              <AlertDescription className="space-y-2">
                <div>{state.errorMessage}</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={startGenerate}>重试</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      discardDraft().catch(() => undefined)
                      reset()
                    }}
                  >
                    放弃草稿
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {state.phase === 'idle' && (
            <StepInput value={jd} onChange={setJd} onSubmit={startGenerate} recentJds={recentJds} />
          )}
          {state.phase === 'parsing' && (
            <StepParsing reasoning={state.parseReasoning} keywords={state.keywords} onAbort={abort} />
          )}
          {state.phase === 'rewriting' && (
            <StepRewriting
              completedSections={state.completedSections}
              changes={state.changes}
              estimatedTotal={5}
              onAbort={abort}
            />
          )}
          {state.phase === 'success' && state.draftResumeId && (
            <StepResult
              matchRate={state.matchRate}
              changes={state.changes}
              onOpen={() => {
                if (state.draftResumeId) {
                  onOpenResume(state.draftResumeId)
                }
                onOpenChange(false)
                reset()
              }}
              onDiscard={() => {
                discardDraft().catch(() => undefined)
                reset()
                onOpenChange(false)
              }}
            />
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定关闭？</AlertDialogTitle>
            <AlertDialogDescription>正在派生中，关闭将取消生成并删除草稿。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续派生</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                abort()
                discardDraft().catch(() => undefined)
                reset()
                setConfirmClose(false)
                onOpenChange(false)
              }}
            >
              关闭并丢弃
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
