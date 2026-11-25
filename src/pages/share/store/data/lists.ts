import type { ShareStoreState } from '../types'
import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { deriveShareStatus } from '../../utils'

export function addPending(ids: string[], shareId: string) {
  return ids.includes(shareId) ? ids : [...ids, shareId]
}

export function removePending(ids: string[], shareId: string) {
  return ids.filter((id) => id !== shareId)
}

export function matchesManagementPage(
  state: ShareStoreState,
  record: ResumeShareRecord,
) {
  if (
    state.resumeFilters.length &&
    !state.resumeFilters.includes(record.resume_id)
  )
    return false
  if (
    state.statusFilter !== 'all' &&
    deriveShareStatus(record) !== state.statusFilter
  )
    return false
  if (!state.pageKeyword) return true

  return [record.label, record.display_name, record.token].some((field) =>
    field?.toLocaleLowerCase().includes(state.pageKeyword),
  )
}

export function mapShareLists(
  state: ShareStoreState,
  updater: (
    share: ShareStoreState['pageShares'][number],
  ) => ShareStoreState['pageShares'][number],
) {
  return {
    pageShares: state.pageShares
      .map(updater)
      .filter((record) => matchesManagementPage(state, record)),
    shares: state.shares.map(updater),
  }
}
