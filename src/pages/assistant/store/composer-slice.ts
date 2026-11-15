import type { ExperienceSourceRelation } from '@/lib/experience-sources/types'
import type { StateCreator } from 'zustand'
import type {
  AiMessage,
  AiReferencePart,
  AiUserReference,
} from '@/lib/ai/types'
import { uniqueReferences } from '@/lib/ai/references'

export interface AssistantSubmission {
  id: string
  conversationId: string | null
  ownerId: string
  text: string
  references: AiUserReference[]
  thinking: boolean
  createdAt: string
  targetResumeId: string | null
  sources?: ExperienceSourceRelation[]
  proposalId?: string
  status?: 'unknown'
}

export type AssistantRunPhase =
  | 'idle'
  | 'preparing'
  | 'generating'
  | 'confirming'
  | 'applying'
  | 'compacting'
  | 'settling'
  | 'saving'

export interface ComposerSlice {
  composerDraft: string
  composerReferences: AiUserReference[]
  composerUploadCount: number
  composerSkillIds: string[]
  composerLibrarySources: ExperienceSourceRelation[] | null
  confirmationFeedback: string
  queuedMessages: AssistantSubmission[]
  pendingAssistantWrite: AiMessage | null
  pendingMessageUpdates: AiMessage[]
  draftStorageFailed: boolean
  queuePaused: boolean
  runPhase: AssistantRunPhase
  sourceScopeRevision: number
  explicitPreviewResumeId: string | null
  focusComposerOnCanvasClose: boolean
  sourceViewer: {
    sourceId: string
    versionId: string
    name: string
    blockId?: string
    open: boolean
    returnFocus: HTMLElement | null
  } | null
  openSourceViewer: (
    source: {
      sourceId: string
      versionId: string
      name: string
      blockId?: string
    },
    returnFocus?: HTMLElement | null,
  ) => void
  annotationTarget: Extract<AiReferencePart, { kind: 'annotation' }> | null
  setComposerDraft: (text: string) => void
  setComposerReferences: (references: AiUserReference[]) => void
  addComposerReferences: (references: AiUserReference[]) => void
  setComposerSkillIds: (ids: string[]) => void
  setConfirmationFeedback: (text: string) => void
}

export const createComposerSlice: StateCreator<ComposerSlice> = (set) => ({
  composerDraft: '',
  composerReferences: [],
  composerUploadCount: 0,
  composerSkillIds: [],
  composerLibrarySources: null,
  confirmationFeedback: '',
  queuedMessages: [],
  pendingAssistantWrite: null,
  pendingMessageUpdates: [],
  draftStorageFailed: false,
  queuePaused: true,
  runPhase: 'idle',
  sourceScopeRevision: 0,
  explicitPreviewResumeId: null,
  focusComposerOnCanvasClose: false,
  sourceViewer: null,
  openSourceViewer: (source, returnFocus) =>
    set({
      sourceViewer: {
        ...source,
        open: true,
        returnFocus:
          returnFocus ??
          (document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null),
      },
    }),
  annotationTarget: null,
  setComposerDraft: (composerDraft) => set({ composerDraft }),
  setComposerReferences: (references) =>
    set({ composerReferences: uniqueReferences(references) }),
  addComposerReferences: (references) =>
    set((state) => ({
      composerReferences: uniqueReferences([
        ...state.composerReferences,
        ...references,
      ]),
    })),
  setComposerSkillIds: (ids) => set({ composerSkillIds: [...new Set(ids)] }),
  setConfirmationFeedback: (confirmationFeedback) =>
    set({ confirmationFeedback }),
})
