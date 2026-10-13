import type { TemplateManifest } from '@/lib/resume-template/schema'
import { create } from 'zustand'
import { cloneTemplateManifest } from '@/lib/resume-template/defaults'

interface HydrateDraftPayload {
  templateId?: string | null
  manifest: TemplateManifest
  previewResumeId?: string | null
}

interface MarkSavedPayload {
  request: TemplateSaveRequest
  templateId?: string | null
  manifest?: TemplateManifest | null
}

interface TemplateSaveRequest {
  sessionId: number
  revision: number
}

interface TemplateEditorState {
  templateId: string | null
  manifestDraft: TemplateManifest | null
  selectedSectionId: string | null
  previewResumeId: string | null
  dirty: boolean
  saving: boolean
  draftSessionId: number
  draftRevision: number
  activeSaveRequest: TemplateSaveRequest | null

  hydrateDraft: (payload: HydrateDraftPayload) => void
  setSelectedSection: (sectionId: string | null) => void
  applyManifest: (nextManifest: TemplateManifest | ((current: TemplateManifest) => TemplateManifest)) => void
  setPreviewResumeId: (resumeId: string | null) => void
  beginSave: () => TemplateSaveRequest | null
  markSaveFailed: (request: TemplateSaveRequest) => void
  markSaved: (payload: MarkSavedPayload) => boolean
  resetEditor: () => void
}

const INITIAL_STATE = {
  templateId: null,
  manifestDraft: null,
  selectedSectionId: null,
  previewResumeId: null,
  dirty: false,
  saving: false,
  draftSessionId: 0,
  draftRevision: 0,
  activeSaveRequest: null,
}

const useTemplateEditorStore = create<TemplateEditorState>()((set, get) => ({
  ...INITIAL_STATE,

  hydrateDraft: payload =>
    set(state => ({
      templateId: payload.templateId ?? null,
      manifestDraft: cloneTemplateManifest(payload.manifest),
      selectedSectionId: null,
      previewResumeId: payload.previewResumeId ?? null,
      dirty: false,
      saving: false,
      draftSessionId: state.draftSessionId + 1,
      draftRevision: 0,
      activeSaveRequest: null,
    })),

  setSelectedSection: sectionId => set({ selectedSectionId: sectionId }),

  applyManifest: nextManifest =>
    set((state) => {
      if (!state.manifestDraft) {
        return {}
      }

      const resolvedManifest = typeof nextManifest === 'function'
        ? nextManifest(state.manifestDraft)
        : nextManifest

      return {
        manifestDraft: cloneTemplateManifest(resolvedManifest),
        dirty: true,
        draftRevision: state.draftRevision + 1,
      }
    }),

  setPreviewResumeId: previewResumeId => set({ previewResumeId }),

  beginSave: () => {
    const state = get()
    if (!state.manifestDraft || state.saving)
      return null

    const request = { sessionId: state.draftSessionId, revision: state.draftRevision }
    set({ saving: true, activeSaveRequest: request })
    return request
  },

  markSaveFailed: request => set(state => state.activeSaveRequest === request
    ? { saving: false, activeSaveRequest: null }
    : {}),

  markSaved: (payload) => {
    const state = get()
    if (state.activeSaveRequest !== payload.request || state.draftSessionId !== payload.request.sessionId)
      return false

    const hasLaterEdits = state.draftRevision !== payload.request.revision
    set({
      templateId: payload.templateId ?? state.templateId,
      manifestDraft: !hasLaterEdits && payload.manifest ? cloneTemplateManifest(payload.manifest) : state.manifestDraft,
      dirty: hasLaterEdits,
      saving: false,
      activeSaveRequest: null,
    })
    return true
  },

  resetEditor: () => set(state => ({ ...INITIAL_STATE, draftSessionId: state.draftSessionId + 1 })),
}))

export default useTemplateEditorStore
