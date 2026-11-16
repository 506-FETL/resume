import type {
  ExperienceSourceReference,
  ExtractedExperienceFile,
} from '@/lib/experience-sources/types'

export type UploadTab = 'files' | 'paste'

export type UploadJob = {
  operationId: string
  sourceId?: string
  name: string
  file?: File
  text?: string
  extracted?: ExtractedExperienceFile
  status:
    | 'queued'
    | 'reading'
    | 'saving'
    | 'ready'
    | 'failed'
    | 'unknown'
    | 'cancelled'
  error?: string
  controller: AbortController
}

export interface ExperienceUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: (references: ExperienceSourceReference[]) => void
  initialTab?: UploadTab
  sourceId?: string
}
