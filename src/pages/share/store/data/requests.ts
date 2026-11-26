import type { ShareStoreState } from '../types'
import { clearShareOptionPages } from './option-pages'

export let shareReadGeneration = 0

export function clearShareReadRequests() {
  shareReadGeneration += 1
  clearShareOptionPages()
  dialogShareRequests.clear()
}

export const dialogShareRequests = new Map<
  string,
  Promise<ShareStoreState['shares']>
>()
