import {
  getOfflineResumeLibraryIndex,
  getOfflineResumeSummariesByIds,
} from '@/lib/offline-resume-manager'
import {
  getResumeLibraryOptionsPage,
  getResumeLibraryPage,
  RESUME_LIBRARY_PAGE_SIZE,
} from '@/lib/supabase/resume/library'
import { getCurrentUser } from '@/lib/supabase/user'
import { getErrorMessage } from '@/utils'
import type { ResumeItem } from '../../types'
import { compareResumes } from '../../utils'
import { readIndex } from './cache'
import { readParents } from './read-page'
import type {
  LibraryGet,
  LibraryRuntime,
  LibrarySet,
  ResumeLibrarySlice,
} from './types'

export async function loadAuxiliary(
  runtime: LibraryRuntime,
  set: LibrarySet,
  get: LibraryGet,
  kind: 'options' | 'pending',
  force = false,
) {
  const loaded =
    kind === 'options' ? runtime.optionsLoaded : runtime.pendingLoaded

  const loading =
    kind === 'options'
      ? get().libraryOptionsLoading
      : get().libraryPendingLoading

  if (!force && (loaded || loading)) return

  const request =
    kind === 'options' ? ++runtime.optionsRequest : ++runtime.pendingRequest

  const currentRevision = runtime.revision

  const current = () =>
    currentRevision === runtime.revision &&
    request ===
      (kind === 'options' ? runtime.optionsRequest : runtime.pendingRequest)

  set(
    kind === 'options'
      ? { libraryOptionsLoading: true, libraryOptionsError: null }
      : { libraryPendingLoading: true, libraryPendingError: null },
  )

  try {
    const user = await getCurrentUser()

    if (!current()) return

    const ownerId = user?.id ?? null
    const data = await readIndex(runtime, ownerId)
    const filter = kind === 'options' ? 'all' : 'pending'
    const expected = kind === 'options' ? data.cloud.all : data.cloud.pending
    const cloud: ResumeItem[] = []
    const local: ResumeItem[] = []

    const localIds = data.local[filter]

    await Promise.all([
      (async () => {
        while (ownerId && cloud.length < expected) {
          const batch =
            kind === 'options'
              ? await getResumeLibraryOptionsPage(ownerId, cloud.length)
              : await getResumeLibraryPage(ownerId, filter, cloud.length)

          if (!current()) return

          cloud.push(...batch)

          if (batch.length < RESUME_LIBRARY_PAGE_SIZE) break
        }
      })(),
      (async () => {
        for (
          let offset = 0;
          offset < localIds.length;
          offset += RESUME_LIBRARY_PAGE_SIZE
        ) {
          const batch = await getOfflineResumeSummariesByIds(
            localIds.slice(offset, offset + RESUME_LIBRARY_PAGE_SIZE),
          )

          if (!current()) return

          local.push(...batch)
        }
      })(),
    ])

    if (!current()) return

    const items = [...cloud, ...local].sort(compareResumes)

    const parents =
      kind === 'pending' ? await readParents(get, items, ownerId) : {}

    if (!current()) return

    set((state) => ({
      libraryParents: { ...state.libraryParents, ...parents },
    }))

    if (kind === 'options') {
      runtime.optionsLoaded = true
      set({ libraryOptions: items, offlineResumes: local })
    } else {
      runtime.pendingLoaded = true
      set({ libraryPendingItems: items })
    }
  } catch (error) {
    if (!current()) return

    const message = getErrorMessage(error)

    set(
      kind === 'options'
        ? { libraryOptionsError: message }
        : { libraryPendingError: message },
    )
  } finally {
    if (current())
      set(
        kind === 'options'
          ? { libraryOptionsLoading: false }
          : { libraryPendingLoading: false },
      )
  }
}

export function createAuxiliaryActions(
  runtime: LibraryRuntime,
  set: LibrarySet,
  get: LibraryGet,
): Pick<
  ResumeLibrarySlice,
  'loadLibraryOptions' | 'loadLibraryPendingItems' | 'loadLibraryOfflineOptions'
> {
  return {
    loadLibraryOptions: (force) =>
      loadAuxiliary(runtime, set, get, 'options', force),
    loadLibraryPendingItems: (force) =>
      loadAuxiliary(runtime, set, get, 'pending', force),
    loadLibraryOfflineOptions: async (force = false) => {
      if (!force && (runtime.offlineLoaded || get().libraryOfflineLoading))
        return

      const request = ++runtime.offlineRequest
      const currentRevision = runtime.revision

      const current = () =>
        request === runtime.offlineRequest &&
        currentRevision === runtime.revision

      set({ libraryOfflineLoading: true, libraryOfflineError: null })

      try {
        const localIndex =
          runtime.queries.get('')?.index?.local ??
          (await getOfflineResumeLibraryIndex())

        const items: ResumeItem[] = []

        for (
          let offset = 0;
          offset < localIndex.all.length;
          offset += RESUME_LIBRARY_PAGE_SIZE
        ) {
          const batch = await getOfflineResumeSummariesByIds(
            localIndex.all.slice(offset, offset + RESUME_LIBRARY_PAGE_SIZE),
          )

          if (!current()) return

          items.push(...batch)
        }

        if (!current()) return

        runtime.offlineLoaded = true
        set({ offlineResumes: items })
      } catch (error) {
        if (current()) set({ libraryOfflineError: getErrorMessage(error) })
      } finally {
        if (current()) set({ libraryOfflineLoading: false })
      }
    },
  }
}
