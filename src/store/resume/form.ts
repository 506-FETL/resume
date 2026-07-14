import type { FormDataMap } from './const'
import type { DocumentSlice } from './slices/document'
import type { SyncSlice } from './slices/sync'
import type { WriteOp } from '@/hooks/collab/write-plan'
import type { ORDERType, PersistedResumeSnapshot, ResumeAppearancePatch, ResumeTemplateBinding, ResumeType, VisibilityItemsType } from '@/lib/schema'
import type { ResumeSnapshot } from '@/lib/supabase/resume/history'
import { create } from 'zustand'
import { applyWriteOpsDefault } from '@/hooks/collab/apply-write-ops'
import { DEFAULT_APPLICATION_INFO, DEFAULT_BASICS, DEFAULT_CAMPUS_EXPERIENCE, DEFAULT_EDU_BACKGROUND, DEFAULT_HOBBIES, DEFAULT_HONORS_CERTIFICATES, DEFAULT_INTERNSHIP_EXPERIENCE, DEFAULT_JOB_INTENT, DEFAULT_ORDER, DEFAULT_PROJECT_EXPERIENCE, DEFAULT_SELF_EVALUATION, DEFAULT_SKILL_SPECIALTY, DEFAULT_VISIBILITY, DEFAULT_WORK_EXPERIENCE } from '@/lib/schema'
import useResumeConfigStore, { registerResumeConfigPersistence } from './config'
import { FORM_DATA_KEYS, FORM_FIELD_DEFAULTS } from './const'
import { applyPatch, mapSourceToPersistedSnapshot, sanitizeDeep } from './helpers'
import { applyResumeChange, ensureSection, getPersistedSnapshot } from './helpers/sync-service'
import { createDocumentSlice } from './slices/document'
import { createSyncSlice } from './slices/sync'

interface FormSlice extends FormDataMap {
  activeTabId: ORDERType
  order: ORDERType[]
  visibility: Record<VisibilityItemsType, boolean>
  type: ResumeType
  templateBinding?: ResumeTemplateBinding

  toggleVisibility: (id: VisibilityItemsType) => void
  changeType: (type: ResumeType) => void
  setTemplateBinding: (binding?: ResumeTemplateBinding) => void
  getVisibility: (id: VisibilityItemsType) => boolean
  setVisibility: (id: VisibilityItemsType, isHidden: boolean) => void
  updateActiveTabId: (newActiveTab: ORDERType) => void
  getResumeFormData: () => FormDataMap
  getPersistedSnapshot: () => PersistedResumeSnapshot
  getHistoryRestoreSource: () => { snapshot: ResumeSnapshot, updatedAt: string | null }
  updateForm: <K extends keyof FormDataMap>(key: K, data: Partial<FormDataMap[K]>) => void
  updateFormFields: <K extends keyof FormDataMap>(key: K, nextValue: FormDataMap[K], ops: WriteOp[]) => void
  updateOrder: (newOrder: ORDERType[]) => void
  updateAppearanceConfig: (appearance: ResumeAppearancePatch) => void
  resetToDefaults: () => void
}

export interface ResumeState extends FormSlice, SyncSlice, DocumentSlice {}

