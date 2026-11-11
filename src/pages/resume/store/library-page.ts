import type { ResumeItem } from '../types'
import type { ResumeFilterMode } from './resume-ui'
import type {
  CachedPage,
  LibraryIndex,
  LibraryQueryCache,
  PageCursor,
} from './library-cache'
import { getOfflineResumeSummariesByIds } from '@/lib/offline-resume-manager'
import {
  getResumeLibraryPage,
  RESUME_LIBRARY_PAGE_SIZE,
} from '@/lib/supabase/resume/library'
import { compareResumes } from '../utils'

export async function buildLibraryPage({
  cache,
  data,
  ownerId,
  filter,
  query,
  page,
  firstCloudBatch,
  current,
}: {
  cache: LibraryQueryCache
  data: LibraryIndex
  ownerId: string | null
  filter: ResumeFilterMode
  query: string
  page: number
  firstCloudBatch: ResumeItem[] | null
  current: () => boolean
}) {
  const pages = cache.pages.get(filter) ?? new Map<number, CachedPage>()
  const localIds = data.local[filter]

  const cloudTotal =
    filter === 'roots'
      ? data.cloud.roots
      : filter === 'variants'
        ? data.cloud.readyVariants
        : data.cloud.all

  cache.pages.set(filter, pages)

  for (let target = 1; target <= page; target += 1) {
    if (pages.has(target)) continue

    const previous = pages.get(target - 1)?.next

    const cursor: PageCursor = previous
      ? {
          ...previous,
          buffer: [...previous.buffer],
          localBuffer: [...previous.localBuffer],
        }
      : { cloudOffset: 0, localOffset: 0, buffer: [], localBuffer: [] }

    const remaining = RESUME_LIBRARY_PAGE_SIZE - cursor.buffer.length
    const localRemaining = RESUME_LIBRARY_PAGE_SIZE - cursor.localBuffer.length

    const ids =
      localRemaining > 0
        ? localIds.slice(
            cursor.localOffset,
            cursor.localOffset + localRemaining,
          )
        : []

    const [cloudBatch, localBatch] = await Promise.all([
      target === 1 && firstCloudBatch
        ? firstCloudBatch
        : ownerId && remaining > 0 && cursor.cloudOffset < cloudTotal
          ? getResumeLibraryPage(
              ownerId,
              filter,
              cursor.cloudOffset,
              remaining,
              query,
            )
          : [],
      ids.length ? getOfflineResumeSummariesByIds(ids) : [],
    ])

    if (!current()) return

    cursor.buffer.push(...cloudBatch)
    cursor.cloudOffset += cloudBatch.length
    cursor.localBuffer.push(...localBatch)
    cursor.localOffset += ids.length

    const items: ResumeItem[] = []

    while (items.length < RESUME_LIBRARY_PAGE_SIZE) {
      const cloud = cursor.buffer[0]
      const offline = cursor.localBuffer[0]

      if (!cloud && !offline) break
      if (offline && (!cloud || compareResumes(offline, cloud) <= 0)) {
        items.push(cursor.localBuffer.shift()!)
      } else {
        items.push(cursor.buffer.shift()!)
      }
    }

    pages.set(target, { items, next: cursor, ready: false })
  }

  return pages.get(page)!
}
