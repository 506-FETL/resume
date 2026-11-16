import type { ShareStoreState } from '../types'

export let shareReadGeneration = 0

export function clearShareReadRequests() {
  shareReadGeneration += 1
  versionOptionRequests.clear()
  dialogShareRequests.clear()
}

export const versionOptionRequests = new Map<string, Promise<void>>()

export const dialogShareRequests = new Map<
  string,
  Promise<ShareStoreState['shares']>
>()
