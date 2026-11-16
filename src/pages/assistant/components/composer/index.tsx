import { useComposer } from './use-composer'
import { UploadTasks } from './upload-tasks'
import { ArrowUp, Brain, Square, WandSparkles } from 'lucide-react'
import { EXPERIENCE_FILE_ACCEPT } from '@/lib/experience-sources/const'
import { QuotaMeter } from '@/components/quota/quota-meter'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { Popover, PopoverAnchor, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { referenceKey } from '@/lib/ai/references'
import AnimatedContent from '@/components/motion/animated-content'
import ContextUsage from '../context-usage'
import ReferenceTags from '../reference-tags'
import QueuedMessages from '../queued-messages'
import { ComposerReferencePicker } from '../composer-tools/reference-picker'
import { ComposerTools } from '../composer-tools/tool-menu'
import { COMPOSER_PLACEHOLDER } from '../../const'
import useAssistantStore from '../../store'

export default function Composer() {
  const {
    streaming,
    references,
    pendingConfirm,
    runPhase,
    draftStorageFailed,
    deepThinking,
    setDeepThinking,
    stopStreaming,
    uploads,
    fileInputRef,
    sendStatusId,
    context,
    sourceScope,
    textareaRef,
    commandRef,
    thinkingRef,
    composingRef,
    setManualToolsOpen,
    setCommandDismissed,
    setMenuQuery,
    setNewTaskProposalId,
    reduceMotion,
    disabled,
    hasExplicitSources,
    running,
    awaiting,
    asNewTask,
    replying,
    visibleDraft,
    queryMode,
    query,
    toolsOpen,
    tools,
    canSend,
    sendBlockedReason,
    sendDisabled,
    closeTools,
    focusDraft,
    appendDraft,
    handleToolSelect,
    submit,
    handleKeyDown,
  } = useComposer()

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
              setNewTaskProposalId(asNewTask ? null : pendingConfirm!.id)
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
      <UploadTasks uploads={uploads} reduceMotion={reduceMotion} />
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
