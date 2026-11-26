import { TrackerProcessError } from '@/lib/supabase/resume/tracker-companies'
import { openTrackerTarget } from './open-target'

export function getTrackerConflictAction(
  error: unknown,
  beforeOpen?: () => void,
) {
  const conflict =
    error instanceof TrackerProcessError ? error.conflictJobId : null

  if (!conflict) return undefined

  return {
    label: '打开冲突岗位',
    onClick: () => {
      beforeOpen?.()
      openTrackerTarget(conflict)
    },
  }
}
