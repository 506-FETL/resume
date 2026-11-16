import type { PreparationRecord } from '@/lib/resume-preparation/types'
import { checkIssueSignature, collectCheckFields } from '../targets'
import type {
  CheckSnapshot,
  CheckTarget,
  ResumeCheckIssue,
  ResumeCheckResult,
} from '../types'
import { checkContactFields } from './contact'
import { checkExperienceDates } from './experience-dates'
import type { NewIssue } from './issue-types'
import { checkSourceEvidence } from './source-evidence'
import { checkTerminology } from './terminology'

export function checkResume(
  snapshot: CheckSnapshot,
  record: PreparationRecord,
  now = new Date(),
): ResumeCheckResult {
  const issues: ResumeCheckIssue[] = []
  const aiEvidence: CheckTarget[] = []
  const fields = collectCheckFields(snapshot)
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())

  const add = (issue: NewIssue) => {
    const signature = checkIssueSignature(snapshot, issue.targets)

    issues.push({
      ...issue,
      source: 'rule',
      signature,
      resolved: record.resolutions[issue.id]?.signature === signature,
    })
  }

  checkContactFields(snapshot, add)
  checkExperienceDates(snapshot, fields, today, add)
  checkTerminology(snapshot, fields, add)
  checkSourceEvidence(snapshot, record, fields, aiEvidence, add)

  return { issues, aiEvidence }
}
