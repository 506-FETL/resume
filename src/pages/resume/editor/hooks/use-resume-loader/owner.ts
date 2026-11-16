import type { RefObject } from 'react'
import type { LoadedDocumentIdentity } from './route'
import { hydrateLoadedAppearance } from './appearance'
import useResumeStore from '@/store/resume/form'

export function createOwnerResumeLoader(
  loadResumeData: ReturnType<typeof useResumeStore.getState>['loadResumeData'],
  loadedDocumentIdentityRef: RefObject<LoadedDocumentIdentity | null>,
  assertCurrentLoad: () => void,
) {
  return async (targetResumeId: string) => {
    const currentIdentity = loadedDocumentIdentityRef.current
    const currentResumeState = useResumeStore.getState()

    if (
      currentIdentity?.resumeId === targetResumeId &&
      currentIdentity.source === 'owner' &&
      currentResumeState.currentResumeId === targetResumeId &&
      currentResumeState.isInitialized &&
      currentResumeState.docManager?.canPersist() === true
    ) {
      return
    }

    const result = await loadResumeData(targetResumeId, {
      source: { kind: 'owner' },
    })

    assertCurrentLoad()
    hydrateLoadedAppearance(result, { collaborationSource: false })

    loadedDocumentIdentityRef.current = {
      resumeId: targetResumeId,
      source: 'owner',
      loadKey: `resume:${targetResumeId}`,
    }
  }
}
