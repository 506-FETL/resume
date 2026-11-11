import type { ResumeItem } from './types'
import type { ResumeFilterMode } from './store/resume-ui'
import type { ResumeLibraryCounts } from './store/library-cache'
import { RESUME_LIBRARY_PAGE_SIZE } from '@/lib/supabase/resume/library'

export function getFilterTotal(
  counts: ResumeLibraryCounts,
  filter: ResumeFilterMode,
) {
  return filter === 'roots'
    ? counts.roots
    : filter === 'variants'
      ? counts.readyVariants
      : counts.all
}

export function getLibraryPageNumber(requestedPage: number, total: number) {
  return Math.max(
    1,
    Math.min(requestedPage, Math.ceil(total / RESUME_LIBRARY_PAGE_SIZE)),
  )
}

export function compareResumes(a: ResumeItem, b: ResumeItem) {
  const time =
    (b.updated_at ? new Date(b.updated_at).getTime() : -Infinity) -
    (a.updated_at ? new Date(a.updated_at).getTime() : -Infinity)

  return (
    time || (a.resume_id < b.resume_id ? 1 : a.resume_id > b.resume_id ? -1 : 0)
  )
}
