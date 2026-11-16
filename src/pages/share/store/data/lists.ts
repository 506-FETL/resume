import type { ShareStoreState } from '../types'

export function addPending(ids: string[], shareId: string) {
  return ids.includes(shareId) ? ids : [...ids, shareId]
}

export function removePending(ids: string[], shareId: string) {
  return ids.filter((id) => id !== shareId)
}

export function mapShareLists(
  state: ShareStoreState,
  updater: (
    share: ShareStoreState['allShares'][number],
  ) => ShareStoreState['allShares'][number],
) {
  return {
    allShares: state.allShares.map(updater),
    shares: state.shares.map(updater),
  }
}
