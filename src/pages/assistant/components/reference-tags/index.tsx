import type { AiUserReference } from '@/lib/ai/types'
import {
  Archive,
  BookOpen,
  Briefcase,
  FileText,
  MessageSquareQuote,
  WandSparkles,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState } from 'react'
import {
  Attachment,
  AttachmentActions,
  AttachmentAction,
  AttachmentContent,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from '@/components/ui/attachment'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { ASSISTANT_COMMANDS, COMMAND_COLORS } from '@/lib/ai/commands'
import { referenceKey, referenceLabel } from '@/lib/ai/references'
import { DURATION, EASE } from '@/lib/motion'
import { useSourceMetadata } from '@/features/experience-sources/use-source-metadata'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import { cn } from '@/lib/utils'
import useAssistantStore from '../../store'

const REFERENCE_COLORS = {
  resume:
    'border-blue-200/80 bg-blue-50/70 text-blue-800 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-200',
  job: 'border-emerald-200/80 bg-emerald-50/70 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200',
  'legacy-job':
    'border-emerald-200/80 bg-emerald-50/70 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200',
  command:
    'border-amber-200/80 bg-amber-50/70 text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200',
  skill:
    'border-violet-200/80 bg-violet-50/70 text-violet-800 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-violet-200',
  annotation:
    'border-sky-200/80 bg-sky-50/70 text-sky-800 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-200',
  experience: 'border-border bg-muted/60 text-foreground',
}

const REFERENCE_PURPOSES = {
  resume: '简历引用',
  annotation: '简历注释',
  job: '岗位引用',
  'legacy-job': '岗位引用',
  experience: '资料引用',
  command: '快捷指令',
  skill: '技能调用',
}

const COMMAND_PURPOSES: Record<string, string> = {
  'polish-experience': '经历优化',
  'star-experience': 'STAR 描述',
  'clarify-results': '成果梳理',
  'match-job': '岗位匹配',
  'extract-skills': '技能提炼',
  'write-summary': '自我评价',
  'polish-objective': '意向润色',
}

const SKILL_PURPOSES: Record<string, string> = {
  'great-resume': '简历提升',
}

export default function ReferenceTags({
  references,
  onRemove,
  disabled,
  align = 'start',
}: {
  references: AiUserReference[]
  onRemove?: (key: string) => void
  disabled?: boolean
  align?: 'start' | 'end'
}) {
  const reduced = useReducedMotion()

  const metadata = useSourceMetadata(
    references.flatMap((reference) =>
      reference.type === 'reference' && reference.kind === 'experience'
        ? [reference.id]
        : [],
    ),
  )

  const rootRef = useRef<HTMLDivElement>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [boundary, setBoundary] = useState<Element | null>(null)

  return (
    <div
      ref={rootRef}
      className={cn(
        'flex w-full min-w-0 max-w-full flex-wrap items-center gap-1.5',
        align === 'end' && 'justify-end',
      )}
      aria-label='引用'
    >
      <AnimatePresence initial={false}>
        {references.map((reference) => {
          const key = referenceKey(reference)

          const sourceState =
            reference.type === 'reference' && reference.kind === 'experience'
              ? metadata[reference.id]
              : undefined

          const sourceStatus =
            !sourceState || sourceState.status === 'loading'
              ? '正在读取资料状态'
              : sourceState.status === 'missing'
                ? '已删除或不可用'
                : sourceState.status === 'error'
                  ? '资料状态读取失败'
                  : sourceState.source.status === 'ready'
                    ? undefined
                    : sourceState.source.status === 'deleting'
                      ? '正在删除'
                      : '资料暂不可用'

          const label = `${referenceLabel(reference)}${sourceState?.status === 'missing' ? ' · 已删除' : ''}`

          const kind =
            reference.type === 'skill-reference' ? 'skill' : reference.kind

          const purpose =
            reference.type === 'skill-reference'
              ? (SKILL_PURPOSES[reference.skillId] ?? REFERENCE_PURPOSES.skill)
              : reference.kind === 'command'
                ? (COMMAND_PURPOSES[reference.id] ?? REFERENCE_PURPOSES.command)
                : REFERENCE_PURPOSES[reference.kind]

          const Icon =
            kind === 'skill'
              ? BookOpen
              : kind === 'command'
                ? WandSparkles
                : kind === 'experience'
                  ? Archive
                  : kind === 'annotation'
                    ? MessageSquareQuote
                    : kind === 'job' || kind === 'legacy-job'
                      ? Briefcase
                      : FileText

          return (
            <motion.div
              key={key}
              className='max-w-30 min-w-0 shrink-0'
              initial={reduced ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{
                opacity: 0,
                transition: { duration: reduced ? 0 : DURATION.fast },
              }}
              transition={{
                duration: reduced ? 0 : DURATION.base,
                ease: EASE.out,
              }}
            >
              <Popover
                open={openKey === key}
                onOpenChange={(open) => {
                  setBoundary(
                    rootRef.current?.closest('[data-assistant-chat]') ?? null,
                  )

                  setOpenKey(open ? key : null)
                }}
              >
                <Attachment
                  size='xs'
                  className={cn(
                    'w-full min-w-0 max-w-full flex-nowrap gap-1 rounded-md px-1!',
                    kind === 'command' && reference.type === 'reference'
                      ? (COMMAND_COLORS[reference.id]?.tag ??
                          REFERENCE_COLORS.command)
                      : REFERENCE_COLORS[kind],
                  )}
                >
                  <AttachmentMedia className='size-4! rounded-sm! bg-transparent text-current'>
                    <Icon />
                  </AttachmentMedia>
                  <AttachmentContent className='min-w-0 py-1'>
                    <AttachmentTitle className='truncate'>
                      {purpose}
                    </AttachmentTitle>
                  </AttachmentContent>
                  <PopoverTrigger asChild>
                    <AttachmentTrigger
                      className='rounded-md'
                      data-reference-key={key}
                      aria-label={`查看${purpose}：${label}`}
                      disabled={disabled}
                    />
                  </PopoverTrigger>
                  {onRemove && (
                    <AttachmentActions>
                      <AttachmentAction
                        type='button'
                        className='rounded-sm hover:bg-black/5 hover:text-current dark:hover:bg-white/10'
                        disabled={disabled}
                        aria-label={`移除${purpose}：${label}`}
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          setOpenKey(null)
                          onRemove(key)
                        }}
                      >
                        <X className='size-3.5' />
                      </AttachmentAction>
                    </AttachmentActions>
                  )}
                </Attachment>
                <PopoverContent
                  side='top'
                  align='end'
                  collisionBoundary={boundary}
                  collisionPadding={12}
                  onCloseAutoFocus={(event) => {
                    if (useAssistantStore.getState().sourceViewer?.open)
                      event.preventDefault()
                  }}
                  className='max-h-[min(18rem,var(--radix-popover-content-available-height))] w-[min(22rem,calc(100vw-2rem))] max-w-[var(--radix-popover-content-available-width)] gap-3 overflow-y-auto rounded-xl text-sm'
                  style={reduced ? { animationDuration: '0s' } : undefined}
                >
                  <p className='font-medium break-words'>{label}</p>
                  {reference.type === 'skill-reference' && (
                    <p className='text-muted-foreground'>
                      本次使用 {reference.displayName} 技能。
                    </p>
                  )}
                  {reference.type === 'reference' &&
                    reference.kind === 'command' && (
                      <p className='whitespace-pre-wrap text-muted-foreground'>
                        {ASSISTANT_COMMANDS.find(
                          (command) =>
                            command.id === reference.id &&
                            command.version === reference.version,
                        )?.prompt ?? '这条指令已更新，请重新选择。'}
                      </p>
                    )}
                  {reference.type === 'reference' &&
                    reference.kind === 'annotation' && (
                      <>
                        {reference.anchors.map((anchor) => (
                          <blockquote
                            key={`${anchor.nodeKey}:${anchor.startGraphemeOffset}:${anchor.endGraphemeOffset}`}
                            className='border-l-2 pl-3 leading-relaxed text-muted-foreground'
                          >
                            {anchor.exactQuote}
                          </blockquote>
                        ))}
                        {reference.fields?.map((field) => (
                          <p
                            key={field.nodeKey}
                            className='text-muted-foreground'
                          >
                            {field.label}（字段引用）
                          </p>
                        ))}
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => {
                            setOpenKey(null)

                            useAssistantStore.setState({
                              previewResumeId: reference.resumeId,
                              explicitPreviewResumeId: reference.resumeId,
                              canvasOpen: true,
                              canvasMobileOpen: true,
                              canvasActiveTab: 'resume',
                              annotationTarget: reference,
                            })
                          }}
                        >
                          在画布中查看
                        </Button>
                      </>
                    )}
                  {reference.type === 'reference' &&
                    reference.kind === 'resume' && (
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => {
                          setOpenKey(null)

                          useAssistantStore.setState({
                            previewResumeId: reference.id,
                            explicitPreviewResumeId: reference.id,
                            canvasOpen: true,
                            canvasMobileOpen: true,
                            canvasActiveTab: 'resume',
                          })
                        }}
                      >
                        在画布中查看
                      </Button>
                    )}
                  {reference.type === 'reference' &&
                    reference.kind === 'experience' && (
                      <>
                        {sourceStatus && (
                          <p className='text-muted-foreground' role='status'>
                            {sourceStatus}
                          </p>
                        )}
                        {sourceState?.status === 'error' && (
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() =>
                              useExperienceSourcesStore
                                .getState()
                                .resolveMetadata([reference.id], true)
                            }
                          >
                            重新读取状态
                          </Button>
                        )}
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => {
                            setOpenKey(null)

                            useAssistantStore.getState().openSourceViewer(
                              {
                                sourceId: reference.id,
                                versionId: reference.versionId,
                                name: reference.label,
                              },
                              rootRef.current?.querySelector<HTMLElement>(
                                `[data-reference-key="${CSS.escape(key)}"]`,
                              ),
                            )
                          }}
                          disabled={
                            sourceState?.status !== 'ready' ||
                            sourceState.source.status !== 'ready'
                          }
                        >
                          查看原文与出处
                        </Button>
                      </>
                    )}
                  {reference.type === 'reference' &&
                    reference.kind === 'legacy-job' && (
                      <p className='text-muted-foreground'>
                        这是一条旧版岗位引用。需要读取岗位时，请重新选择。
                      </p>
                    )}
                </PopoverContent>
              </Popover>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