const useResumeStore = create<ResumeState>()((set, get) => ({
  // --- Form state defaults ---
  basics: DEFAULT_BASICS,
  job_intent: DEFAULT_JOB_INTENT,
  order: DEFAULT_ORDER,
  activeTabId: 'basics',
  application_info: DEFAULT_APPLICATION_INFO,
  edu_background: DEFAULT_EDU_BACKGROUND,
  work_experience: DEFAULT_WORK_EXPERIENCE,
  internship_experience: DEFAULT_INTERNSHIP_EXPERIENCE,
  campus_experience: DEFAULT_CAMPUS_EXPERIENCE,
  project_experience: DEFAULT_PROJECT_EXPERIENCE,
  skill_specialty: DEFAULT_SKILL_SPECIALTY,
  honors_certificates: DEFAULT_HONORS_CERTIFICATES,
  self_evaluation: DEFAULT_SELF_EVALUATION,
  hobbies: DEFAULT_HOBBIES,
  visibility: DEFAULT_VISIBILITY,
  type: 'default',
  templateBinding: undefined,

  // --- Sync slice ---
  ...createSyncSlice(set, get),

  // --- Document slice ---
  ...createDocumentSlice(set, get),

  // --- Form actions ---
  getResumeFormData: () => {
    const state = get()
    return FORM_DATA_KEYS.reduce((acc, key) => {
      (acc[key] as any) = state[key]
      return acc
    }, {} as FormDataMap)
  },

  getPersistedSnapshot: () => getPersistedSnapshot(get()),

  getHistoryRestoreSource: () => {
    const state = get()
    return {
      snapshot: sanitizeDeep(getPersistedSnapshot(state)),
      updatedAt: state.docHandle?.doc()?._metadata?.updatedAt ?? null,
    }
  },

  updateActiveTabId: newActiveTab => set({ activeTabId: newActiveTab }),

  updateForm: (key, data) => {
    const sanitized = sanitizeDeep(data)
    applyResumeChange(
      set,
      get,
      prev => ({ [key]: { ...prev[key], ...sanitized } }),
      (doc) => {
        ensureSection(doc, key)
        applyPatch(doc[key], sanitized)
      },
    )
  },

  updateFormFields: (key, nextValue, ops) => {
    // 乐观本地状态：整段替换该 section 的普通 JS 状态（与 Automerge CRDT 是两套存储）。
    // 文档侧按字段级写操作应用，避免整段覆盖导致的跨字段抢占。
    applyResumeChange(
      set,
      get,
      { [key]: nextValue } as Partial<ResumeState>,
      (doc) => {
        ensureSection(doc, key)
        applyWriteOpsDefault(doc, ops)
      },
    )
  },

  updateOrder: (newOrder) => {
    applyResumeChange(
      set,
      get,
      { order: newOrder },
      (doc) => {
        doc.order = [...newOrder]
      },
    )
  },

  updateAppearanceConfig: (appearance) => {
    const sanitized = sanitizeDeep(appearance)
    if (Object.keys(sanitized).length === 0) {
      return
    }

    applyResumeChange(
      set,
      get,
      { appearanceDirty: true },
      (doc) => {
        if (sanitized.spacing) {
          doc.spacing = { ...(doc.spacing ?? {}), ...sanitized.spacing }
        }
        if (sanitized.font) {
          doc.font = { ...(doc.font ?? {}), ...sanitized.font }
        }
        if (sanitized.theme) {
          doc.theme = { ...(doc.theme ?? {}), ...sanitized.theme }
        }
      },
    )
  },

  changeType: (type) => {
    applyResumeChange(
      set,
      get,
      { type },
      (doc) => {
        doc.type = type
      },
    )
  },

  setTemplateBinding: (templateBinding) => {
    applyResumeChange(
      set,
      get,
      { templateBinding },
      (doc) => {
        doc.templateBinding = templateBinding
      },
    )
  },

  toggleVisibility: (id) => {
    const nextValue = !get().visibility[id]
    applyResumeChange(
      set,
      get,
      prev => ({ visibility: { ...prev.visibility, [id]: nextValue } }),
      (doc) => {
        ensureSection(doc, 'visibility')
        doc.visibility[id] = nextValue
      },
    )
  },

  getVisibility: id => get().visibility[id] !== true,

  setVisibility: (id, isHidden) => {
    applyResumeChange(
      set,
      get,
      prev => ({ visibility: { ...prev.visibility, [id]: isHidden } }),
      (doc) => {
        ensureSection(doc, 'visibility')
        doc.visibility[id] = isHidden
      },
    )
  },

  resetToDefaults: () => {
    useResumeConfigStore.getState().resetConfig()
    const defaultState = {
      ...Object.fromEntries(
        FORM_DATA_KEYS.map(key => [key, FORM_FIELD_DEFAULTS[key].default]),
      ),
      order: DEFAULT_ORDER,
      visibility: DEFAULT_VISIBILITY,
      templateBinding: undefined,
    }

    applyResumeChange(
      set,
      get,
      defaultState,
      (doc) => {
        Object.assign(doc, mapSourceToPersistedSnapshot(null))
      },
    )
  },
}))

registerResumeConfigPersistence(appearance => useResumeStore.getState().updateAppearanceConfig(appearance))

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    useResumeStore.getState().cleanup()
  })
}

export default useResumeStore
