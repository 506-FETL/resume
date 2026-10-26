import type { PublishedTemplateManifest } from '@/lib/resume-template/share'
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
}

export type JobSubmissionMaterial = {
  jdText: string | null
  jdUpdatedAt: string | null
} & (
  | { kind: 'pending' }
  | {
      kind: 'platform'
      snapshot: PersistedResumeSnapshot
      templateManifest: PublishedTemplateManifest
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
