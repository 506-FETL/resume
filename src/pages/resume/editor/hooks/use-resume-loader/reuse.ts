import type { CollaborationRoute, LoadedDocumentIdentity } from './route'
import { useCollaborationStore } from '@/lib/collaboration'
import useResumeStore from '@/store/resume/form'
import type useUserStore from '@/store/user'

export function canReuseLoadedDocument(
  route: CollaborationRoute,
  activeResumeId: string,
  loadKey: string,
  loadedIdentity: LoadedDocumentIdentity | null,
  authState: ReturnType<typeof useUserStore.getState>,
) {
  const authenticatedUserId = authState.currentUser?.id ?? null

  const expectedDocumentSource =
    route.kind === 'invite' ? 'collaboration' : 'owner'

  const resumeState = useResumeStore.getState()

  const hasReusableDocument =
    loadedIdentity?.resumeId === activeResumeId &&
    loadedIdentity.source === expectedDocumentSource &&
    loadedIdentity.loadKey === loadKey &&
    resumeState.currentResumeId === activeResumeId &&
    resumeState.isInitialized &&
    resumeState.docManager !== null &&
    resumeState.docManager.canPersist() === (expectedDocumentSource === 'owner')

  const collaborationState = useCollaborationStore.getState()

  const isCurrentHostUrlTransition =
    route.kind === 'host-recovery' &&
    collaborationState.role === 'host' &&
    collaborationState.sessionId === route.sessionId &&
    collaborationState.resumeId === route.resumeId &&
    authState.authStatus === 'authenticated' &&
    authenticatedUserId === collaborationState.self?.userId &&
    collaborationState.isSharing

  return (
    hasReusableDocument && (route.kind === 'none' || isCurrentHostUrlTransition)
  )
}
