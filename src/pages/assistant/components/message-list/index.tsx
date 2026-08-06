import { ArrowDown, Sparkles } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { Shimmer } from '@/components/ai/shimmer'
import { AutoScrollContainer } from '@/components/ui/auto-scroll-container'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CONVERSATION_BOTTOM_TARGET, MESSAGE_HIGHLIGHT_DURATION_MS } from '../../const'
import { useChatStream } from '../../hooks/use-chat-stream'
import useAssistantStore from '../../store'
import ConfirmCard from '../confirm-card'
import { MessageBubble } from '../message-bubble'

const LIST_SKELETON_KEYS = ['msg-skeleton-1', 'msg-skeleton-2', 'msg-skeleton-3'] as const

export default function MessageList() {
  const {
    messages,
    streaming,
    streamingParts,
    streamingUsage,
    usageByMessageId,
    pendingConfirm,
    initializing,
    loadingMessages: loading,
    conversationViewVersion,
    targetMessageId,
    setTargetMessageId,
  } = useAssistantStore()
  const { regenerateFrom, editUserMessageAndRerun } = useChatStream()
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    if (!targetMessageId || initializing || loading)
      return

    if (targetMessageId === CONVERSATION_BOTTOM_TARGET) {
      const bottom = document.getElementById('assistant-message-bottom')
      bottom?.scrollIntoView({ block: 'end', behavior: 'auto' })
      setTargetMessageId(null)
      return
    }

    const element = document.getElementById(`assistant-message-${targetMessageId}`)
    if (!element) {
      setTargetMessageId(null)
      return
    }

    const frame = window.requestAnimationFrame(() => {
      element.scrollIntoView({
        block: 'center',
        behavior: shouldReduceMotion ? 'auto' : 'smooth',
      })
    })

    const timer = window.setTimeout(
      () => setTargetMessageId(null),
      MESSAGE_HIGHLIGHT_DURATION_MS,
    )
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [initializing, loading, messages, setTargetMessageId, shouldReduceMotion, targetMessageId])

  if (initializing || loading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-6 lg:px-8">
        {LIST_SKELETON_KEYS.map(key => <Skeleton key={key} className="h-16 w-2/3 rounded-2xl" />)}
      </div>
    )
  }

  if (messages.length === 0 && !streaming) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="size-6" />
        </div>
        <div>
          <p className="text-base font-medium">AI 简历助手</p>
          <p className="mt-1 text-sm text-muted-foreground">问我任何关于简历、求职的问题</p>
        </div>
      </div>
    )
  }

  return (
    // 复用仓库的粘底滚动容器：用户在底部时自动跟随流式输出；
    // 一旦向上滚动查看内容即暂停跟随，滚回底部后恢复跟随。
    <AutoScrollContainer
      key={conversationViewVersion}
      className="h-full"
      dependency={[messages, streamingParts, pendingConfirm]}
      renderOverlay={({ atBottom, scrollToBottom }) => (
        !atBottom && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <Button
              variant="secondary"
              size="icon"
              aria-label="滚动到底部"
              className="pointer-events-auto size-9 rounded-full border shadow-md"
              onClick={scrollToBottom}
            >
              <ArrowDown className="size-4" />
            </Button>
          </div>
        )
      )}
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-6 lg:px-8">
        {messages.map(message => (
          <motion.div
            key={message.id}
            id={`assistant-message-${message.id}`}
            data-message-id={message.id}
            initial={false}
            animate={message.id === targetMessageId && !shouldReduceMotion
              ? {
                  backgroundColor: [
                    'color-mix(in oklab, var(--primary) 0%, transparent)',
                    'color-mix(in oklab, var(--primary) 10%, transparent)',
                    'color-mix(in oklab, var(--primary) 0%, transparent)',
                  ],
                }
              : { backgroundColor: 'transparent' }}
            transition={{ duration: shouldReduceMotion ? 0 : 1.8 }}
            className="scroll-mt-20 rounded-2xl"
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
          streamingParts.length > 0
            ? (
                <MessageBubble
                  message={{ id: 'streaming', conversationId: '', userId: '', role: 'assistant', parts: streamingParts, createdAt: new Date().toISOString() }}
                  usage={streamingUsage}
                />
              )
            : (
                <div className="flex gap-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1 pt-1 text-sm">
                    <Shimmer duration={1.4}>正在思考…</Shimmer>
                  </div>
                </div>
              )
        )}
        <ConfirmCard />
        <div id="assistant-message-bottom" aria-hidden="true" />
      </div>
    </AutoScrollContainer>
  )
}
