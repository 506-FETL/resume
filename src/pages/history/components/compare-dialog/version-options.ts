import type { VersionOption } from './use-comparison'
import supabase from '@/lib/supabase/client'
import { createOptionWindow } from '../../store/option-window'
import useHistoryStore from '../../store'

export function versionOptions(resumeId: string, total: number | null) {
  const pages = createOptionWindow<VersionOption>(
    async (owner, offset, limit) => {
      const { data, error } = await supabase
        .from('resume_config_versions')
        .select('id,version_no,created_at')
        .eq('user_id', owner)
        .eq('resume_id', resumeId)
        .eq('status', 'frozen')
        .order('version_no', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error

      return data
    },
  )

  const { versionPage, versionFilter, timelineVersions, versionsLoaded } =
    useHistoryStore.getState()

  if (
    versionsLoaded &&
    total !== null &&
    versionPage === 0 &&
    !versionFilter.keyword.trim() &&
    !versionFilter.milestoneOnly &&
    versionFilter.source === 'all' &&
    versionFilter.sort === 'newest'
  ) {
    pages.setState({
      items: timelineVersions,
      ready: true,
      hasMore: timelineVersions.length < total,
    })
  }

  return pages
}
