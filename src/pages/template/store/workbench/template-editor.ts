import type { StoreApi } from 'zustand'
import type { TemplateWorkbenchMode, TemplateWorkbenchSource, TemplateWorkbenchTab } from '../shared'
import type { WorkbenchState } from './types'
import { toast } from 'sonner'
import useTemplateEditorStore from '../editor'
import useOfficialTemplatesStore from '../official-templates'
import useUserTemplatesStore from '../user-templates'

export interface TemplateEditorSlice {
  activeTab: TemplateWorkbenchTab
  mode: TemplateWorkbenchMode
  source: TemplateWorkbenchSource
  selectedTemplateId: string | null

  setTab: (tab: TemplateWorkbenchTab) => void
  getRecommendedHeroSecondaryAction: () => { label: string, onClick: () => void }
  openLibrary: (tab?: TemplateWorkbenchTab) => void
  openOfficialTemplateEditor: (templateId: string) => void
  openUserTemplateEditor: (templateId: string) => void
  customizeOfficialTemplate: (templateId: string) => void
  resetActiveTemplateDraft: () => void
}

type Set = StoreApi<WorkbenchState>['setState']
type Get = StoreApi<WorkbenchState>['getState']

export function createTemplateEditorSlice(set: Set, get: Get): TemplateEditorSlice {
  return {
    activeTab: 'official',
    mode: 'library',
    source: null,
    selectedTemplateId: null,

    setTab: activeTab => set({ activeTab }),

    getRecommendedHeroSecondaryAction: () => {
      const userStore = useUserTemplatesStore.getState()
      const lastOpenedTemplate = userStore.findLastOpenedTemplate()

      if (lastOpenedTemplate) {
        return {
          label: '继续编辑最近模板',
          onClick: () => get().openUserTemplateEditor(lastOpenedTemplate.id),
        }
      }

      if (userStore.userTemplates.length > 0) {
        return {
          label: '查看我的模板',
          onClick: () => get().setTab('mine'),
        }
      }

      return {
        label: '创建第一个模板',
        onClick: () => get().setTab('official'),
      }
    },

    openLibrary: (tab) => {
      useTemplateEditorStore.getState().resetEditor()
      set(state => ({
        activeTab: tab ?? state.activeTab,
        mode: 'library',
        source: null,
        selectedTemplateId: null,
      }))
    },

    openOfficialTemplateEditor: (templateId) => {
      useOfficialTemplatesStore.getState().hydrateTemplateDraft(templateId)
      set({
        mode: 'editor',
        source: 'official',
        selectedTemplateId: templateId,
      })
    },

    openUserTemplateEditor: (templateId) => {
      const userStore = useUserTemplatesStore.getState()
      const template = userStore.findTemplate(templateId)

      if (!template) {
        toast.error('模板不存在或已被移除')
        return
      }

      userStore.hydrateTemplateDraft(template)
      set({
        mode: 'editor',
        source: 'user',
        selectedTemplateId: templateId,
      })
      userStore.setLastOpenedUserTemplateId(templateId)
    },

    customizeOfficialTemplate: (templateId) => {
      get().openOfficialTemplateEditor(templateId)
    },

    resetActiveTemplateDraft: () => {
      const state = get()

      if (state.source === 'official') {
        const selectedOfficialTemplate = useOfficialTemplatesStore.getState().findTemplate(state.selectedTemplateId)
        if (selectedOfficialTemplate)
          useOfficialTemplatesStore.getState().hydrateTemplateDraft(selectedOfficialTemplate.id)
        return
      }

      if (state.source === 'user') {
        const selectedUserTemplate = useUserTemplatesStore.getState().findTemplate(state.selectedTemplateId)
        if (selectedUserTemplate)
          useUserTemplatesStore.getState().hydrateTemplateDraft(selectedUserTemplate)
      }
    },
  }
}
