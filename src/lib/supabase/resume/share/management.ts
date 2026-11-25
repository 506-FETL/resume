import supabase from '../../client'
import { SHARE_SELECT, toRecord } from './records'

export const SHARE_PAGE_SIZE = 20

export type ShareManagementStatus =
  | 'all'
  | 'active'
  | 'inactive'
  | 'expired'
  | 'archived'

export interface ShareManagementQuery {
  p_keyword: string
  p_resume_ids: string[]
  p_status: ShareManagementStatus
  p_page: number
}

export interface ShareManagementCounts {
  overview: { total: number; active: number; views: number }
  counts: Record<ShareManagementStatus, number>
  groups: Record<string, number>
  nextExpiry: string | null
}

export async function readShareManagementPage(query: ShareManagementQuery) {
  const { data, error } = await supabase
    .rpc('get_share_management_page', query)
    .select(SHARE_SELECT)

  if (error) throw error

  if (!Array.isArray(data)) throw new Error('分享列表返回格式异常')

  return data.map(toRecord)
}

export async function readShareManagementCounts(query: ShareManagementQuery) {
  const { data, error } = await supabase.rpc(
    'get_share_management_counts',
    query,
  )

  if (error) throw error

  if (!data?.overview || !data.counts || !data.groups)
    throw new Error('分享统计返回格式异常')

  return data as ShareManagementCounts
}
