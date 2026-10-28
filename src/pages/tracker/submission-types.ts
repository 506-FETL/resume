import type { TemplateDefinition } from '@/lib/resume-template/definition-schema'
import type { PersistedResumeSnapshot } from '@/lib/schema'

export type SubmissionMaterialKind = 'pending' | 'platform' | 'file'

export interface SubmissionMaterialInput {
  materialKind: SubmissionMaterialKind
  resumeId?: string
  versionId?: number
  file?: File
}

export interface SubmissionInput extends SubmissionMaterialInput {
  id: string
  jobId: string
  submittedOn: string | null
  channel: string | null
  note: string | null
}

export interface JobSubmission {
  id: string
  user_id: string
  job_id: string
  submitted_on: string | null
  channel: string | null
  note: string | null
  created_at: string
  supplemented_at: string | null
  jd_updated_at: string | null
  material_kind: SubmissionMaterialKind
  resume_id: string | null
  version_id: number | null
  file_name: string | null
  file_mime: string | null
  file_size: number | null
  is_primary: boolean
}

export type JobSubmissionState =
  | { kind: 'none' }
  | { kind: 'ready'; primary: JobSubmission; legacy: JobSubmission[] }
  | { kind: 'needs-resolution'; legacy: JobSubmission[] }

export interface SubmissionRevision {
  id: string
  submission_id: string
  created_at: string
  reason: string
}

export type JobSubmissionMaterial = {
  submittedOn: string | null
  channel: string | null
  note: string | null
  jdText: string | null
  jdUpdatedAt: string | null
} & (
  | { kind: 'pending' }
  | {
      kind: 'platform'
      snapshot: PersistedResumeSnapshot
      definition: TemplateDefinition
      projectionReferenceDate: string
    }
  | {
      kind: 'file'
      file: Blob
      fileName: string
      fileMime: string
      fileSize: number
    }
)
