import type { RecentJd } from './steps/step-input'
import { AlertCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  const { state, generate, abort, reset, discardDraft } = useJdVariantGenerator(parentResumeId)

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

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
        <ResponsiveDialogContent className="max-w-xl">
          <ResponsiveDialogHeader className="border-b px-6 pb-4 pt-6 text-left">
            <ResponsiveDialogTitle>JD 驱动派生简历</ResponsiveDialogTitle>
            <ResponsiveDialogDescription aria-live="polite">
              {`第 ${stepIndex} / ${total} 步`}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
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
                reasoning={state.rewriteReasoning}
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

            {state.phase === 'aborted' && (
              <Alert>
                <AlertCircle className="size-4" aria-hidden />
                <AlertTitle>已取消派生</AlertTitle>
                <AlertDescription className="space-y-2">
                  <div>生成已取消，草稿仍保留。</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={!jd.trim()} onClick={startGenerate}>重新生成</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        discardDraft().catch(() => undefined)
                        onOpenChange(false)
                      }}
                    >
                      丢弃草稿
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  )
}
