import type {
  ExampleRef,
  TemplateCardSummary,
  TemplateCatalogItem,
} from '@/lib/resume-template/source/types'

export interface TemplatePageState {
  previewTarget: TemplateCardSummary | null
  selectedTemplateId: string | null
  previewTrigger: HTMLButtonElement | null
  showPreview: (
    item: TemplateCardSummary,
    example: ExampleRef,
    trigger: HTMLButtonElement,
  ) => void
  previewOpen: boolean
  previewStep: 'preview' | 'details'
  setPreviewStep: (step: 'preview' | 'details') => void
  selectedExamples: Record<
    string,
    {
      templateVersion: number
      example: ExampleRef
      preview?: TemplateCardSummary['defaultPreview']
    }
  >
  setPreviewOpen: (open: boolean) => void
  selectExample: (item: TemplateCatalogItem, example: ExampleRef) => void
  styleFilter: string | null
  layoutFilter: string | null
  setStyleFilter: (value: string | null) => void
  setLayoutFilter: (value: string | null) => void
  resetFilters: () => void
}
