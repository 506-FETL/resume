import type { ResumeTemplateBinding } from '@/lib/schema'

export interface TemplateSwitchUndoRecord {
  operationId: string
  sessionKey: string
  previous: ResumeTemplateBinding
  applied: ResumeTemplateBinding
}

export interface TemplateSwitchState {
  sessionKey: string | null
  open: boolean
  selectedBinding: ResumeTemplateBinding | null
  conflictBinding: ResumeTemplateBinding | null
  undoRecord: TemplateSwitchUndoRecord | null
  openDialog: () => boolean
  closeDialog: () => void
  selectTemplate: (binding: ResumeTemplateBinding) => void
  applyTemplate: (input: {
    binding: ResumeTemplateBinding
    contentKey: string
  }) => boolean
  undoTemplate: (operationId?: string) => boolean
  synchronizeSession: () => void
}
