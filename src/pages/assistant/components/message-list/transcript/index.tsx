import type { AiMessage } from '@/lib/ai/types'
import { AnimatePresence, useIsPresent } from 'motion/react'
import { useEffect, useRef } from 'react'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from '@/components/ui/message-scroller'
import { Skeleton } from '@/components/ui/skeleton'
import { useAssistantNavigation } from '../../../hooks/use-assistant-navigation'
import { useChatStream } from '../../../hooks/use-chat-stream'
import { useMessageRowKeys } from '../../../hooks/use-message-row-keys'
import {
  isCurrentMessageView,
  useMessageTarget,
} from '../../../hooks/use-message-target'
import useAssistantStore from '../../../store'
import type { MessageViewSnapshot } from '../types'
import { MessageRow } from '../message-row'

// 真实消息挂载后才注册定位和哨兵；退出期间保留当时的内容，不消费新会话的定位目标。
export function LoadedMessages({
  snapshot,
}: {
  snapshot: MessageViewSnapshot
}) {
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
  const { scrollToEnd } = useMessageScroller()
  const rowKeys = useMessageRowKeys(messages)
  const viewportRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)

  const highlightedMessageId = useMessageTarget(
    snapshot,
    viewportRef,
    isPresent,
  )

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
                  highlighted={
                    message.id === targetMessageId &&
                    message.id === highlightedMessageId
                  }
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
