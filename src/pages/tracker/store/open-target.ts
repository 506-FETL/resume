import { toast } from 'sonner'
import useTrackerStore from './state'
import {
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '../lib/account-scope'
import { getTrackerErrorMessage } from '../utils/errors'

export async function openTrackerTarget(id: string) {
  const scope = getTrackerAccountScope()

  try {
    const state = useTrackerStore.getState()

    if (!state.jobs.some((job) => job.id === id))
      await state.ensureJobLoaded(id)
    if (!isTrackerAccountScopeCurrent(scope)) return

    const latest = useTrackerStore.getState()
    const target = latest.jobs.find((job) => job.id === id)

    if (target) latest.openJobDrawer(target)
  } catch (error) {
    if (isTrackerAccountScopeCurrent(scope))
      toast.error('打开岗位失败', {
        description: getTrackerErrorMessage(error),
      })
  }
}
