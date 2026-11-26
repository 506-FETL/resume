import useShareStore from './index'
import { clearManagementCache, preloadManagement } from './data/management'

export function prepareManagementVisit() {
  const state = useShareStore.getState()

  if (!state.managementOpen) preloadManagement(state)

  return () => {
    if (!useShareStore.getState().managementOpen) clearManagementCache()
  }
}
