import type { TemplateRecord } from '@/lib/resume-template/schema'
import { create } from 'zustand'
import { deleteUserTemplate as deleteUserTemplateApi } from '@/lib/supabase/template'
import useTemplateEditorStore from './editor'
import { upsertTemplate } from './shared'

interface UserTemplatesState {
  userTemplates: TemplateRecord[]
  lastOpenedUserTemplateId: string | null
  setUserTemplates: (templates: TemplateRecord[]) => void
  setLastOpenedUserTemplateId: (id: string | null) => void
  findTemplate: (templateId: string | null) => TemplateRecord | null
  findLastOpenedTemplate: () => TemplateRecord | null
  hydrateTemplateDraft: (template: TemplateRecord) => void
  upsertAndSync: (template: TemplateRecord) => void
  removeAndSync: (templateId: string) => void
  deleteTemplate: (templateId: string) => Promise<void>
}

const useUserTemplatesStore = create<UserTemplatesState>()((set, get) => ({
  userTemplates: [],
  lastOpenedUserTemplateId: null,

  setUserTemplates: templates => set({ userTemplates: templates }),

  setLastOpenedUserTemplateId: id => set({ lastOpenedUserTemplateId: id }),

  findTemplate: (templateId) => {
    if (!templateId) {
      return null
    }

    return get().userTemplates.find(template => template.id === templateId) ?? null
  },

  findLastOpenedTemplate: () => {
    const { userTemplates, lastOpenedUserTemplateId } = get()

    if (!lastOpenedUserTemplateId) {
      return null
    }

    return userTemplates.find(template => template.id === lastOpenedUserTemplateId) ?? null
  },

  hydrateTemplateDraft: (template) => {
    useTemplateEditorStore.getState().hydrateDraft({
      templateId: template.id,
      manifest: template.manifest,
    })
  },

  upsertAndSync: (template) => {
    const nextUserTemplates = upsertTemplate(get().userTemplates, template)
    set({ userTemplates: nextUserTemplates })
  },

  removeAndSync: (templateId) => {
    const nextUserTemplates = get().userTemplates.filter(template => template.id !== templateId)

    set(state => ({
      userTemplates: nextUserTemplates,
      lastOpenedUserTemplateId: state.lastOpenedUserTemplateId === templateId ? null : state.lastOpenedUserTemplateId,
    }))
  },

  deleteTemplate: async (templateId) => {
    await deleteUserTemplateApi(templateId)
    get().removeAndSync(templateId)
  },
}))

export default useUserTemplatesStore
