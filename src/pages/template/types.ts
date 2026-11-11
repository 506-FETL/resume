import type { ExampleRef } from '@/lib/resume-template/source/types'

export interface TemplatePageState {
  selectedTemplateId: string | null
  previewTrigger: HTMLButtonElement | null
  showPreview: (
    templateId: string,
    example: ExampleRef,
    trigger: HTMLButtonElement,
  ) => void
  previewOpen: boolean
  previewStep: 'preview' | 'details'
  setPreviewStep: (step: 'preview' | 'details') => void
  selectedExamples: Record<string, ExampleRef>
  setPreviewOpen: (open: boolean) => void
  selectExample: (templateId: string, example: ExampleRef) => void
  styleFilter: string | null
  layoutFilter: string | null
  setStyleFilter: (value: string | null) => void
  setLayoutFilter: (value: string | null) => void
  resetFilters: () => void
}
