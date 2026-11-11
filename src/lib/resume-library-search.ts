import type { ResumeListItem } from '@/lib/schema'

export function normalizeResumeLibraryQuery(value: string) {
  return value.trim().toLowerCase()
}

export function matchesResumeLibraryQuery(
  item: Pick<ResumeListItem, 'display_name' | 'description'>,
  query: string,
) {
  return (
    (item.display_name ?? '').toLowerCase().includes(query) ||
    (item.description ?? '').toLowerCase().includes(query)
  )
}
