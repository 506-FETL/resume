import supabase from '../../client'
import { toRecord } from './records'

export const SHARE_PAGE_SIZE = 20

export type ShareManagementStatus =
  | 'all'
  | 'active'
  | 'inactive'
  | 'expired'
  | 'archived'

export interface ShareManagementScope {
  p_keyword: string
  p_resume_ids: string[]
}

export interface ShareManagementQuery extends ShareManagementScope {
  p_status: ShareManagementStatus
  p_page: number
}

export interface ShareManagementCounts {
  hasResumes: boolean
  overview: { total: number; active: number; views: number }
  counts: Record<ShareManagementStatus, number>
  nextExpiry: string | null
}

export interface ShareGroup {
  title: string | null
  count: number
}

export async function readShareManagementPage(query: ShareManagementQuery) {
  const { data, error } = await supabase.rpc(
    'get_share_management_cards',
    query,
  )

  if (error) throw error
  if (!Array.isArray(data)) throw new Error('分享列表返回格式异常')

  const groups: Record<string, ShareGroup> = {}

  const shares = data.map(
    ({ group_title, group_count, filtered_total, ...row }) => {
      if (
        !Number.isSafeInteger(group_count) ||
        !Number.isSafeInteger(filtered_total)
      )
        throw new Error('分享列表缺少分页信息')

      groups[row.resume_id] = { title: group_title, count: group_count }

      return toRecord(row)
    },
  )

  return { shares, groups, total: data[0]?.filtered_total ?? null }
}

export async function readShareManagementCounts(scope: ShareManagementScope) {
  const { data, error } = await supabase.rpc(
    'get_share_management_summary',
    scope,
  )

  if (error) throw error
  if (!data?.overview || !data.counts) throw new Error('分享统计返回格式异常')

  return data as ShareManagementCounts
}
