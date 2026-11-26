import supabase from '../../../client'
import type {
  LatestHistoryVersion,
  ResumeHistoryVersionListRow,
  ResumeVersionSourceType,
} from '../types'

export const HISTORY_PAGE_SIZE = 10

export interface HistoryTimelineFilter {
  keyword: string
  source: ResumeVersionSourceType | 'all'
  milestoneOnly: boolean
  sort: 'newest' | 'oldest'
}

export async function listHistoryVersionPage(
  resumeId: string,
  filter: HistoryTimelineFilter,
  page: number,
) {
  const { data, error } = await supabase.rpc('list_history_version_page', {
    p_resume_id: resumeId,
    p_keyword: filter.keyword.trim(),
    p_source: filter.source,
    p_milestone_only: filter.milestoneOnly,
    p_oldest_first: filter.sort === 'oldest',
    p_page: page,
  })

  if (error) throw error

  return data as {
    total: number
    latest: LatestHistoryVersion | null
    items: ResumeHistoryVersionListRow[]
  }
}
