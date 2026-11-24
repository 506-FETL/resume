import { createDeferredComponent } from '@/components/deferred-content'
import CatalogSkeleton from '@/pages/template/components/catalog-skeleton'
import { FormSkeleton } from '@/components/loading-skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import useResumeListStore from '@/pages/resume/store'
import useUserStore from '@/store/user'
import { AnimatePresence } from 'motion/react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { CreationChoices } from '../choose-step'
import { CreationFooter } from '../creation-footer'
import { CreationStepPanel } from '../creation-step-panel'
import ImportSource from '../import-source'
import { CreationJob } from '../job-step'
import { CreationProfile } from '../profile-step'
import { useCreationFlow } from '../../hooks/use-creation-flow'
import { useCreationDraftStore } from '../../store'
import type { CreationStep } from '../../types'

const ImportPreview = createDeferredComponent(
  () => import('../import-preview'),
  '导入结果',
  <FormSkeleton label='正在加载导入结果' className='px-0' />,
  { wrapFallback: false },
)

const TemplatePicker = createDeferredComponent(
  () => import('../template-picker'),
  '模板列表',
  <CatalogSkeleton className='grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4' />,
  { wrapFallback: false },
)

interface CreationContentProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  online?: boolean
  onCreated?: () => void
  creating: boolean
  setCreating: Dispatch<SetStateAction<boolean>>
  panelHostRef: RefObject<HTMLDivElement | null>
  cancelReadRef: RefObject<(() => void) | null>
  measureRef: (element: HTMLDivElement | null) => void
  refreshBounds: () => void
}

export default function CreationContent({
  isOpen,
  setIsOpen,
  online,
  onCreated,
  creating,
  setCreating,
  panelHostRef,
  cancelReadRef,
  measureRef,
  refreshBounds,
}: CreationContentProps) {
  const user = useUserStore((state) => state.currentUser)
  const isOnline = Boolean(user) && (online ?? true)
  const detailsFormId = useId()
  const [detailsForm, setDetailsForm] = useState<HTMLFormElement | null>(null)
  const step = useCreationDraftStore((state) => state.step)
  const setStep = useCreationDraftStore((state) => state.setStep)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const draft = useCreationDraftStore((state) => state.draft)
  const loadedScope = useCreationDraftStore((state) => state.scope)
  const ready = useCreationDraftStore((state) => state.ready)
  const saveError = useCreationDraftStore((state) => state.saveError)

  const flow = useCreationFlow({
    open: isOpen,
    online: isOnline,
    onCreated,
    onClose: () => setIsOpen(false),
    creating,
    setCreating,
  })

  const list = useResumeListStore()
  const loadOptions = list.loadLibraryOptions

  useEffect(() => {
    if (isOpen && step === 'job') loadOptions()
  }, [isOpen, step, user?.id, loadOptions])

  useLayoutEffect(() => {
    cancelReadRef.current = flow.cancelRead

    return () => {
      cancelReadRef.current = null
    }
  }, [cancelReadRef, flow.cancelRead])

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

  return (
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
        <div className='flex shrink-0 flex-col gap-2 pr-8'>
          <h2
            ref={(node) => {
              headingRef.current = node

              if (node && isOpen) {
                const focused = document.activeElement

                if (
                  focused === panelHostRef.current ||
                  !node.closest('[role=dialog]')?.contains(focused)
                )
                  node.focus()
              }
            }}
            tabIndex={-1}
            className='font-heading text-lg leading-none font-medium outline-none'
          >
            {title}
          </h2>
          <p
            className={
              step === 'profile' ? 'text-sm text-muted-foreground' : 'sr-only'
            }
          >
            {step === 'profile'
              ? '将填入对应示例，创建后可修改。'
              : step === 'review'
                ? '查看简历，选择模板或按需修改。'
                : step === 'template'
                  ? '选择简历排版。'
                  : step === 'details'
                    ? '填写简历名称和描述后创建，两项都可以留空。'
                    : '选择创建简历的方式。'}
          </p>
        </div>
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
                  formRef={setDetailsForm}
                  busy={busy}
                  onCreate={() => flow.create()}
                />
              )}
              {step === 'job' && (
                <CreationJob go={go} onClose={() => setIsOpen(false)} />
              )}
            </div>
            {(flow.error || saveError) && (
              <div role='alert' className='shrink-0 text-sm text-destructive'>
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
              detailsFormReady={Boolean(detailsForm)}
              isOnline={isOnline}
            />
          </>
        )}
      </CreationStepPanel>
    </AnimatePresence>
  )
}
