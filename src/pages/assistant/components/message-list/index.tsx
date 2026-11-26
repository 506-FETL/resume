import { useShallow } from 'zustand/react/shallow'
import { Sparkles } from 'lucide-react'
import AnimatedContent from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { AssistantMessagesSkeleton } from '@/components/page-skeletons/assistant'
import useAssistantStore from '../../store'
import { LoadedMessages } from './transcript'

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
      olderMessagesError: state.olderMessagesError,
      historicalMatch: state.historicalMatch,
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
