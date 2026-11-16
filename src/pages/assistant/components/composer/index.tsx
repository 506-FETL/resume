import { useShallow } from 'zustand/react/shallow'
import { ArrowUp, Brain, Square, WandSparkles } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { DURATION, EASE } from '@/lib/motion'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { EXPERIENCE_FILE_ACCEPT } from '@/lib/experience-sources/const'
import { Spinner } from '@/components/ui/spinner'
import { useComposerUploads } from '../../hooks/use-composer-uploads'
import { QuotaMeter } from '@/components/quota/quota-meter'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { Popover, PopoverAnchor, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { ASSISTANT_TOOLS } from '../composer-tools'
import { ASSISTANT_COMMANDS } from '@/lib/ai/commands'
import { createSkillReferences } from '@/lib/ai/skills/references'
import { referenceKey } from '@/lib/ai/references'
import type { AiUserReference } from '@/lib/ai/types'
import AnimatedContent from '@/components/motion/animated-content'
import ContextUsage from '../context-usage'
import ReferenceTags from '../reference-tags'
import { useSourceScope } from '../../hooks/use-source-scope'
import { freezeSourceScope } from '../../store/source-scope'
import QueuedMessages from '../queued-messages'
import { ComposerReferencePicker } from '../composer-tools/reference-picker'
import { ComposerTools } from '../composer-tools/tool-menu'
import { COMPOSER_PLACEHOLDER } from '../../const'
import { useChatStream } from '../../hooks/use-chat-stream'
import { useComposerContext } from '../../hooks/use-composer-context'
import useAssistantStore from '../../store'
import type { ComposerKeyDownEvent, ComposerTool } from '../../types'

export default function Composer() {
  const {
    streaming,
    composerDraft: draft,
    composerReferences: references,
    pendingConfirm,
    confirmationFeedback,
    runPhase,
    draftStorageFailed,
    initializing,
    bootstrapError,
    loadingMessages,
    deepThinking,
    setDeepThinking,
    activeConversationId,
    queuedMessages,
    pendingAssistantWrite,
    pendingMessageUpdates,
  } = useAssistantStore(
    useShallow((state) => ({
      streaming: state.streaming,
      composerDraft: state.composerDraft,
      composerReferences: state.composerReferences,
      pendingConfirm: state.pendingConfirm,
      confirmationFeedback: state.confirmationFeedback,
      runPhase: state.runPhase,
      draftStorageFailed: state.draftStorageFailed,
      initializing: state.initializing,
      bootstrapError: state.bootstrapError,
      loadingMessages: state.loadingMessages,
      deepThinking: state.deepThinking,
      setDeepThinking: state.setDeepThinking,
      activeConversationId: state.activeConversationId,
      queuedMessages: state.queuedMessages,
      pendingAssistantWrite: state.pendingAssistantWrite,
      pendingMessageUpdates: state.pendingMessageUpdates,
    })),
  )

  const { sendMessage, stopStreaming, compactContext } = useChatStream()
  const uploads = useComposerUploads()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sendStatusId = useId()
  const context = useComposerContext()
  const sourceScope = useSourceScope()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const commandRef = useRef<HTMLDivElement>(null)
  const thinkingRef = useRef<HTMLButtonElement>(null)
  const composingRef = useRef(false)
  const [manualToolsOpen, setManualToolsOpen] = useState(false)
  const [commandDismissed, setCommandDismissed] = useState(false)
  const [menuQuery, setMenuQuery] = useState('')

  const [newTaskProposalId, setNewTaskProposalId] = useState<string | null>(
    null,
  )

  const reduceMotion = useReducedMotion()

  const disabled = initializing || loadingMessages || Boolean(bootstrapError)

  const hasExplicitSources = references.some(
    (reference) =>
      reference.type === 'reference' && reference.kind === 'experience',
  )

  const composerSources = hasExplicitSources
    ? freezeSourceScope(sourceScope.sources ?? [], references)
    : sourceScope.sources

  const running =
    streaming ||
    [
      'preparing',
      'generating',
      'confirming',
      'applying',
      'compacting',
    ].includes(runPhase)

  const awaiting = pendingConfirm?.status === 'pending'
  const asNewTask = awaiting && newTaskProposalId === pendingConfirm.id
  const replying = awaiting && !asNewTask
  const visibleDraft = replying ? confirmationFeedback : draft

  const queryMode = visibleDraft.startsWith('/') || visibleDraft.startsWith('$')
  const query = queryMode ? visibleDraft.slice(1) : menuQuery

  const toolsOpen =
    !disabled && (manualToolsOpen || (queryMode && !commandDismissed))

  const compactDisabled =
    disabled ||
    runPhase !== 'idle' ||
    !activeConversationId ||
    !composerSources ||
    Boolean(pendingConfirm || pendingAssistantWrite) ||
    queuedMessages.length > 0 ||
    pendingMessageUpdates.length > 0

  const tools = ASSISTANT_TOOLS.filter((tool) => {
    const searchable = [
      tool.name,
      tool.displayName,
      tool.description,
      ...(tool.aliases ?? []),
    ]

    return (
      (!visibleDraft.startsWith('$') || Boolean(tool.skillId)) &&
      searchable.some((value) =>
        value?.toLowerCase().includes(query.toLowerCase()),
      )
    )
  }).map((tool) =>
    tool.action === 'compact-context'
      ? { ...tool, disabled: compactDisabled }
      : tool,
  )

  const canSend = Boolean(
    visibleDraft.trim() || (!replying && references.length),
  )

  const sendBlockedReason = uploads.tasks.length
    ? uploads.tasks.some((task) => ['failed', 'unknown'].includes(task.status))
      ? '文件还未准备好，请重试或移除后再发送。'
      : '文件正在上传，完成后就可以发送。'
    : undefined

  const sendDisabled =
    disabled || !canSend || Boolean(sendBlockedReason) || !composerSources

  const closeTools = () => {
    setManualToolsOpen(false)
    setCommandDismissed(true)
  }

  const focusDraft = () => {
    const input = textareaRef.current

    input?.focus({ preventScroll: true })

    requestAnimationFrame(() => {
      if (input && document.activeElement === input)
        input.setSelectionRange(input.value.length, input.value.length)
    })
  }

  const appendDraft = (reference: AiUserReference) => {
    useAssistantStore.getState().addComposerReferences([reference])
  }

  const handleToolSelect = (tool: ComposerTool) => {
    const state = useAssistantStore.getState()

    closeTools()
    focusDraft()

    if (tool.action === 'compact-context') {
      if (!compactContext()) return
    } else if (tool.skillId)
      state.addComposerReferences(createSkillReferences('', [tool.skillId]))
    else {
      const command = ASSISTANT_COMMANDS.find(
        (item) => item.displayName === tool.name,
      )

      if (command)
        state.addComposerReferences([
          {
            type: 'reference',
            kind: 'command',
            id: command.id,
            version: command.version,
            label: command.displayName,
          },
        ])
    }

    if (/^[$/]\S*$/.test(visibleDraft.trim())) {
      if (replying) state.setConfirmationFeedback('')
      else state.setComposerDraft('')
    }
  }

  const submit = (
    mode: 'queue' | 'interrupt' | 'feedback' = replying ? 'feedback' : 'queue',
  ) => {
    if (sendDisabled || composingRef.current) return

    if (sendMessage(visibleDraft.trim(), references, mode)) {
      useAssistantStore.setState({
        ...(replying ? { confirmationFeedback: '' } : { composerDraft: '' }),
        composerReferences: [],
        composerSkillIds: [],
        composerLibrarySources: null,
      })

      setNewTaskProposalId(null)
      closeTools()
    }
  }

  const handleKeyDown = (event: ComposerKeyDownEvent) => {
    if (
      composingRef.current ||
      event.nativeEvent.isComposing ||
      event.keyCode === 229
    )
      return

    if (toolsOpen && event.key === 'Escape') {
      event.preventDefault()
      closeTools()

      return
    }
    if (
      toolsOpen &&
      (event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        (event.key === 'Enter' && !event.shiftKey && tools.length > 0))
    ) {
      event.preventDefault()

      commandRef.current?.dispatchEvent(
        new KeyboardEvent('keydown', { key: event.key, bubbles: true }),
      )

      return
    }
    if (
      event.key === 'Enter' &&
      event.shiftKey &&
      (event.metaKey || event.ctrlKey)
    ) {
      event.preventDefault()
      submit('interrupt')

      return
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className='mx-auto w-full max-w-4xl px-3 sm:px-6 lg:px-8'>
      {awaiting && (
        <div className='mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground'>
          <span>
            {replying
              ? '补充要求，重新生成这次修改'
              : '这条消息将作为新任务排队'}
          </span>
          <InputGroupButton
            size='sm'
            onClick={() =>
              setNewTaskProposalId(asNewTask ? null : pendingConfirm.id)
            }
          >
            {replying ? '改为新任务' : '回复当前修改'}
          </InputGroupButton>
        </div>
      )}
      <AnimatedContent
        animationKey={runPhase === 'compacting' ? 'compacting' : 'none'}
      >
        {runPhase === 'compacting' && (
          <p className='mb-2 text-xs text-muted-foreground' role='status'>
            正在整理较早的对话
          </p>
        )}
      </AnimatedContent>
      {runPhase === 'settling' && (
        <p className='mb-2 text-xs text-muted-foreground' role='status'>
          正在完成已确认的修改，随后继续
        </p>
      )}
      {!hasExplicitSources && sourceScope.error && (
        <p className='mb-2 text-xs text-destructive' role='alert'>
          参考资料读取失败
          <InputGroupButton type='button' size='sm' onClick={sourceScope.retry}>
            重试
          </InputGroupButton>
        </p>
      )}
      {!hasExplicitSources && !sourceScope.sources && !sourceScope.error && (
        <p className='mb-2 text-xs text-muted-foreground' role='status'>
          正在读取参考资料目录
        </p>
      )}
      <QueuedMessages />
      <input
        ref={fileInputRef}
        type='file'
        hidden
        multiple
        accept={EXPERIENCE_FILE_ACCEPT}
        onChange={(event) => {
          uploads.addFiles(Array.from(event.target.files ?? []))
          event.target.value = ''
        }}
      />
      <div className='space-y-1' aria-label='文件上传任务'>
        <AnimatePresence initial={false}>
          {uploads.tasks.map((task) => (
            <motion.div
              key={task.operationId}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{
                opacity: 0,
                transition: { duration: reduceMotion ? 0 : DURATION.fast },
              }}
              transition={{
                duration: reduceMotion ? 0 : DURATION.base,
                ease: EASE.out,
              }}
              className='mb-2 flex items-center gap-2 text-xs'
            >
              {['preparing', 'reading', 'saving'].includes(task.status) && (
                <Spinner className='size-3' />
              )}
              <span className='min-w-0 flex-1 truncate'>
                {task.file.name} ·{' '}
                {task.status === 'preparing'
                  ? '正在准备对话'
                  : task.status === 'reading'
                    ? '正在读取文件'
                    : task.status === 'saving'
                      ? '正在保存原件'
                      : task.error}
              </span>
              {['failed', 'unknown'].includes(task.status) && (
                <InputGroupButton
                  type='button'
                  size='sm'
                  onClick={() => uploads.retry(task)}
                >
                  {task.status === 'unknown' ? '核对并重试' : '重试'}
                </InputGroupButton>
              )}
              <InputGroupButton
                type='button'
                size='sm'
                onClick={() => uploads.remove(task)}
              >
                移除
              </InputGroupButton>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <AnimatedContent animationKey={sendBlockedReason ? 'blocked' : 'ready'}>
        {sendBlockedReason && (
          <p
            id={sendStatusId}
            className='mb-2 text-xs text-muted-foreground'
            role='status'
          >
            {sendBlockedReason}
          </p>
        )}
      </AnimatedContent>
      <form
        onDragOver={(event) => {
          if (!disabled && event.dataTransfer.types.includes('Files'))
            event.preventDefault()
        }}
        onDrop={(event) => {
          if (disabled || !event.dataTransfer.files.length) return

          event.preventDefault()
          uploads.addFiles(Array.from(event.dataTransfer.files))
        }}
        data-composer
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <Popover
          open={toolsOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeTools()

              return
            }

            setManualToolsOpen(true)
            setCommandDismissed(false)
            setMenuQuery('')
          }}
        >
          <PopoverAnchor asChild>
            <InputGroup className='rounded-xl bg-background'>
              <InputGroupAddon
                align='block-start'
                className='max-h-28 flex-col items-start gap-0 overflow-y-auto p-0'
              >
                {references.length > 0 && (
                  <div className='w-full min-w-0 px-3 pt-3 pb-1'>
                    <ReferenceTags
                      references={references}
                      disabled={disabled}
                      onRemove={(key) => {
                        useAssistantStore
                          .getState()
                          .setComposerReferences(
                            references.filter(
                              (reference) => referenceKey(reference) !== key,
                            ),
                          )

                        textareaRef.current?.focus({ preventScroll: true })
                      }}
                    />
                  </div>
                )}
              </InputGroupAddon>
              <InputGroupTextarea
                ref={textareaRef}
                value={visibleDraft}
                rows={1}
                placeholder={
                  replying
                    ? '希望怎样修改？可以直接补充要求…'
                    : streaming
                      ? '继续输入，发送后加入队列…'
                      : COMPOSER_PLACEHOLDER
                }
                aria-label='发送给 AI 助手的消息'
                role='combobox'
                aria-autocomplete='list'
                aria-expanded={toolsOpen}
                disabled={disabled}
                className='max-h-36 min-h-16 overflow-y-auto p-3 leading-6'
                onChange={(event) => {
                  setCommandDismissed(false)

                  const state = useAssistantStore.getState()

                  if (replying)
                    state.setConfirmationFeedback(event.target.value)
                  else state.setComposerDraft(event.target.value)
                }}
                onCompositionStart={() => {
                  composingRef.current = true
                }}
                onCompositionEnd={() => {
                  composingRef.current = false
                }}
                onPaste={(event) => {
                  if (!event.clipboardData.files.length) return

                  event.preventDefault()
                  uploads.addFiles(Array.from(event.clipboardData.files))
                }}
                onKeyDown={handleKeyDown}
              />
              <InputGroupAddon
                align='block-end'
                className='flex-wrap gap-0.5 sm:gap-1.5'
              >
                <ComposerReferencePicker
                  context={context}
                  onUploadFiles={() => fileInputRef.current?.click()}
                  disabled={disabled}
                  onSelect={appendDraft}
                  textareaRef={textareaRef}
                />
                <PopoverTrigger asChild>
                  <InputGroupButton
                    size='icon-sm'
                    aria-label='快捷指令与技能'
                    disabled={disabled}
                    className='shrink-0 rounded-full'
                  >
                    <WandSparkles />
                  </InputGroupButton>
                </PopoverTrigger>
                <InputGroupButton
                  ref={thinkingRef}
                  size='sm'
                  variant={deepThinking ? 'default' : 'ghost'}
                  aria-label='深度思考'
                  aria-pressed={deepThinking}
                  onClick={() => setDeepThinking(!deepThinking)}
                  className={cn(
                    'h-8 gap-1.5 rounded-full px-2',
                    !deepThinking && 'text-muted-foreground',
                    reduceMotion && 'transition-none',
                  )}
                >
                  <Brain className='size-4' />
                  深度思考
                </InputGroupButton>
                <ContextUsage />
                <div className='ml-auto flex items-center gap-1'>
                  {running && (
                    <InputGroupButton
                      type='button'
                      size='icon-sm'
                      variant='ghost'
                      className='rounded-full'
                      aria-label='停止生成'
                      onClick={() => {
                        thinkingRef.current?.focus({ preventScroll: true })
                        stopStreaming()
                      }}
                    >
                      <Square className='size-3.5 fill-current' />
                    </InputGroupButton>
                  )}
                  {running && canSend && (
                    <InputGroupButton
                      type='button'
                      size='sm'
                      onClick={() => submit('interrupt')}
                      disabled={sendDisabled}
                      aria-describedby={
                        sendBlockedReason ? sendStatusId : undefined
                      }
                    >
                      立即发送
                    </InputGroupButton>
                  )}
                  <InputGroupButton
                    type='submit'
                    size='icon-sm'
                    variant='default'
                    className='rounded-full'
                    aria-label={
                      replying
                        ? '发送修改要求'
                        : streaming
                          ? '加入队列'
                          : '发送消息'
                    }
                    disabled={sendDisabled}
                    aria-describedby={
                      sendBlockedReason ? sendStatusId : undefined
                    }
                  >
                    <ArrowUp className='size-4' />
                  </InputGroupButton>
                </div>
              </InputGroupAddon>
            </InputGroup>
          </PopoverAnchor>
          <ComposerTools
            tools={tools}
            query={query}
            onQueryChange={setMenuQuery}
            queryMode={queryMode}
            commandRef={commandRef}
            textareaRef={textareaRef}
            onSelect={handleToolSelect}
            onClose={closeTools}
            onRestoreFocus={focusDraft}
          />
        </Popover>
      </form>
      {draftStorageFailed && (
        <p className='mt-2 text-xs text-muted-foreground' role='status'>
          草稿暂未保存到本机，刷新后可能丢失
        </p>
      )}
      <QuotaMeter className='mt-1.5' />
    </div>
  )
}
