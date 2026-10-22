import type { TemplatePageState } from './types'
import { create } from 'zustand'

export const useTemplatePageStore = create<TemplatePageState>(set => ({
  selectedTemplateId: null,
  previewTrigger: null,
  showPreview: (selectedTemplateId, example, previewTrigger) => set(state => ({
    selectedTemplateId,
    previewTrigger,
    selectedExamples: { ...state.selectedExamples, [selectedTemplateId]: example },
    previewOpen: true,
  })),
  previewOpen: false,
  selectedExamples: {},
  setPreviewOpen: previewOpen => set({ previewOpen }),
  selectExample: (templateId, example) => set(state => ({
    selectedExamples: { ...state.selectedExamples, [templateId]: example },
  })),
  styleFilter: null,
  layoutFilter: null,
  setStyleFilter: styleFilter => set({ styleFilter }),
  setLayoutFilter: layoutFilter => set({ layoutFilter }),
  resetFilters: () => set({ styleFilter: null, layoutFilter: null }),
}))
