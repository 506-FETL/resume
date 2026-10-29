import type { ComposerContextOption, Tool } from '@/components/ui/composer'
import { Brain, Briefcase, FileText, Square } from 'lucide-react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { QuotaMeter } from '@/components/quota/quota-meter'
import { Button } from '@/components/ui/button'
import { Composer as GaiaComposer } from '@/components/ui/composer'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { BUILTIN_SKILLS } from '@/lib/ai/skills/catalog'
import { cn } from '@/lib/utils'
import { ASSISTANT_TOOLS, TEMPLATE_PROMPTS } from '../../composer-tools'
import { composeDraft, parseComposerDraft } from '../../composer-references'
import { COMPOSER_PLACEHOLDER } from '../../const'
import { useChatStream } from '../../hooks/use-chat-stream'
import { useComposerContext } from '../../hooks/use-composer-context'
import useAssistantStore from '../../store'
import { SkillPicker } from '../skill-picker'

function StopGenerationButton({ onStop }: { onStop: () => void }) {
  const isPresent = useIsPresent()
  const reduceMotion = useReducedMotion()
  const buttonRef = useRef<HTMLDivElement>(null)

  const focusThinkingButton = () => {
    buttonRef.current
      ?.closest('[data-composer]')
      ?.querySelector<HTMLButtonElement>('[aria-label="深度思考"]')
      ?.focus({ preventScroll: true })
  }

  useLayoutEffect(() => {
    const element = buttonRef.current

    if (!element) return

    if (!isPresent && element.contains(document.activeElement)) {
      focusThinkingButton()
    }

    element.inert = !isPresent

    if (isPresent) element.removeAttribute('aria-hidden')
    else element.setAttribute('aria-hidden', 'true')
  }, [isPresent])

  return (
    <motion.div
      ref={buttonRef}
      initial={
        reduceMotion ? false : { opacity: 0, transform: 'translateY(8px)' }
      }
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      exit={{
        opacity: 0,
        transform: reduceMotion ? 'translateY(0px)' : 'translateY(8px)',
        transition: {
          duration: reduceMotion ? 0 : DURATION.fast,
          ease: EASE.in,
          delay: 0,
        },
      }}
      transition={{
        duration: reduceMotion ? 0 : DURATION.base,
        ease: EASE.out,
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            aria-label='停止生成'
            onClick={() => {
              if (!isPresent) return

              focusThinkingButton()
              onStop()
            }}
            className='h-9 gap-1.5 rounded-full bg-destructive/10 px-2.5 text-destructive hover:bg-destructive/20'
          >
            <Square className='size-3.5 fill-current' />
            停止
          </Button>
        </TooltipTrigger>
        <TooltipContent>停止本轮生成</TooltipContent>
      </Tooltip>
    </motion.div>
  )
}

export default function Composer() {
  const {
    streaming,
    composerDraft: draft,
    composerSkillIds,
    initializing,
    loadingMessages,
    deepThinking,
    setDeepThinking,
  } = useAssistantStore()

  const { sendMessage, stopStreaming } = useChatStream()
  const { resumes, jobs } = useComposerContext()
  const disabled = streaming || initializing || loadingMessages

  const { text: visibleDraft, references } = useMemo(
    () => parseComposerDraft(draft),
    [draft],
  )

  const appendDraft = (token: string, label: string) => {
    const current = parseComposerDraft(
      useAssistantStore.getState().composerDraft,
    )

    if (current.references.some((reference) => reference.token === token))
      return

    const next = composeDraft(current.text, [
      ...current.references,
      { token, label },
    ])

    useAssistantStore.getState().setComposerDraft(next)
  }

  const contextOptions = useMemo<ComposerContextOption[]>(() => {
    const opts: ComposerContextOption[] = []

    resumes.forEach((r) =>
      opts.push({
        id: `resume-${r.resumeId}`,
        label: `简历：${r.name}`,
        icon: <FileText className='size-4' />,
        onClick: () =>
          appendDraft(
            `【参考简历：${r.name}(resumeId=${r.resumeId})】`,
            `简历：${r.name}`,
          ),
      }),
    )

    jobs.forEach((j) =>
      opts.push({
        id: `job-${j.id}`,
        label: `职位：${j.company} · ${j.position}`,
        icon: <Briefcase className='size-4' />,
        onClick: () =>
          appendDraft(
            `【参考职位：${j.company}·${j.position}】`,
            `职位：${j.company} · ${j.position}`,
          ),
      }),
    )

    return opts
  }, [resumes, jobs])

  const handleToolSelect = (tool: Tool) => {
    if (tool.skillId) {
      const state = useAssistantStore.getState()

      state.setComposerSkillIds([
        ...new Set([...state.composerSkillIds, tool.skillId]),
      ])

      const current = parseComposerDraft(state.composerDraft)

      if (/^[$/]\S*$/.test(current.text.trim()))
        state.setComposerDraft(composeDraft('', current.references))

      return
    }

    const template = TEMPLATE_PROMPTS[tool.name] ?? ''

    if (!template) return

    const current = parseComposerDraft(
      useAssistantStore.getState().composerDraft,
    )

    const cur = current.text

    // 通过 "/" 触发时替换掉查询串；否则追加到已有内容
    const merged = cur.startsWith('/')
      ? template
      : cur
        ? `${cur}\n${template}`
        : template

    // 去掉模板末尾多余的换行，避免插入后留下一个空行（光标随后聚焦到末尾）
    const next = merged.replace(/\n+$/, '')

    useAssistantStore
      .getState()
      .setComposerDraft(composeDraft(next, current.references))
  }

  const submit = (message: string) => {
    const text = composeDraft(message.trim(), references)

    if (disabled || (!text && composerSkillIds.length === 0)) return
    if (sendMessage(text, composerSkillIds)) {
      useAssistantStore.setState({ composerDraft: '', composerSkillIds: [] })
    }
  }

  const selectedSkills = useMemo(
    () =>
      composerSkillIds.flatMap((id) => {
        const skill = BUILTIN_SKILLS.find((item) => item.id === id)

        return skill ? [{ id: skill.id, displayName: skill.displayName }] : []
      }),
    [composerSkillIds],
  )

  return (
    <div className='mx-auto w-full max-w-4xl px-3 sm:px-6 lg:px-8'>
      <GaiaComposer
        value={visibleDraft}
        maxRows={6}
        placeholder={COMPOSER_PLACEHOLDER}
        disabled={disabled}
        showToolsButton
        tools={ASSISTANT_TOOLS}
        onToolSelect={handleToolSelect}
        composerHeader={
          <div className='max-h-28 overflow-y-auto [scrollbar-width:thin]'>
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
                    references.filter((reference) => reference.token !== token),
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
          </div>
        }
        canSubmit={composerSkillIds.length > 0 || references.length > 0}
        contextOptions={contextOptions}
        trailingActions={
          <>
            <AnimatePresence initial={false}>
              {streaming && (
                <StopGenerationButton
                  key='stop-generation'
                  onStop={stopStreaming}
                />
              )}
            </AnimatePresence>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  aria-label='深度思考'
                  aria-pressed={deepThinking}
                  onClick={() => setDeepThinking(!deepThinking)}
                  className={cn(
                    'h-9 gap-1.5 rounded-full px-2.5',
                    deepThinking
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground hover:bg-accent',
                  )}
                >
                  <Brain className='size-4' />
                  深度思考
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {deepThinking ? '已开启深度思考' : '开启深度思考，耗时更长'}
              </TooltipContent>
            </Tooltip>
          </>
        }
        onChange={(value) =>
          useAssistantStore
            .getState()
            .setComposerDraft(composeDraft(value, references))
        }
        onSubmit={submit}
      />
      <QuotaMeter className='mt-1.5' />
    </div>
  )
}
