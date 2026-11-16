import { TrackerProcessError } from '@/lib/supabase/resume/tracker-companies'
import useTrackerStore from './state'

export function getTrackerConflictAction(
  error: unknown,
  beforeOpen?: () => void,
) {
  const conflict =
    error instanceof TrackerProcessError
      ? useTrackerStore
          .getState()
          .jobs.find((job) => job.id === error.conflictJobId)
      : null

  if (!conflict) return undefined

  return {
    label: '打开冲突岗位',
    onClick: () => {
      beforeOpen?.()
      useTrackerStore.getState().openJobDrawer(conflict)
    },
  }
}
