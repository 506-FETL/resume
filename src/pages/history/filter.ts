import type { ResumeHistoryVersionListItem } from '@/lib/supabase/resume/history'
import type { HistoryTimelineFilter as VersionFilterCriteria } from '@/lib/supabase/resume/history/queries/timeline'
import { getVersionTitle } from './utils'

export type { HistoryTimelineFilter as VersionFilterCriteria } from '@/lib/supabase/resume/history/queries/timeline'

export type VersionSortOrder = VersionFilterCriteria['sort']

export const DEFAULT_VERSION_FILTER: VersionFilterCriteria = {
  keyword: '',
  source: 'all',
  milestoneOnly: false,
  sort: 'newest',
}

/** 当前筛选是否处于「激活」状态（非默认），用于给筛选入口显示徽标。 */
export function isFilterActive(criteria: VersionFilterCriteria): boolean {
  return (
    criteria.source !== 'all' ||
    criteria.milestoneOnly ||
    criteria.sort !== 'newest'
  )
}

function matchesKeyword(
  version: ResumeHistoryVersionListItem,
  keyword: string,
): boolean {
  const q = keyword.trim().toLowerCase()

  if (!q) return true

  const haystack = [
    getVersionTitle(version),
    version.description ?? '',
    version.milestone_name ?? '',
    ...(version.tags ?? []),
  ]
    .join('\n')
    .toLowerCase()

  return haystack.includes(q)
}

export function matchesVersionFilter(
  version: ResumeHistoryVersionListItem,
  criteria: VersionFilterCriteria,
) {
  if (criteria.source !== 'all' && version.source_type !== criteria.source)
    return false
  if (criteria.milestoneOnly && !version.milestone_name?.trim()) return false

  return matchesKeyword(version, criteria.keyword)
}
