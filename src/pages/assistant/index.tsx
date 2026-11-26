import { useExperienceHandoff } from './hooks/use-experience-handoff'
import AssistantCanvas from './components/assistant-canvas'
import ChatHeader from './components/chat-header'
import Composer from './components/composer'
import ConversationSearch from './components/conversation-search'
import MessageList from './components/message-list'
import SourceViewer from './components/source-viewer'
import { useAssistantBootstrap } from './hooks/use-assistant-bootstrap'
import { useAssistantLayout } from './hooks/use-assistant-layout'
import { useAssistantNavigation } from './hooks/use-assistant-navigation'
import { useWriteConfirmBridge } from './hooks/use-write-confirm-bridge'
import { lazy, Suspense, useState } from 'react'
import useUserStore from '@/store/user'
import { useFeatureGuidesStore } from '@/store/feature-guides'
import { ErrorBoundary } from 'react-error-boundary'

const AssistantGuide = lazy(
  () => import('@/features/feature-guides/assistant-guide'),
)

export default function Assistant() {
  const owner = useUserStore((state) => state.currentUser?.id)

  return owner ? <AssistantWorkspace key={owner} owner={owner} /> : null
}

function AssistantWorkspace({ owner }: { owner: string }) {
  const [showGuide] = useState(
    () =>
      !useFeatureGuidesStore
        .getState()
        .dismissed[owner]?.includes('assistant-quote'),
  )

  const rootRef = useAssistantLayout()

  useExperienceHandoff()
  useWriteConfirmBridge()
  useAssistantBootstrap()
  useAssistantNavigation(true)

  return (
    <div
      ref={rootRef}
      className='flex h-full min-h-0 w-full overflow-hidden bg-background'
    >
      <div data-assistant-chat className='flex min-h-0 min-w-0 flex-1 flex-col'>
        <ChatHeader />
        <div className='min-h-0 flex-1 overflow-hidden'>
          <MessageList />
        </div>
        <div className='shrink-0 bg-background/90 py-3 backdrop-blur'>
          <Composer />
        </div>
      </div>
      <AssistantCanvas />
      <ConversationSearch />
      <SourceViewer />
      {showGuide && (
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <AssistantGuide />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  )
}
