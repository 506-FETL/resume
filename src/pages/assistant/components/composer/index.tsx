import { useShallow } from 'zustand/react/shallow'
import { ArrowUp, Brain, Square, WandSparkles } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { QuotaMeter } from '@/components/quota/quota-meter'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { Popover, PopoverAnchor, PopoverTrigger } from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { BUILTIN_SKILLS } from '@/lib/ai/skills/catalog'
import { cn } from '@/lib/utils'
import { ASSISTANT_TOOLS, TEMPLATE_PROMPTS } from '../composer-tools'
import { ComposerReferencePicker } from '../composer-tools/reference-picker'
import { ComposerTools } from '../composer-tools/tool-menu'
import { composeDraft, parseComposerDraft } from '../../composer-references'
import { COMPOSER_PLACEHOLDER } from '../../const'
import { useChatStream } from '../../hooks/use-chat-stream'
import { useComposerContext } from '../../hooks/use-composer-context'
import useAssistantStore from '../../store'
import type { ComposerKeyDownEvent, ComposerTool } from '../../types'
import { SkillPicker } from '../skill-picker'

export default function Composer() {
  const {
    streaming,
    composerDraft: draft,
    composerSkillIds,
    initializing,
    bootstrapError,
    loadingMessages,
    deepThinking,
    setDeepThinking,
  } = useAssistantStore(
    useShallow((state) => ({
      streaming: state.streaming,
      composerDraft: state.composerDraft,
      composerSkillIds: state.composerSkillIds,
      initializing: state.initializing,
      bootstrapError: state.bootstrapError,
      loadingMessages: state.loadingMessages,
      deepThinking: state.deepThinking,
      setDeepThinking: state.setDeepThinking,
    })),
  )

  const { sendMessage, stopStreaming } = useChatStream()
  const context = useComposerContext()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const commandRef = useRef<HTMLDivElement>(null)
  const thinkingRef = useRef<HTMLButtonElement>(null)
  const composingRef = useRef(false)
  const [manualToolsOpen, setManualToolsOpen] = useState(false)
  const [commandDismissed, setCommandDismissed] = useState(false)
  const [menuQuery, setMenuQuery] = useState('')
  const reduceMotion = useReducedMotion()

  const disabled =
    streaming || initializing || loadingMessages || Boolean(bootstrapError)

  const { text: visibleDraft, references } = useMemo(
    () => parseComposerDraft(draft),
    [draft],
  )

  const queryMode = visibleDraft.startsWith('/') || visibleDraft.startsWith('$')
  const query = queryMode ? visibleDraft.slice(1) : menuQuery

  const toolsOpen =
    !disabled && (manualToolsOpen || (queryMode && !commandDismissed))

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
  })

  const selectedSkills = useMemo(
    () =>
      composerSkillIds.flatMap((id) => {
        const skill = BUILTIN_SKILLS.find((item) => item.id === id)

        return skill ? [{ id: skill.id, displayName: skill.displayName }] : []
      }),
    [composerSkillIds],
  )

  const canSend = Boolean(
    visibleDraft.trim() || references.length || composerSkillIds.length,
  )

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

  const appendDraft = (token: string, label: string) => {
    const state = useAssistantStore.getState()
    const current = parseComposerDraft(state.composerDraft)

    if (current.references.some((reference) => reference.token === token))
      return

    state.setComposerDraft(
      composeDraft(current.text, [...current.references, { token, label }]),
    )
  }

  const handleToolSelect = (tool: ComposerTool) => {
    const state = useAssistantStore.getState()
    const current = parseComposerDraft(state.composerDraft)

    closeTools()
    focusDraft()

    if (tool.skillId) {
      state.setComposerSkillIds([
        ...new Set([...state.composerSkillIds, tool.skillId]),
      ])

      if (/^[$/]\S*$/.test(current.text.trim()))
        state.setComposerDraft(composeDraft('', current.references))

      return
    }

    const template = TEMPLATE_PROMPTS[tool.name]

    if (!template) return

    const merged = current.text.startsWith('/')
      ? template
      : current.text
        ? `${current.text}\n${template}`
        : template

    state.setComposerDraft(
      composeDraft(merged.replace(/\n+$/, ''), current.references),
    )
  }

  const submit = () => {
    const text = composeDraft(visibleDraft.trim(), references)

    if (disabled || composingRef.current || !canSend) return
    if (sendMessage(text, composerSkillIds)) {
      useAssistantStore.setState({ composerDraft: '', composerSkillIds: [] })
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
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className='mx-auto w-full max-w-4xl px-3 sm:px-6 lg:px-8'>
      <form
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
                <SkillPicker
                  label='引用'
                  skills={references.map((reference) => ({
                    id: reference.token,
                    displayName: reference.label,
                  }))}
                  disabled={disabled}
                  onRemove={(token) =>
                    useAssistantStore.getState().setComposerDraft(
                      composeDraft(
                        visibleDraft,
                        references.filter(
                          (reference) => reference.token !== token,
                        ),
                      ),
                    )
                  }
                />
                <SkillPicker
                  skills={selectedSkills}
                  disabled={disabled}
                  onRemove={(id) =>
                    useAssistantStore
                      .getState()
                      .setComposerSkillIds(
                        composerSkillIds.filter((skillId) => skillId !== id),
                      )
                  }
                />
              </InputGroupAddon>
              <InputGroupTextarea
                ref={textareaRef}
                value={visibleDraft}
                rows={1}
                placeholder={COMPOSER_PLACEHOLDER}
                aria-label='发送给 AI 助手的消息'
                role='combobox'
                aria-autocomplete='list'
                aria-expanded={toolsOpen}
                disabled={disabled}
                className='max-h-36 min-h-16 overflow-y-auto p-3 leading-6'
                onChange={(event) => {
                  setCommandDismissed(false)

                  useAssistantStore
                    .getState()
                    .setComposerDraft(
                      composeDraft(event.target.value, references),
                    )
                }}
                onCompositionStart={() => {
                  composingRef.current = true
                }}
                onCompositionEnd={() => {
                  composingRef.current = false
                }}
                onKeyDown={handleKeyDown}
              />
              <InputGroupAddon align='block-end' className='flex-wrap gap-1.5'>
                <ComposerReferencePicker
                  context={context}
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
                <Tooltip>
                  <TooltipTrigger asChild>
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
                  </TooltipTrigger>
                  <TooltipContent>
                    {deepThinking ? '已开启深度思考' : '开启深度思考，耗时更长'}
                  </TooltipContent>
                </Tooltip>
                <InputGroupButton
                  type='button'
                  size='icon-sm'
                  variant={streaming ? 'destructive' : 'default'}
                  className='relative ml-auto shrink-0 rounded-full'
                  aria-label={streaming ? '停止生成' : '发送消息'}
                  disabled={!streaming && (disabled || !canSend)}
                  onClick={() => {
                    if (streaming) {
                      thinkingRef.current?.focus({ preventScroll: true })
                      stopStreaming()

                      return
                    }

                    submit()
                  }}
                >
                  <AnimatePresence initial={false}>
                    <motion.span
                      key={streaming ? 'stop' : 'send'}
                      aria-hidden
                      className='absolute inset-0 flex items-center justify-center'
                      initial={
                        reduceMotion
                          ? false
                          : { opacity: 0, transform: 'scale(0.96)' }
                      }
                      animate={{ opacity: 1, transform: 'scale(1)' }}
                      exit={{
                        opacity: 0,
                        transform: reduceMotion ? 'scale(1)' : 'scale(0.96)',
                        transition: {
                          duration: reduceMotion ? 0 : DURATION.fast,
                          ease: EASE.in,
                        },
                      }}
                      transition={{
                        duration: reduceMotion ? 0 : DURATION.base,
                        ease: EASE.out,
                      }}
                    >
                      {streaming ? (
                        <Square className='size-3.5 fill-current' />
                      ) : (
                        <ArrowUp className='size-4' />
                      )}
                    </motion.span>
                  </AnimatePresence>
                </InputGroupButton>
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
      <QuotaMeter className='mt-1.5' />
    </div>
  )
}
