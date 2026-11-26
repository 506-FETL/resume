import { getOfflineResumeSummariesByIds } from '@/lib/offline-resume-manager/queries'
import { getResumeLibraryParents } from '@/lib/supabase/resume/library'
import { getErrorMessage } from '@/utils'
import type { ResumeItem } from '../../types'
import type { LibraryGet, LibraryRuntime, LibrarySet } from './types'

export function rememberLibraryItems(
  set: LibrarySet,
  get: LibraryGet,
  items: ResumeItem[],
) {
  const known = get().libraryParents
  const updates = items.filter((item) => known[item.resume_id] !== item)

  if (!updates.length) return

  set((state) => {
    const parents = { ...state.libraryParents }
    const errors = { ...state.libraryParentErrors }

    for (const item of updates) {
      parents[item.resume_id] = item
      delete errors[item.resume_id]
    }

    return { libraryParents: parents, libraryParentErrors: errors }
  })
}

export async function loadLibraryParents(
  runtime: LibraryRuntime,
  set: LibrarySet,
  get: LibraryGet,
  parentIds: string[],
) {
  const state = get()
  const ownerId = state.libraryAccountId
  const revision = runtime.revision
  const requests = runtime.parentRequests

  const needed = [...new Set(parentIds)].filter(
    (id) => !(id in state.libraryParents),
  )

  const fresh = needed.filter((id) => !requests.has(id))
  const local = fresh.filter((id) => id.startsWith('local-'))
  const cloud = fresh.filter((id) => !id.startsWith('local-'))

  if (fresh.some((id) => state.libraryParentErrors[id])) {
    const errors = { ...state.libraryParentErrors }

    for (const id of fresh) delete errors[id]
    set({ libraryParentErrors: errors })
  }

  if (local.length) start(local, getOfflineResumeSummariesByIds(local))
  if (cloud.length)
    start(
      cloud,
      ownerId ? getResumeLibraryParents(ownerId, cloud) : Promise.resolve([]),
    )

  await Promise.all(needed.map((id) => requests.get(id)))

  function start(ids: string[], read: Promise<ResumeItem[]>) {
    const request = read
      .then((items) => {
        if (revision !== runtime.revision) return

        const found = new Map(items.map((item) => [item.resume_id, item]))

        set((current) => {
          const parents = { ...current.libraryParents }

          for (const id of ids) {
            if (!(id in parents)) parents[id] = found.get(id) ?? null
          }

          return { libraryParents: parents }
        })
      })
      .catch((error: unknown) => {
        if (revision !== runtime.revision) return

        set((current) => {
          const errors = { ...current.libraryParentErrors }

          for (const id of ids) {
            if (!(id in current.libraryParents))
              errors[id] = getErrorMessage(error)
          }

          return { libraryParentErrors: errors }
        })
      })
      .finally(() => {
        for (const id of ids) requests.delete(id)
      })

    for (const id of ids) requests.set(id, request)
  }
}
