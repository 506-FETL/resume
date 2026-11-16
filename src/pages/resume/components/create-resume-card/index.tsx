import { FormSkeleton } from '@/components/loading-skeleton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import useResumeListStore from '@/pages/resume/store'
import useUserStore from '@/store/user'
import { Plus, X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import type { ReactNode, RefObject } from 'react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import useMeasure from 'react-use-measure'
import { CreationChoices } from './components/choose-step'
import { CreationFooter } from './components/creation-footer'
import { CreationStepPanel } from './components/creation-step-panel'
import ImportPreview from './components/import-preview'
import ImportSource from './components/import-source'
import { CreationJob } from './components/job-step'
import { CreationProfile } from './components/profile-step'
import TemplatePicker from './components/template-picker'
import { useCreationFlow } from './hooks/use-creation-flow'
import { useCreationDraftStore } from './store'
import type { CreationStep } from './types'

export default function CreateResumeCard({
  trigger,
  online,
  onCreated,
  open,
  onOpenChange,
  hideTrigger,
  returnFocusRef,
}: {
  trigger?: ReactNode
  online?: boolean
  onCreated?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const reduceMotion = useReducedMotion()
  const [measureRef, bounds, refreshBounds] = useMeasure({ offsetSize: true })
  const user = useUserStore((state) => state.currentUser)
  const isOnline = Boolean(user) && (online ?? true)
  const [localOpen, setLocalOpen] = useState(false)
  const isOpen = open ?? localOpen
  const setIsOpen = onOpenChange ?? setLocalOpen
  const panelHostRef = useRef<HTMLDivElement | null>(null)
  const detailsFormId = useId()
  const step = useCreationDraftStore((state) => state.step)
  const setStep = useCreationDraftStore((state) => state.setStep)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const draft = useCreationDraftStore((state) => state.draft)
  const loadedScope = useCreationDraftStore((state) => state.scope)
  const ready = useCreationDraftStore((state) => state.ready)
  const saveError = useCreationDraftStore((state) => state.saveError)

  const flow = useCreationFlow({
    open: isOpen,
    online: isOnline,
    onCreated,
    onClose: () => setIsOpen(false),
  })

  const list = useResumeListStore()
  const loadOptions = list.loadLibraryOptions

  useEffect(() => {
    if (isOpen && step === 'job') loadOptions()
  }, [isOpen, step, user?.id, loadOptions])

  useLayoutEffect(() => {
    if (!reduceMotion) return

    const dialog = panelHostRef.current?.parentElement
    const overlay = dialog?.previousElementSibling

    dialog?.getAnimations().forEach((animation) => animation.finish())

    if (overlay?.matches('[data-slot="dialog-overlay"]'))
      overlay.getAnimations().forEach((animation) => animation.finish())
  }, [isOpen, reduceMotion])

  const title =
    step === 'review'
      ? '导入结果'
      : step === 'template'
        ? '选择模板'
        : step === 'details'
          ? '填写简历信息'
          : step === 'import'
            ? '导入旧简历'
            : step === 'profile'
              ? '从哪里开始写'
              : step === 'job'
                ? '选择用于岗位定制的简历'
                : '创建简历'

  const draftReady = ready && loadedScope === flow.scope
  const busy = flow.creating || flow.reading
  const templateWorkspace = step === 'template' || step === 'details'

  function go(next: CreationStep) {
    panelHostRef.current?.focus()
    flow.clearError()
    setStep(next)
  }

  function close(next: boolean) {
    if (flow.creating) return
    if (!next) flow.cancelRead()

    setIsOpen(next)
  }

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      {!hideTrigger &&
        (trigger ? (
          <DialogTrigger asChild>{trigger}</DialogTrigger>
        ) : (
          <DialogTrigger asChild>
            <Button
              variant='outline'
              type='button'
              className='h-full min-h-48 w-full flex-col gap-3 rounded-xl border-2 border-dashed bg-card p-6 transition-colors hover:border-primary/50 hover:bg-accent/40 motion-reduce:transition-none'
            >
              <Plus className='size-6' />
              创建新简历
            </Button>
          </DialogTrigger>
        ))}
      <DialogContent
        showCloseButton={false}
        className='block overflow-hidden p-0 transition-[width,height] sm:max-w-none'
        style={{
          width: bounds.width || 'min(600px, calc(100vw - 2rem))',
          height: bounds.height || undefined,
          transitionDuration: `${reduceMotion ? 0 : DURATION.slow}s`,
          transitionTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
          animationDuration: `${reduceMotion ? 0 : DURATION.base}s`,
        }}
        onInteractOutside={(event) => {
          if (flow.creating) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (flow.creating) event.preventDefault()
        }}
        onCloseAutoFocus={(event) => {
          const target = returnFocusRef?.current ?? previousFocusRef.current

          if (target?.isConnected) {
            event.preventDefault()
            target.focus()
          }
        }}
      >
        <div ref={panelHostRef} tabIndex={-1} className='outline-none'>
          <AnimatePresence initial={false} mode='wait'>
            <CreationStepPanel
              key={
                draftReady
                  ? templateWorkspace
                    ? 'template-workspace'
                    : step
                  : 'loading'
              }
              measureRef={measureRef}
              refreshBounds={refreshBounds}
              className={cn(
                'relative flex max-h-[90dvh] w-[min(600px,calc(100vw-2rem))] flex-col gap-4 p-5',
                draftReady &&
                  (step === 'review' || templateWorkspace) &&
                  'h-[min(88dvh,48rem)] w-[min(960px,calc(100vw-2rem))]',
              )}
            >
              <DialogHeader className='shrink-0 pr-8'>
                <DialogTitle
                  ref={(node) => {
                    headingRef.current = node

                    if (node && isOpen) {
                      const focused = document.activeElement

                      if (
                        focused instanceof HTMLElement &&
                        focused !== document.body &&
                        !node.closest('[role=dialog]')?.contains(focused)
                      )
                        previousFocusRef.current = focused
                      if (
                        focused === panelHostRef.current ||
                        !node.closest('[role=dialog]')?.contains(focused)
                      )
                        node.focus()
                    }
                  }}
                  tabIndex={-1}
                  className='text-lg outline-none'
                >
                  {title}
                </DialogTitle>
                <DialogDescription
                  className={step === 'profile' ? undefined : 'sr-only'}
                >
                  {step === 'profile'
                    ? '将填入对应示例，创建后可修改。'
                    : step === 'review'
                      ? '查看自动填充的简历，选择模板或按需修改。'
                      : step === 'template'
                        ? '选择简历排版。'
                        : step === 'details'
                          ? '填写简历名称和描述后创建，两项都可以留空。'
                          : '选择创建简历的方式。'}
                </DialogDescription>
              </DialogHeader>
              <Button
                variant='ghost'
                size='icon-sm'
                className='absolute top-4 right-4'
                disabled={flow.creating}
                onClick={() => close(false)}
                aria-label='关闭创建简历'
              >
                <X />
              </Button>
              {!draftReady ? (
                <FormSkeleton
                  label='正在读取草稿'
                  className='min-h-[min(16rem,60dvh)] px-0'
                />
              ) : (
                <>
                  <div
                    data-creation-scroll
                    className={cn(
                      'relative min-h-0 flex-1 overscroll-y-contain',
                      templateWorkspace
                        ? 'overflow-visible'
                        : 'overflow-y-auto p-1 -m-1',
                    )}
                  >
                    {step === 'choose' && (
                      <CreationChoices go={go} headingRef={headingRef} />
                    )}
                    {step === 'profile' && <CreationProfile />}
                    {step === 'import' && (
                      <ImportSource
                        onFile={flow.readFile}
                        onParse={flow.parseText}
                        onCancel={flow.cancelRead}
                        stage={flow.importStage}
                      />
                    )}
                    {step === 'review' && <ImportPreview />}
                    {templateWorkspace && (
                      <TemplatePicker
                        formId={detailsFormId}
                        busy={busy}
                        onCreate={() => flow.create()}
                      />
                    )}
                    {step === 'job' && (
                      <CreationJob go={go} onClose={() => setIsOpen(false)} />
                    )}
                  </div>
                  {(flow.error || saveError) && (
                    <div
                      role='alert'
                      className='shrink-0 text-sm text-destructive'
                    >
                      {flow.error || saveError}
                      {saveError && (
                        <Button
                          variant='link'
                          size='sm'
                          onClick={() =>
                            useCreationDraftStore
                              .getState()
                              .persist()
                              .catch(() => undefined)
                          }
                        >
                          重试保存草稿
                        </Button>
                      )}
                    </div>
                  )}
                  {draft.creation && !flow.creating && (
                    <p className='text-xs text-muted-foreground'>
                      创建尚未确认，重试不会重复保存。
                    </p>
                  )}
                  <CreationFooter
                    step={step}
                    go={go}
                    headingRef={headingRef}
                    flow={flow}
                    detailsFormId={detailsFormId}
                    isOnline={isOnline}
                  />
                </>
              )}
            </CreationStepPanel>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  )
}
