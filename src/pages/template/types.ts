import type { ExampleRef } from '@/lib/resume-template/source/types'

export interface TemplatePageState {
  selectedTemplateId: string | null
  showPreview: (templateId: string, example: ExampleRef) => void
  previewOpen: boolean
  selectedExample: ExampleRef
  setPreviewOpen: (open: boolean) => void
  selectExample: (example: ExampleRef) => void
}
