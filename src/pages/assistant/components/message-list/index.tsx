import { useShallow } from 'zustand/react/shallow'
import type { AiMessage } from '@/lib/ai/types'
import { Sparkles } from 'lucide-react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { memo, useEffect, useRef, type ComponentProps, type Ref } from 'react'
import AnimatedContent from '@/components/motion/animated-content'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from '@/components/ui/message-scroller'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AssistantMessagesSkeleton } from '@/components/page-skeletons/assistant'
import { DURATION, EASE } from '@/lib/motion'
import {
  CONVERSATION_BOTTOM_TARGET,
  MESSAGE_HIGHLIGHT_DURATION_MS,
} from '../../const'
import { useAssistantNavigation } from '../../hooks/use-assistant-navigation'
import { useChatStream } from '../../hooks/use-chat-stream'
import { useMessageRowKeys } from '../../hooks/use-message-row-keys'
import useAssistantStore from '../../store'
import ConfirmCard from '../confirm-card'
import { MessageBubble } from '../message-bubble'

type MessageViewSnapshot = Pick<
  ReturnType<typeof useAssistantStore.getState>,
  | 'initializing'
  | 'bootstrapError'
  | 'loadingMessages'
  | 'pendingConversationId'
  | 'messages'
  | 'streaming'
  | 'activeConversationId'
  | 'streamingParts'
  | 'pendingConfirm'
  | 'conversationViewVersion'
  | 'targetMessageId'
  | 'setTargetMessageId'
  | 'hasMoreMessages'
  | 'loadingOlder'
>

export default function MessageList() {
  const snapshot = useAssistantStore(
    useShallow((state) => ({
      initializing: state.initializing,
      bootstrapError: state.bootstrapError,
      loadingMessages: state.loadingMessages,
      pendingConversationId: state.pendingConversationId,
      messages: state.messages,
      streaming: state.streaming,
      activeConversationId: state.activeConversationId,
      streamingParts: state.streamingParts,
      pendingConfirm: state.pendingConfirm,
      conversationViewVersion: state.conversationViewVersion,
      targetMessageId: state.targetMessageId,
      setTargetMessageId: state.setTargetMessageId,
      hasMoreMessages: state.hasMoreMessages,
      loadingOlder: state.loadingOlder,
    })),
  )

  const {
    initializing,
    bootstrapError,
    loadingMessages,
    pendingConversationId,
    activeConversationId,
    messages,
    streaming,
    conversationViewVersion,
  } = snapshot

  const viewState =
    initializing ||
    (loadingMessages &&
      (!activeConversationId || pendingConversationId !== activeConversationId))
      ? 'loading'
      : bootstrapError && !bootstrapError.preserveView
        ? 'error'
        : messages.length === 0 && !streaming
          ? 'empty'
          : 'ready'

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <AnimatedContent
        animationKey={bootstrapError?.preserveView ? 'refresh-error' : 'none'}
      >
        {bootstrapError?.preserveView && (
          <div
            role='alert'
            className='flex items-center justify-between gap-3 border-b px-4 py-2 text-sm text-muted-foreground'
          >
            <span>对话更新失败，当前内容已保留。</span>
            <Button
              variant='ghost'
              size='sm'
              onClick={() =>
                useAssistantStore.setState((state) => ({
                  bootstrapAttempt: state.bootstrapAttempt + 1,
                }))
              }
            >
              重试
            </Button>
          </div>
        )}
      </AnimatedContent>
      <AnimatedContent animationKey={viewState} className='min-h-0 flex-1'>
        {viewState === 'loading' ? (
          <AssistantMessagesSkeleton />
        ) : viewState === 'error' ? (
          <div className='flex h-full flex-col items-center justify-center gap-3 p-6 text-center'>
            <p role='alert' className='text-sm text-muted-foreground'>
              对话暂时未能加载，请重试。
            </p>
            <Button
              variant='outline'
              onClick={() =>
                useAssistantStore.setState((state) => ({
                  bootstrapAttempt: state.bootstrapAttempt + 1,
                }))
              }
            >
              重新加载
            </Button>
          </div>
        ) : viewState === 'empty' ? (
          <div className='flex h-full flex-col items-center justify-center gap-3 overflow-y-auto px-6 py-6 text-center'>
            <div className='flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary'>
              <Sparkles className='size-6' />
            </div>
            <p className='text-base font-medium'>想先处理哪件求职的事？</p>
            <p className='max-w-sm text-sm leading-relaxed text-muted-foreground'>
              直接描述你的问题，或从下方工具中选择简历修改、岗位分析等任务。已有简历或职位时，可用加号加入参考。
            </p>
          </div>
        ) : (
          <LoadedMessages key={conversationViewVersion} snapshot={snapshot} />
        )}
      </AnimatedContent>
    </div>
  )
}

