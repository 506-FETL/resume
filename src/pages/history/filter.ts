import type { ResumeHistoryVersionRecord, ResumeVersionSourceType } from '@/lib/supabase/resume/history'
import { getVersionTitle } from './utils'

export type VersionSortOrder = 'newest' | 'oldest'

export interface VersionFilterCriteria {
  /** 关键词：匹配版本名 / 描述 / 里程碑 / 标签 */
  keyword: string
  /** 来源：'all' 或某个 source_type */
  source: ResumeVersionSourceType | 'all'
  /** 仅看里程碑版本 */
  milestoneOnly: boolean
  sort: VersionSortOrder
}

export const DEFAULT_VERSION_FILTER: VersionFilterCriteria = {
  keyword: '',
  source: 'all',
  milestoneOnly: false,
  sort: 'newest',
}

/** 当前筛选是否处于「激活」状态（非默认），用于给筛选入口显示徽标。 */
export function isFilterActive(criteria: VersionFilterCriteria): boolean {
  return criteria.source !== 'all'
    || criteria.milestoneOnly
    || criteria.sort !== 'newest'
}

function matchesKeyword(version: ResumeHistoryVersionRecord, keyword: string): boolean {
  const q = keyword.trim().toLowerCase()
  if (!q)
    return true
  const haystack = [
    getVersionTitle(version),
    version.description ?? '',
    version.milestone_name ?? '',
    ...(version.tags ?? []),
  ].join('\n').toLowerCase()
  return haystack.includes(q)
}

/** 按条件过滤 + 排序，返回新数组（不改原数组）。 */
export function filterVersions(
  versions: ResumeHistoryVersionRecord[],
  criteria: VersionFilterCriteria,
): ResumeHistoryVersionRecord[] {
  const filtered = versions.filter((version) => {
    if (criteria.source !== 'all' && version.source_type !== criteria.source)
      return false
    if (criteria.milestoneOnly && !version.milestone_name?.trim())
      return false
    return matchesKeyword(version, criteria.keyword)
  })

  // version_no 单调递增，用它排序比 created_at 更稳（同秒创建也能定序）
  return filtered.sort((a, b) =>
    criteria.sort === 'newest'
      ? b.version_no - a.version_no
      : a.version_no - b.version_no,
  )
}
