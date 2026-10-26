import { jobContextUrl, useJobContextStore } from '@/lib/job-context'
import { toast } from 'sonner'
import type { ReactNode, RefObject } from 'react'
import type { CreationStep } from './types'
import type { ResumeProfile } from '@/lib/resume-preparation/types'
import { ArrowLeft, ArrowRight, FileText, Plus, Target, X } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useMeasure from 'react-use-measure'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { DURATION, EASE } from '@/lib/motion'
import { PROFILE_GUIDES } from '@/lib/resume-preparation/const'
import { cn } from '@/lib/utils'
import useResumeListStore from '@/pages/resume/store'
import useUserStore from '@/store/user'
import ImportPreview from './components/import-preview'
import ImportSource from './components/import-source'
import { useCreationFlow } from './hooks/use-creation-flow'
import { useCreationDraftStore } from './store'
import { importReady } from './utils'
import TemplatePicker from './components/template-picker'

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
  const jobContext = useJobContextStore((state) => state.context)
  const reduceMotion = useReducedMotion()
  const [measureRef, bounds] = useMeasure({ offsetSize: true })
  const navigate = useNavigate()
  const user = useUserStore((state) => state.currentUser)
  const isOnline = Boolean(user) && (online ?? true)
  const [localOpen, setLocalOpen] = useState(false)
  const isOpen = open ?? localOpen
  const setIsOpen = onOpenChange ?? setLocalOpen
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const step = useCreationDraftStore((state) => state.step)
  const setStep = useCreationDraftStore((state) => state.setStep)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const draft = useCreationDraftStore((state) => state.draft)
  const loadedScope = useCreationDraftStore((state) => state.scope)
  const ready = useCreationDraftStore((state) => state.ready)
  const saveError = useCreationDraftStore((state) => state.saveError)
  const saving = useCreationDraftStore((state) => state.saving)
  const patch = useCreationDraftStore((state) => state.patch)

  const flow = useCreationFlow({
    open: isOpen,
    online: isOnline,
    onCreated,
    onClose: () => setIsOpen(false),
  })

  const accountId = useResumeListStore((state) => state.accountId)
  const cloudResumes = useResumeListStore((state) => state.resumes)
  const offlineResumes = useResumeListStore((state) => state.offlineResumes)
  const listLoading = useResumeListStore((state) => state.loading)
  const listError = useResumeListStore((state) => state.loadError)

  useEffect(() => {
    if (isOpen && step === 'job') useResumeListStore.getState().loadResumes()
  }, [isOpen, step, user?.id])

  const resumes = user && accountId === user.id ? cloudResumes : offlineResumes

  useEffect(() => {
    if (isOpen) {
      scrollRef.current?.scrollTo({ top: 0 })

      if (step === 'review') headingRef.current?.focus()
    }
  }, [step, isOpen])

  const title =
    step === 'review'
      ? '导入结果'
      : step === 'template'
        ? '选择模板'
        : step === 'import'
          ? '导入旧简历'
          : step === 'profile'
            ? '从哪里开始写'
            : step === 'job'
              ? '选择用于岗位定制的简历'
              : '创建简历'

  const busy = flow.creating || flow.reading

  function go(next: CreationStep) {
    headingRef.current?.focus()
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
        overlayClassName={reduceMotion ? 'animate-none!' : undefined}
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
        <div
          ref={measureRef}
          data-creation-layout
          className={cn(
            'relative flex max-h-[90dvh] w-[min(600px,calc(100vw-2rem))] flex-col gap-4 p-5',
            (step === 'review' || step === 'template') &&
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
                  if (!node.closest('[role=dialog]')?.contains(focused))
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
          {!ready || loadedScope !== flow.scope ? (
            <p role='status'>正在读取草稿…</p>
          ) : (
            <>
              <div
                ref={scrollRef}
                data-creation-scroll
                className='relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-1 -m-1'
              >
                <AnimatedContent animationKey={step} mode='popLayout'>
                  {step === 'choose' && (
                    <div className='space-y-3 py-1'>
                      {(draft.sourceText || draft.creation) && (
                        <div className='flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-3'>
                          <p className='text-sm'>
                            {draft.creation
                              ? '上次创建尚未确认'
                              : '有一份导入草稿'}
                          </p>
                          <div className='flex items-center gap-1'>
                            <Button
                              size='sm'
                              variant='outline'
                              onClick={() =>
                                go(
                                  draft.creation
                                    ? 'template'
                                    : draft.content
                                      ? 'review'
                                      : 'import',
                                )
                              }
                            >
                              {draft.creation ? '继续创建' : '继续导入'}
                            </Button>
                            {draft.sourceText && !draft.creation && (
                              <Button
                                variant='ghost'
                                size='icon-sm'
                                aria-label='清除导入草稿'
                                onClick={() => {
                                  headingRef.current?.focus()

                                  useCreationDraftStore
                                    .getState()
                                    .discard()
                                    .catch(() => undefined)
                                }}
                              >
                                <X className='size-4' />
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                      {[
                        {
                          step: 'import' as const,
                          title: '我有旧简历',
                          description: '导入 PDF、DOCX，或粘贴文字',
                          icon: FileText,
                        },
                        {
                          step: 'profile' as const,
                          title: '从零整理经历',
                          description: '选一份示例，改成自己的经历',
                          icon: Plus,
                        },
                        {
                          step: 'job' as const,
                          title: '我有目标岗位',
                          description: '选一份简历，按岗位要求调整',
                          icon: Target,
                        },
                      ].map((item) => (
                        <Button
                          variant='outline'
                          key={item.step}
                          type='button'
                          disabled={Boolean(draft.creation)}
                          onClick={() => go(item.step)}
                          className='h-auto w-full justify-start gap-3 rounded-lg p-4 text-left whitespace-normal shadow-none transition-colors hover:bg-accent/50 motion-reduce:transition-none'
                        >
                          <item.icon className='size-5 shrink-0 text-muted-foreground' />
                          <span className='min-w-0 flex-1'>
                            <span className='block font-medium'>
                              {item.title}
                            </span>
                            <span className='mt-1 block text-xs text-muted-foreground'>
                              {item.description}
                            </span>
                          </span>
                          <ArrowRight className='size-4 text-muted-foreground' />
                        </Button>
                      ))}
                    </div>
                  )}
                  {step === 'profile' && (
                    <div className='space-y-3'>
                      {(
                        Object.entries(PROFILE_GUIDES) as [
                          ResumeProfile,
                          (typeof PROFILE_GUIDES)[ResumeProfile],
                        ][]
                      ).map(([key, guide]) => (
                        <Button
                          variant='outline'
                          type='button'
                          key={key}
                          disabled={Boolean(draft.creation)}
                          aria-pressed={draft.profile === key}
                          onClick={() => patch({ profile: key })}
                          className={cn(
                            'block h-auto w-full rounded-lg p-4 text-left whitespace-normal shadow-none transition-colors motion-reduce:transition-none',
                            draft.profile === key
                              ? 'border-primary bg-muted/50'
                              : 'hover:bg-muted/30',
                          )}
                        >
                          <span className='block text-sm font-medium'>
                            {guide.label}
                          </span>
                          <span className='mt-1 block text-xs leading-5 text-muted-foreground'>
                            {key === 'graduate'
                              ? '教育、实习与项目'
                              : key === 'experienced'
                                ? '工作职责与项目成果'
                                : '相关经历与可迁移技能'}
                          </span>
                        </Button>
                      ))}
                    </div>
                  )}
                  {step === 'import' && (
                    <ImportSource
                      onFile={flow.readFile}
                      onParse={flow.parseText}
                      onCancel={flow.cancelRead}
                      stage={flow.importStage}
                    />
                  )}
                  {step === 'review' && <ImportPreview />}
                  {step === 'template' && <TemplatePicker />}
                  {step === 'job' && (
                    <div className='space-y-3'>
                      <p className='text-sm text-muted-foreground'>
                        选择原简历，生成岗位定制版本。
                      </p>
                      {listLoading ? (
                        <p
                          role='status'
                          className='text-sm text-muted-foreground'
                        >
                          正在读取简历…
                        </p>
                      ) : listError ? (
                        <div role='alert' className='space-y-2 text-sm'>
                          <p>简历列表暂时没有加载成功。</p>
                          <Button
                            variant='outline'
                            onClick={() =>
                              useResumeListStore.getState().loadResumes()
                            }
                          >
                            重新加载
                          </Button>
                        </div>
                      ) : (
                        resumes
                          .filter(
                            (resume) => resume.derived_status !== 'generating',
                          )
                          .map((resume) => (
                            <Button
                              key={resume.resume_id}
                              variant='outline'
                              className='w-full justify-between'
                              onClick={() => {
                                if (jobContext && !jobContext.jdText.trim()) {
                                  toast.info('请先返回岗位补充 JD 原文')

                                  return
                                }

                                useResumeListStore
                                  .getState()
                                  .openDeriveFor(resume.resume_id)

                                setIsOpen(false)

                                navigate(
                                  jobContext
                                    ? jobContextUrl('/resume', jobContext.id)
                                    : '/resume',
                                )
                              }}
                            >
                              <span className='truncate'>
                                {resume.display_name || '未命名简历'}
                              </span>
                              <ArrowRight className='size-4 shrink-0' />
                            </Button>
                          ))
                      )}
                      {!listLoading && !listError && resumes.length === 0 && (
                        <>
                          <p className='text-sm'>
                            先准备一份简历，再带入目标岗位。
                          </p>
                          <Button
                            variant='outline'
                            onClick={() => go('import')}
                          >
                            导入旧简历
                          </Button>
                          <Button variant='ghost' onClick={() => go('profile')}>
                            从零开始
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </AnimatedContent>
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
              {step !== 'choose' && (
                <div className='flex shrink-0 flex-wrap items-center justify-between gap-2 border-t pt-3'>
                  <Button
                    size='sm'
                    variant='ghost'
                    disabled={busy}
                    onClick={() =>
                      go(
                        draft.creation
                          ? 'choose'
                          : step === 'template'
                            ? draft.contentSource === 'profile'
                              ? 'profile'
                              : 'review'
                            : step === 'review'
                              ? 'import'
                              : 'choose',
                      )
                    }
                  >
                    <ArrowLeft className='size-4' />
                    返回
                  </Button>
                  <div className='flex flex-wrap items-center justify-end gap-3'>
                    {step === 'template' && (
                      <span className='max-w-44 truncate text-xs text-muted-foreground'>
                        {draft.selectedTemplate?.name ??
                          draft.creation?.selection?.name ??
                          '请选择模板'}{' '}
                        · {isOnline ? '云端' : '本地'}
                      </span>
                    )}
                    {step === 'review' && (
                      <Button
                        disabled={busy || !importReady(draft)}
                        onClick={() => go('template')}
                      >
                        选择模板
                        <ArrowRight className='size-4' />
                      </Button>
                    )}
                    {step === 'profile' && (
                      <Button
                        disabled={busy || Boolean(draft.creation)}
                        onClick={() => {
                          headingRef.current?.focus()
                          flow.prepareProfile()
                        }}
                      >
                        选择模板
                        <ArrowRight className='size-4' />
                      </Button>
                    )}
                    {step === 'template' && (
                      <Button
                        disabled={
                          busy || (!draft.selectedTemplate && !draft.creation)
                        }
                        onClick={() => flow.create()}
                      >
                        {flow.creating
                          ? '正在创建…'
                          : draft.creation
                            ? '重试创建'
                            : '创建简历'}
                      </Button>
                    )}
                    {step === 'import' && saving && (
                      <span
                        role='status'
                        className='text-xs text-muted-foreground'
                      >
                        保存中…
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
