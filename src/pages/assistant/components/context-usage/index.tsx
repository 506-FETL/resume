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
import AnimatedContent from '@/components/motion/animated-content'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import {
  MODEL_CONTEXT_LIMITS,
  ASSISTANT_MODEL,
} from '@/lib/ai/agent/context-budget'
import useAssistantStore from '../../store'

const tokenFormat = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export default function ContextUsage() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dismissedRef = useRef(false)
  const reduced = useReducedMotion()
  const messages = useAssistantStore((state) => state.messages)

  const conversationId = useAssistantStore(
    (state) => state.activeConversationId,
  )

  const currentUsage = useAssistantStore((state) =>
    state.streaming
      ? state.streamingParts.find(
          (part) =>
            part.type === 'context-usage' && part.model === ASSISTANT_MODEL,
        )
      : undefined,
  )

  const streaming = useAssistantStore((state) => state.streaming)
  const initializing = useAssistantStore((state) => state.initializing)
  const loadingMessages = useAssistantStore((state) => state.loadingMessages)
  const bootstrapError = useAssistantStore((state) => state.bootstrapError)

  const switchingConversation = useAssistantStore(
    (state) =>
      state.pendingConversationId !== null &&
      state.pendingConversationId !== state.activeConversationId,
  )

  const phase = useAssistantStore((state) => state.runPhase)

  const compaction = useAssistantStore((state) =>
    state.contextCompaction?.conversationId === state.activeConversationId &&
    state.contextCompaction?.viewVersion === state.conversationViewVersion &&
    !state.pendingConversationId
      ? state.contextCompaction
      : null,
  )

  const previousUsage = useMemo(() => {
    const assistant = [...messages]
      .reverse()
      .find(
        (message) =>
          message.role === 'assistant' &&
          message.conversationId === conversationId,
      )

    return assistant?.parts.find(
      (part) => part.type === 'context-usage' && part.model === ASSISTANT_MODEL,
    )
  }, [conversationId, messages])

  const snapshot = switchingConversation
    ? undefined
    : (currentUsage ?? previousUsage)

  const actual = snapshot?.type === 'context-usage' ? snapshot : undefined
  const input = actual?.inputTokens
  const outputTotal = actual?.outputTokens
  const reasoning = actual?.reasoningTokens

  const status = actual
    ? currentUsage
      ? '本次调用'
      : '上次调用'
    : bootstrapError
      ? '读取失败'
      : initializing || loadingMessages
        ? '读取中'
        : streaming
          ? '准备中'
          : messages.length
            ? '未记录'
            : '未发送'

  const output =
    outputTotal == null
      ? undefined
      : Math.max(0, outputTotal - (reasoning ?? 0))

  const estimated = actual?.estimated ?? false

  const used =
    input == null ? undefined : input + (outputTotal ?? reasoning ?? 0)

  const incompleteTotal = Boolean(actual && !estimated && outputTotal == null)
  const totalPrefix = estimated ? '约 ' : outputTotal == null ? '≥ ' : ''

  const percent =
    used == null
      ? undefined
      : (incompleteTotal ? Math.floor : Math.round)(
          (used / MODEL_CONTEXT_LIMITS.taskContextTokens) * 100,
        )

  const indicator =
    phase === 'compacting'
      ? '压缩中'
      : compaction
        ? '已压缩'
        : percent == null
          ? status
          : `${totalPrefix}${percent}%`

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
          aria-label={`上下文占用，${actual && !compaction && phase !== 'compacting' ? `${status}，` : ''}${indicator}`}
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
          <span className='relative inline-flex min-w-6 justify-center tabular-nums'>
            <AnimatedContent
              as='span'
              animationKey={
                phase === 'compacting'
                  ? 'compacting'
                  : compaction
                    ? 'compacted'
                    : actual
                      ? currentUsage
                        ? 'current'
                        : 'previous'
                      : status
              }
              mode='popLayout'
            >
              {indicator}
            </AnimatedContent>
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
          <span className='font-medium'>
            {actual && !currentUsage ? '上次调用' : '上下文'}
          </span>
          <span className='text-muted-foreground tabular-nums'>
            {used == null
              ? status
              : `${totalPrefix}${incompleteTotal ? used.toLocaleString('en-US') : tokenFormat.format(used)}`}
            {' / '}
            {tokenFormat.format(MODEL_CONTEXT_LIMITS.taskContextTokens)}
          </span>
        </div>
        <Progress
          value={percent == null ? undefined : Math.min(percent, 100)}
          aria-label='上下文占用'
          aria-valuetext={
            percent == null ? status : `${totalPrefix}${percent}%`
          }
        />
        <dl className='grid grid-cols-2 gap-y-2 text-sm'>
          <dt className='text-muted-foreground'>模型输入</dt>
          <dd className='text-right tabular-nums'>
            {input == null
              ? status === '未发送'
                ? '发送后统计'
                : '未统计'
              : `${estimated ? '约 ' : ''}${tokenFormat.format(input)}`}
          </dd>
          <dt className='text-muted-foreground'>输出</dt>
          <dd className='text-right tabular-nums'>
            {output == null
              ? status === '未发送'
                ? '尚未生成'
                : '未返回'
              : tokenFormat.format(output)}
          </dd>
          <dt className='text-muted-foreground'>推理</dt>
          <dd className='text-right tabular-nums'>
            {reasoning == null
              ? status === '未发送'
                ? '尚未生成'
                : '未返回'
              : tokenFormat.format(reasoning)}
          </dd>
        </dl>
        <AnimatedContent
          animationKey={compaction ? 'compacted' : 'usage-description'}
        >
          <p className='text-xs leading-relaxed text-muted-foreground'>
            {compaction ? (
              <>
                {compaction.messageCount
                  ? `已将 ${compaction.messageCount} 条较早消息整理为摘要。`
                  : '较早对话已整理为摘要。'}
                上方为上次调用用量，下次发送后更新。
              </>
            ) : (
              <>
                {actual ? `${status} token。` : ''}
                输入包含对话、资料、系统提示和工具定义。
              </>
            )}
          </p>
        </AnimatedContent>
      </HoverCardContent>
    </HoverCard>
  )
}
