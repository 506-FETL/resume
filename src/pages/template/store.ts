import type { TemplatePageState } from './types'
import { publishedPreview } from './utils'
import { create } from 'zustand'

export const useTemplatePageStore = create<TemplatePageState>((set) => ({
  previewTarget: null,
  selectedTemplateId: null,
  previewTrigger: null,
  showPreview: (item, example, previewTrigger) =>
    set((state) => ({
      selectedTemplateId: item.templateId,
      previewTarget: item,
      previewTrigger,
      selectedExamples: {
        ...state.selectedExamples,
        [item.templateId]:
          state.selectedExamples[item.templateId]?.templateVersion ===
          item.currentVersion
            ? state.selectedExamples[item.templateId]
            : {
                templateVersion: item.currentVersion,
                example,
                preview: item.cardPreview ?? item.defaultPreview,
              },
      },
      previewOpen: true,
      previewStep: 'preview',
    })),
  previewOpen: false,
  previewStep: 'preview',
  setPreviewStep: (previewStep) => set({ previewStep }),
  selectedExamples: {},
  setPreviewOpen: (previewOpen) => set({ previewOpen }),
  selectExample: (item, example) =>
    set((state) => ({
      selectedExamples: {
        ...state.selectedExamples,
        [item.templateId]: {
          templateVersion: item.currentVersion,
          example,
          preview: publishedPreview(item, example, state.previewTarget),
        },
      },
    })),
  styleFilter: null,
  layoutFilter: null,
  setStyleFilter: (styleFilter) => set({ styleFilter }),
  setLayoutFilter: (layoutFilter) => set({ layoutFilter }),
  resetFilters: () => set({ styleFilter: null, layoutFilter: null }),
}))