function isCurrentMessageView(version: number, conversationId: string | null) {
  const current = useAssistantStore.getState()

  return (
    current.conversationViewVersion === version &&
    current.activeConversationId === conversationId &&
    !current.initializing &&
    !current.loadingMessages
  )
}

// 真实消息挂载后才注册定位和哨兵；退出期间保留当时的内容，不消费新会话的定位目标。
function LoadedMessages({ snapshot }: { snapshot: MessageViewSnapshot }) {
  const isPresent = useIsPresent()

  return (
    <MessageScrollerProvider autoScroll={isPresent} defaultScrollPosition='end'>
      <MessageTranscript snapshot={snapshot} />
    </MessageScrollerProvider>
  )
}

function MessageTranscript({ snapshot }: { snapshot: MessageViewSnapshot }) {
  const {
    activeConversationId,
    messages,
    streaming,
    streamingParts,
    pendingConfirm,
    conversationViewVersion,
    targetMessageId,
    setTargetMessageId,
    loadingOlder,
  } = snapshot

  const { regenerateFrom, editUserMessageAndRerun } = useChatStream()
  const { loadOlderMessages } = useAssistantNavigation()
  const isPresent = useIsPresent()
  const shouldReduceMotion = useReducedMotion()
  const { scrollToEnd, scrollToMessage } = useMessageScroller()
  const rowKeys = useMessageRowKeys(messages)
  const viewportRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)

  const visibleMessages: AiMessage[] = streaming
    ? [
        ...messages,
        {
          id: 'streaming',
          conversationId: activeConversationId ?? '',
          userId: '',
          role: 'assistant',
          parts: streamingParts,
          createdAt: '',
        },
      ]
    : messages

  useEffect(() => {
    // 主动发送恢复跟随；后续增量与完成不再抢走阅读位置。
    if (isPresent && streaming) scrollToEnd()
  }, [isPresent, scrollToEnd, streaming])

  useEffect(() => {
    if (!isPresent || !targetMessageId) return

    const ownsTarget = () =>
      isCurrentMessageView(conversationViewVersion, activeConversationId) &&
      useAssistantStore.getState().targetMessageId === targetMessageId

    if (!ownsTarget()) return

    if (targetMessageId === CONVERSATION_BOTTOM_TARGET) {
      if (scrollToEnd({ behavior: 'instant' })) setTargetMessageId(null)

      return
    }

    const frame = window.requestAnimationFrame(() => {
      if (!ownsTarget()) return

      scrollToMessage(targetMessageId, {
        align: 'center',
        behavior: shouldReduceMotion ? 'instant' : 'smooth',
      })
    })

    const timer = window.setTimeout(() => {
      if (ownsTarget()) setTargetMessageId(null)
    }, MESSAGE_HIGHLIGHT_DURATION_MS)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [
    activeConversationId,
    conversationViewVersion,
    isPresent,
    messages,
    setTargetMessageId,
    shouldReduceMotion,
    scrollToEnd,
    scrollToMessage,
    targetMessageId,
  ])

  // 历史补入的位置由 MessageScrollerViewport 保持，避免叠加手动补偿。
  useEffect(() => {
    const sentinel = topSentinelRef.current

    if (!sentinel || !isPresent) return

    const root = viewportRef.current
    let cancelled = false
    let observationFrame: number | undefined

    const io = new IntersectionObserver(
      async (entries) => {
        const current = useAssistantStore.getState()

        if (
          cancelled ||
          !entries[0]?.isIntersecting ||
          current.loadingOlder ||
          !current.hasMoreMessages ||
          !isCurrentMessageView(conversationViewVersion, activeConversationId)
        ) {
          return
        }

        await loadOlderMessages()

        if (
          cancelled ||
          !isCurrentMessageView(conversationViewVersion, activeConversationId)
        )
          return

        observationFrame = requestAnimationFrame(() => {
          if (
            root?.isConnected &&
            !cancelled &&
            isCurrentMessageView(conversationViewVersion, activeConversationId)
          ) {
            // 内容仍未填满视口时继续读取更早消息。
            io.unobserve(sentinel)
            io.observe(sentinel)
          }
        })
      },
      { root, threshold: 0.1 },
    )

    io.observe(sentinel)

    return () => {
      cancelled = true
      io.disconnect()

      if (observationFrame !== undefined) cancelAnimationFrame(observationFrame)
    }
  }, [
    activeConversationId,
    conversationViewVersion,
    isPresent,
    loadOlderMessages,
  ])

  return (
    <MessageScroller>
      <MessageScrollerViewport
        ref={viewportRef}
        aria-label='对话消息'
        className='relative'
      >
        <div
          ref={topSentinelRef}
          className='pointer-events-none absolute inset-x-0 top-0 h-px'
          aria-hidden='true'
        >
          {loadingOlder && (
            <Skeleton className='mx-auto mt-1 h-1 w-24 rounded-full' />
          )}
        </div>
        <MessageScrollerContent className='relative mx-auto flex w-full max-w-4xl flex-col gap-5 px-3 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:px-8'>
          <AnimatePresence initial={false} mode='popLayout'>
            {visibleMessages.map((message, index) => {
              const previousMessage = visibleMessages[index - 1]
              const isLast = index === visibleMessages.length - 1

              // 同一回复落库前后复用实例，保留 Trace 的展开状态与正文布局。
              const rowKey =
                rowKeys.get(message.id) ??
                (previousMessage ? `reply-${previousMessage.id}` : message.id)

              return (
                <MessageRow
                  key={rowKey}
                  message={message}
                  highlighted={message.id === targetMessageId}
                  showConfirmation={isLast}
                  hasConfirmation={isLast && pendingConfirm !== null}
                  onEditSave={editUserMessageAndRerun}
                  onRegenerate={regenerateFrom}
                />
              )
            })}
          </AnimatePresence>
        </MessageScrollerContent>
      </MessageScrollerViewport>
      <MessageScrollerButton
        onClick={(event) => {
          setTargetMessageId(null)

          event.currentTarget
            .closest<HTMLElement>('[data-slot=message-scroller]')
            ?.querySelector<HTMLElement>(
              '[data-slot=message-scroller-viewport]',
            )
            ?.focus({ preventScroll: true })
        }}
      />
    </MessageScroller>
  )
}

