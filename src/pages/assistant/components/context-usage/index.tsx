import { useMemo, useRef, useState } from 'react'
import { Layers } from 'lucide-react'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { InputGroupButton } from '@/components/ui/input-group'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import {
  MODEL_CONTEXT_LIMITS,
  ASSISTANT_MODEL,
} from '@/lib/ai/agent/context-budget'
import { resolveActiveResumeId } from '@/lib/ai/active-resume'
import type { ExperienceSourceRelation } from '@/lib/experience-sources/types'
import { freezeSourceScope } from '../../store/source-scope'
import { getUserReferences } from '@/lib/ai/references'
import useAssistantStore from '../../store'
import { BouncingDots } from '@/components/loading-ui/bouncing-dots'

const tokenFormat = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export default function ContextUsage({
  sources,
}: {
  sources?: ExperienceSourceRelation[]
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dismissedRef = useRef(false)
  const reduced = useReducedMotion()
  const messages = useAssistantStore((state) => state.messages)
  const streamingParts = useAssistantStore((state) => state.streamingParts)
  const draft = useAssistantStore((state) => state.composerDraft)
  const references = useAssistantStore((state) => state.composerReferences)
  const phase = useAssistantStore((state) => state.runPhase)

  const fingerprint = useMemo(() => {
    const submitted = [...messages]
      .reverse()
      .find((message) => message.role === 'user')

    const scope = freezeSourceScope(
      sources ?? [],
      submitted ? getUserReferences(submitted.parts) : [],
    )

    return JSON.stringify(
      scope.map((source) => [source.sourceId, source.versionId]).sort(),
    )
  }, [sources, messages])

  const last = streamingParts.length
    ? streamingParts
    : (messages.at(-1)?.parts ?? [])

  const actual = last.find((part) => part.type === 'context-usage')

  const measured =
    actual?.type === 'context-usage' &&
    actual.model === ASSISTANT_MODEL &&
    actual.sourceFingerprint === fingerprint &&
    actual.targetResumeId === resolveActiveResumeId() &&
    !draft &&
    !references.length

  const input = measured ? actual.inputTokens : undefined
  const outputTotal = measured ? actual.outputTokens : undefined
  const reasoning = measured ? actual.reasoningTokens : undefined

  const output =
    outputTotal == null
      ? undefined
      : Math.max(0, outputTotal - (reasoning ?? 0))

  const estimated = !measured || actual.estimated
  const used = input == null ? undefined : input + (outputTotal ?? 0)

  const percent =
    used == null
      ? undefined
      : Math.round((used / MODEL_CONTEXT_LIMITS.taskContextTokens) * 100)

  return (
    <HoverCard
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen || !dismissedRef.current) setOpen(nextOpen)
      }}
      openDelay={10}
      closeDelay={100}
    >
      <HoverCardTrigger asChild>
        <InputGroupButton
          ref={triggerRef}
          type='button'
          size='sm'
          aria-label={
            percent == null
              ? '上下文占用，尚未统计'
              : `上下文占用，${estimated ? '约 ' : ''}${percent}%`
          }
          aria-expanded={open}
          onClick={() => {
            dismissedRef.current = open
            setOpen(!open)
          }}
          onPointerEnter={() => {
            dismissedRef.current = false
          }}
          onFocus={(event) => {
            if (
              !dismissedRef.current &&
              event.currentTarget.matches(':focus-visible')
            )
              setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              dismissedRef.current = true
              setOpen(false)
            }
          }}
          className='shrink-0 gap-1 px-1.5 text-xs text-muted-foreground'
        >
          {phase === 'compacting' ? (
            <Spinner className='size-4' aria-label='正在整理较早对话' />
          ) : (
            <Layers className='size-4' aria-hidden />
          )}
          <span>
            {percent == null ? (
              <BouncingDots className='w-4 h-4' />
            ) : (
              `${estimated ? '约 ' : ''}${percent}%`
            )}
          </span>
        </InputGroupButton>
      </HoverCardTrigger>
      <HoverCardContent
        onPointerDownOutside={(event) => {
          // 触发器自己切换开关，避免 outside 先关闭后又被 click 重新打开。
          if (triggerRef.current?.contains(event.target as Node))
            event.preventDefault()
        }}
        onEscapeKeyDown={() => {
          dismissedRef.current = true
          setOpen(false)
        }}
        side='top'
        align='start'
        collisionPadding={12}
        className='flex w-64 flex-col gap-3'
        style={reduced ? { animationDuration: '0s' } : undefined}
      >
        <div className='flex items-center justify-between gap-2 text-sm'>
          <span className='font-medium'>Context</span>
          <span className='text-muted-foreground tabular-nums'>
            {used == null
              ? '—'
              : `${estimated ? '约 ' : ''}${tokenFormat.format(used)}`}
            {' / '}
            {tokenFormat.format(MODEL_CONTEXT_LIMITS.taskContextTokens)}
          </span>
        </div>
        <Progress
          value={percent == null ? undefined : Math.min(percent, 100)}
          aria-label='上下文占用'
          aria-valuetext={
            percent == null
              ? '尚未统计'
              : `${estimated ? '约 ' : ''}${percent}%`
          }
        />
        <dl className='grid grid-cols-2 gap-y-2 text-sm'>
          <dt className='text-muted-foreground'>输入</dt>
          <dd className='text-right tabular-nums'>
            {input == null ? '—' : tokenFormat.format(input)}
          </dd>
          <dt className='text-muted-foreground'>输出</dt>
          <dd className='text-right tabular-nums'>
            {output == null ? '—' : tokenFormat.format(output)}
          </dd>
          <dt className='text-muted-foreground'>推理</dt>
          <dd className='text-right tabular-nums'>
            {reasoning == null ? '-' : tokenFormat.format(reasoning)}
          </dd>
        </dl>
      </HoverCardContent>
    </HoverCard>
  )
}
