import type { TemplatePageState } from './types'
import { create } from 'zustand'
import { defaultTemplateCatalogItem } from '@/lib/resume-template/catalog/default'

export const useTemplatePageStore = create<TemplatePageState>(set => ({
  selectedTemplateId: null,
  showPreview: (selectedTemplateId, selectedExample) => set({ selectedTemplateId, selectedExample, previewOpen: true }),
  previewOpen: false,
  selectedExample: defaultTemplateCatalogItem.defaultExample,
  setPreviewOpen: previewOpen => set({ previewOpen }),
  selectExample: selectedExample => set({ selectedExample }),
}))