const MessageRow = memo(function MessageRow({
  message,
  onEditSave,
  onRegenerate,
  highlighted,
  showConfirmation,
  hasConfirmation,
  ref,
}: ComponentProps<typeof MessageBubble> & {
  highlighted: boolean
  showConfirmation: boolean
  hasConfirmation: boolean
  ref?: Ref<HTMLDivElement>
}) {
  const isPresent = useIsPresent()
  const reducedMotion = useReducedMotion()

  return (
    <MessageScrollerItem
      ref={ref}
      messageId={message.id}
      inert={!isPresent}
      aria-hidden={!isPresent || undefined}
    >
      <motion.div
        id={`assistant-message-${message.id}`}
        initial={false}
        animate={
          highlighted && !reducedMotion
            ? {
                opacity: 1,
                backgroundColor: [
                  'color-mix(in oklab, var(--primary) 0%, transparent)',
                  'color-mix(in oklab, var(--primary) 10%, transparent)',
                  'color-mix(in oklab, var(--primary) 0%, transparent)',
                ],
              }
            : { opacity: 1, backgroundColor: 'transparent' }
        }
        exit={{ opacity: 0 }}
        transition={{
          backgroundColor: { duration: reducedMotion ? 0 : 1.8 },
          opacity: {
            duration: reducedMotion || !hasConfirmation ? 0 : DURATION.fast,
            ease: EASE.in,
          },
        }}
        className='scroll-mt-20 rounded-2xl'
      >
        <MessageBubble
          message={message}
          onEditSave={onEditSave}
          onRegenerate={onRegenerate}
        />
        {showConfirmation && <ConfirmCard />}
      </motion.div>
    </MessageScrollerItem>
  )
})
