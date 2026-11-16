import type { JobSubmission } from '../../../submission-types'

export interface SubmissionFormProps {
  jobId: string
  requestId: string
  correctingRecord?: JobSubmission
  onClose: () => void
}
