import type { AutoScrollContainerHandle } from '@/components/ui/auto-scroll-container'
import { ArrowDown, Sparkles } from 'lucide-react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useEffect, useRef } from 'react'
import AnimatedContent from '@/components/motion/animated-content'
import { AutoScrollContainer } from '@/components/ui/auto-scroll-container'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DURATION, EASE } from '@/lib/motion'
import {
  CONVERSATION_BOTTOM_TARGET,
  MESSAGE_HIGHLIGHT_DURATION_MS,
} from '../../const'
import { useAssistantNavigation } from '../../hooks/use-assistant-navigation'
import { useChatStream } from '../../hooks/use-chat-stream'
import useAssistantStore from '../../store'
import ConfirmCard from '../confirm-card'
import { MessageBubble } from '../message-bubble'

const LIST_SKELETON_KEYS = [
  'msg-skeleton-1',
  'msg-skeleton-2',
  'msg-skeleton-3',
] as const

export default function MessageList() {
  const snapshot = useAssistantStore()

  const {
    initializing,
    loadingMessages,
    messages,
    streaming,
    conversationViewVersion,
  } = snapshot

  const viewState =
    initializing || loadingMessages
      ? 'loading'
      : messages.length === 0 && !streaming
        ? 'empty'
        : 'ready'

  return (
    <AnimatedContent animationKey={viewState} className='h-full min-h-0'>
      {viewState === 'loading' ? (
        <div className='mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-6 lg:px-8'>
          {LIST_SKELETON_KEYS.map((key) => (
            <Skeleton key={key} className='h-16 w-2/3 rounded-2xl' />
          ))}
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
function LoadedMessages({
  snapshot,
}: {
  snapshot: ReturnType<typeof useAssistantStore.getState>
}) {
  const {
    activeConversationId,
    messages,
    streaming,
    streamingParts,
    streamingUsage,
    usageByMessageId,
    pendingConfirm,
    conversationViewVersion,
    targetMessageId,
    setTargetMessageId,
    hasMoreMessages,
    loadingOlder,
  } = snapshot

  const { regenerateFrom, editUserMessageAndRerun } = useChatStream()
  const { loadOlderMessages } = useAssistantNavigation()
  const isPresent = useIsPresent()
  const shouldReduceMotion = useReducedMotion()
  const autoScrollRef = useRef<AutoScrollContainerHandle>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isPresent || !targetMessageId) return

    const ownsTarget = () =>
      isCurrentMessageView(conversationViewVersion, activeConversationId) &&
      useAssistantStore.getState().targetMessageId === targetMessageId

    if (!ownsTarget()) return

    if (targetMessageId === CONVERSATION_BOTTOM_TARGET) {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ block: 'end', behavior: 'auto' })
        setTargetMessageId(null)
      }

      return
    }

    const element = contentRef.current?.querySelector<HTMLElement>(
      `#${CSS.escape(`assistant-message-${targetMessageId}`)}`,
    )

    if (!element) {
      setTargetMessageId(null)

      return
    }

    // 搜索定位属于主动离开底部；高亮清除或消息更新也不能重新抢走阅读位置。
    autoScrollRef.current?.pauseAutoScroll()

    const frame = window.requestAnimationFrame(() => {
      if (!ownsTarget()) return

      element.scrollIntoView({
        block: 'center',
        behavior: shouldReduceMotion ? 'auto' : 'smooth',
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
    targetMessageId,
  ])

  // 顶部哨兵：进入视口时加载更早消息，并补偿 scrollTop 避免视口跳动
  useEffect(() => {
    const sentinel = topSentinelRef.current

    if (!sentinel || !isPresent) return

    const root = sentinel.closest('.overflow-auto') as HTMLElement | null
    let cancelled = false
    let compensationFrame: number | undefined

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

        const before = root?.scrollHeight ?? 0

        await loadOlderMessages()

        if (
          cancelled ||
          !isCurrentMessageView(conversationViewVersion, activeConversationId)
        )
          return

        compensationFrame = requestAnimationFrame(() => {
          if (
            root?.isConnected &&
            !cancelled &&
            isCurrentMessageView(conversationViewVersion, activeConversationId)
          ) {
            const after = root.scrollHeight

            root.scrollTop += after - before
            // 补偿后重新测量：内容仍未填满视口时，保留原有的连续向前加载行为。
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

      if (compensationFrame !== undefined)
        cancelAnimationFrame(compensationFrame)
    }
  }, [
    activeConversationId,
    conversationViewVersion,
    isPresent,
    loadOlderMessages,
  ])

  return (
    // 复用仓库的粘底滚动容器：用户在底部时自动跟随流式输出；
    // 一旦向上滚动查看内容即暂停跟随，滚回底部后恢复跟随。
    <AutoScrollContainer
      ref={autoScrollRef}
      className='h-full'
      enabled={isPresent}
      dependency={[messages, streamingParts, pendingConfirm]}
      renderOverlay={({ atBottom, scrollToBottom }) => (
        <AnimatePresence initial={false}>
          {!atBottom && (
            <PresenceDiv
              key='scroll-to-bottom'
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{
                opacity: 0,
                y: shouldReduceMotion ? 0 : 8,
                transition: {
                  duration: shouldReduceMotion ? 0 : DURATION.fast,
                  ease: EASE.in,
                },
              }}
              transition={{
                duration: shouldReduceMotion ? 0 : DURATION.base,
                ease: EASE.out,
              }}
              className='pointer-events-none absolute inset-x-0 bottom-4 flex justify-center'
            >
              <Button
                variant='secondary'
                size='icon'
                aria-label='滚动到底部'
                className='pointer-events-auto size-9 rounded-full border shadow-md'
                onClick={() => {
                  setTargetMessageId(null)
                  scrollToBottom()
                }}
              >
                <ArrowDown className='size-4' />
              </Button>
            </PresenceDiv>
          )}
        </AnimatePresence>
      )}
    >
      <div
        ref={contentRef}
        className='mx-auto flex w-full max-w-4xl flex-col gap-5 px-3 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:px-8'
      >
        <div
          ref={topSentinelRef}
          className={hasMoreMessages ? 'flex justify-center py-2' : 'hidden'}
        >
          {loadingOlder && <Skeleton className='h-4 w-24 rounded-full' />}
        </div>
        {messages.map((message) => (
          <motion.div
            key={message.id}
            id={`assistant-message-${message.id}`}
            data-message-id={message.id}
            initial={false}
            animate={
              message.id === targetMessageId && !shouldReduceMotion
                ? {
                    backgroundColor: [
                      'color-mix(in oklab, var(--primary) 0%, transparent)',
                      'color-mix(in oklab, var(--primary) 10%, transparent)',
                      'color-mix(in oklab, var(--primary) 0%, transparent)',
                    ],
                  }
                : { backgroundColor: 'transparent' }
            }
            transition={{ duration: shouldReduceMotion ? 0 : 1.8 }}
            className='scroll-mt-20 rounded-2xl'
          >
            <MessageBubble
              message={message}
              usage={usageByMessageId[message.id] ?? null}
              onEditSave={editUserMessageAndRerun}
              onRegenerate={regenerateFrom}
            />
          </motion.div>
        ))}
        {streaming && (
          <MessageBubble
            message={{
              id: 'streaming',
              conversationId: '',
              userId: '',
              role: 'assistant',
              parts: streamingParts,
              createdAt: new Date().toISOString(),
            }}
            usage={streamingUsage}
          />
        )}
        <ConfirmCard />
        <div ref={bottomRef} id='assistant-message-bottom' aria-hidden='true' />
      </div>
    </AutoScrollContainer>
  )
}
