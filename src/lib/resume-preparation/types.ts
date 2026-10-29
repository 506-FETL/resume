import type { ORDERType, ResumeSchema, VisibilityFormType } from '@/lib/schema'
import type { TemplateRef } from '@/lib/resume-template/definition-schema'
import type { ExampleRef } from '@/lib/resume-template/source/types'

export type ResumeProfile = 'graduate' | 'experienced' | 'career-change'

export interface CreationTemplateSelection {
  template: TemplateRef
  example: ExampleRef
  name: string
}

export type CreationContent = ResumeSchema & {
  order?: ORDERType[]
  visibility?: VisibilityFormType
}

export interface ImportDraft {
  sourceText: string
  sourceName: string
  content: CreationContent | null
  contentSource?: 'import' | 'profile'
  selectedTemplate?: CreationTemplateSelection
  unassignedText: string
  warnings: string[]
  profile: ResumeProfile
  updatedAt: string
  creation?: {
    operationId: string
    mode: 'local' | 'cloud'
    displayName: string
    selection?: CreationTemplateSelection
    submitted?: boolean
  }
}

export interface ContentEvidence {
  id: string
  kind: 'example' | 'ai'
  section: ORDERType
  text: string
}

export interface PreparationRecord {
  sourceText?: string
  sourceName?: string
  unassignedText?: string
  profile?: ResumeProfile
  evidence: ContentEvidence[]
  resolutions: Record<string, { signature: string; reason: string }>
}
