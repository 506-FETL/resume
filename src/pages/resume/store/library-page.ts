import type { ResumeItem } from '../types'
import type { ResumeFilterMode } from './resume-ui'
import type { CachedPage, LibraryQueryCache, PageCursor } from './library-cache'
import { getOfflineResumeSummariesByIds } from '@/lib/offline-resume-manager/queries'
import {
  getResumeLibraryPage,
  RESUME_LIBRARY_PAGE_SIZE,
} from '@/lib/supabase/resume/library'
import { compareResumes } from '../utils'

export async function buildLibraryPage({
  cache,
  localIds,
  limited,
  cloudTotal,
  ownerId,
  filter,
  query,
  page,
  current,
}: {
  cache: LibraryQueryCache
  localIds: Promise<string[]>
  limited: boolean
  cloudTotal: number | undefined
  ownerId: string | null
  filter: ResumeFilterMode
  query: string
  page: number
  current: () => boolean
}) {
  const pages = cache.pages.get(filter) ?? new Map<number, CachedPage>()

  cache.pages.set(filter, pages)

  for (let target = 1; target <= page; target += 1) {
    const previousPage = pages.get(target - 1)

    if (previousPage && !previousPage.hasNext)
      return { items: previousPage.items, page: target - 1, hasNext: false }
    if (pages.has(target)) continue

    const previous = previousPage?.next

    const cursor: PageCursor = previous
      ? {
          ...previous,
          buffer: [...previous.buffer],
          localBuffer: [...previous.localBuffer],
        }
      : { cloudOffset: 0, localOffset: 0, buffer: [], localBuffer: [] }

    const remaining = RESUME_LIBRARY_PAGE_SIZE - cursor.buffer.length
    const localRemaining = RESUME_LIBRARY_PAGE_SIZE - cursor.localBuffer.length

    const [cloudBatch, local] = await Promise.all([
      ownerId &&
      !cursor.cloudDone &&
      remaining > 0 &&
      (cloudTotal === undefined || cursor.cloudOffset < cloudTotal)
        ? getResumeLibraryPage(
            ownerId,
            filter,
            cursor.cloudOffset,
            remaining,
            query,
          )
        : [],
      localIds.then(async (ordered) => {
        const ids = ordered.slice(
          cursor.localOffset,
          cursor.localOffset + localRemaining,
        )

        const items = ids.length
          ? await getOfflineResumeSummariesByIds(ids)
          : []

        return {
          items,
          count: ids.length,
          more:
            cursor.localOffset + ids.length < ordered.length ||
            (limited && ordered.length === RESUME_LIBRARY_PAGE_SIZE),
        }
      }),
    ])

    if (!current()) return

    cursor.buffer.push(...cloudBatch)
    cursor.cloudOffset += cloudBatch.length

    if (remaining > 0 && cloudBatch.length < remaining) cursor.cloudDone = true

    cursor.localBuffer.push(...local.items)
    cursor.localOffset += local.count

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

    if (!items.length && previousPage) {
      previousPage.hasNext = false

      return { items: previousPage.items, page: target - 1, hasNext: false }
    }

    const hasNext = Boolean(
      cursor.buffer.length ||
      cursor.localBuffer.length ||
      local.more ||
      (ownerId &&
        !cursor.cloudDone &&
        (cloudTotal === undefined || cursor.cloudOffset < cloudTotal)),
    )

    pages.set(target, { items, next: cursor, hasNext })
  }

  const loaded = pages.get(page)!

  return { items: loaded.items, page, hasNext: loaded.hasNext }
}
