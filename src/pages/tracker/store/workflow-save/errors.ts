import type { JobSubmission } from '../../submission-types'

export class SubmissionRefreshError extends Error {
  readonly submission: JobSubmission

  constructor(submission: JobSubmission, cause: unknown) {
    super('投递已保存，但职位进度读取失败，请重新读取，无需再次提交', {
      cause,
    })

    this.name = 'SubmissionRefreshError'
    this.submission = submission
  }
}
