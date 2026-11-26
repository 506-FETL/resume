import { createOptionPages } from '@/pages/share/store/data/option-pages'
import {
  listShareResumeOptions,
  listShareVersionOptions,
  SHARE_OPTION_PAGE_SIZE,
} from '@/lib/supabase/resume/share/option-pages'
import { subscribeResumeReadChanges } from '@/lib/resume-read-events'
import supabase from '@/lib/supabase/client'
import {
  getTrackerAccountScope,
  onTrackerVisitEnd,
  subscribeTrackerAccountScope,
} from './account-scope'

export interface TrackerOption {
  value: string
  label: string
}

export const trackerResumePages = createOptionPages<TrackerOption>()

export const trackerVersionPages = createOptionPages<TrackerOption>()

export function clearTrackerOptionPages() {
  trackerResumePages.store.setState(new Map(), true)
  trackerVersionPages.store.setState(new Map(), true)
}

onTrackerVisitEnd(clearTrackerOptionPages)
subscribeTrackerAccountScope(clearTrackerOptionPages)
subscribeResumeReadChanges(clearTrackerOptionPages)

export async function readTrackerResumePage(
  _target: string,
  keyword: string,
  offset: number,
) {
  if (keyword) {
    const rows = await listShareResumeOptions(keyword, offset)

    return rows.map((row) => ({
      value: row.resume_id,
      label: row.display_name,
    }))
  }

  const { data, error } = await supabase
    .from('resume_config')
    .select('resume_id,display_name')
    .eq('user_id', getTrackerAccountScope().userId!)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + SHARE_OPTION_PAGE_SIZE)

  if (error) throw error

  return data.map((row) => ({
    value: row.resume_id,
    label: row.display_name || '未命名简历',
  }))
}

export async function readTrackerVersionPage(
  resumeId: string,
  keyword: string,
  offset: number,
) {
  const rows = await listShareVersionOptions(resumeId, keyword, offset)

  return rows.map((row) => ({
    value: String(row.id),
    label: row.version_name
      ? `V${row.version_no} · ${row.version_name}`
      : `V${row.version_no}`,
  }))
}
