import type { ResumeCheckIssue } from '../types'

export type NewIssue = Omit<
  ResumeCheckIssue,
  'signature' | 'resolved' | 'source'
>
