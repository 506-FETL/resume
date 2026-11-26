import type { JobSubmission } from '../../../submission-types'

export interface SubmissionFormProps {
  opener?: HTMLElement | null
  jobId: string
  requestId: string
  correctingRecord?: JobSubmission
  onClose: () => void
}
