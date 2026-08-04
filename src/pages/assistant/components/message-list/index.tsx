import { Sparkles } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { WaveSpinner } from '@/components/ui/wave-spinner'
import { useChatStream } from '../../hooks/use-chat-stream'
import useAssistantStore from '../../store'
import { MessageBubble } from '../message-bubble'

const LIST_SKELETON_KEYS = ['msg-skeleton-1', 'msg-skeleton-2', 'msg-skeleton-3'] as const

export default function MessageList() {
  const messages = useAssistantStore(s => s.messages)
  const streaming = useAssistantStore(s => s.streaming)
  const streamingParts = useAssistantStore(s => s.streamingParts)
  const loading = useAssistantStore(s => s.loadingMessages)
  const { retryLast } = useChatStream()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingParts, streaming])

  // 编辑：把用户消息文本回填到输入框
  const handleEdit = (text: string) => {
    useAssistantStore.getState().setComposerDraft(text)
  }

  // 仅最后一条助手消息可重试
  const lastAssistantId = [...messages].reverse().find(m => m.role === 'assistant')?.id

  if (loading) {
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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-6 lg:px-8">
      {messages.map(m => (
        <MessageBubble
          key={m.id}
          message={m}
          onEdit={msg => handleEdit(msg.parts.filter(p => p.type === 'text').map(p => (p as { text: string }).text).join('\n'))}
          onRetry={m.id === lastAssistantId ? retryLast : undefined}
        />
      ))}
      {streaming && (
        streamingParts.length > 0
          ? (
              <MessageBubble
                message={{ id: 'streaming', conversationId: '', userId: '', role: 'assistant', parts: streamingParts, createdAt: new Date().toISOString() }}
              />
            )
          : (
              <div className="flex gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="size-4" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <WaveSpinner />
                </div>
              </div>
            )
      )}
      <div ref={bottomRef} />
    </div>
  )
}
