import { getOfflineResumeSummariesByIds } from '@/lib/offline-resume-manager/queries'
import {
  getResumeLibraryOptionsPage,
  getResumeLibraryPage,
  RESUME_LIBRARY_PAGE_SIZE,
} from '@/lib/supabase/resume/library'
import { getCurrentUser } from '@/lib/supabase/user'
import useUserStore from '@/store/user'
import { getErrorMessage } from '@/utils'
import type { ResumeItem } from '../../types'
import { compareResumes } from '../../utils'
import {
  readCompleteLibraryItems,
  type LibraryQueryCache,
} from '../library-cache'
import { getQueryCache, readLocalIndex } from './cache'
import { rememberLibraryItems } from './parents'
import type {
  LibraryGet,
  LibraryRuntime,
  LibrarySet,
  ResumeLibrarySlice,
} from './types'

async function loadAuxiliary(
  runtime: LibraryRuntime,
  set: LibrarySet,
  get: LibraryGet,
  kind: 'options' | 'pending',
  force = false,
) {
  const loaded =
    kind === 'options' ? runtime.optionsLoaded : runtime.pendingLoaded

  if (!force && loaded) return

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
    const identity = useUserStore.getState()

    const ownerId =
      identity.authStatus === 'unknown'
        ? ((await getCurrentUser())?.id ?? null)
        : (identity.currentUser?.id ?? null)

    if (!current()) return

    const cache = getQueryCache(runtime, '')
    const complete = readCompleteLibraryItems(cache)
    const filter = kind === 'options' ? 'all' : 'pending'

    const items = complete
      ? kind === 'options'
        ? complete
        : complete.filter(
            (item) =>
              item.derived_status === 'generating' ||
              item.derived_status === 'failed',
          )
      : await readAuxiliaryItems(cache, ownerId, filter, current)

    if (!current()) return

    if (kind === 'options') {
      runtime.optionsLoaded = true
      set({ libraryOptions: items })
    } else {
      runtime.pendingLoaded = true

      rememberLibraryItems(set, get, items)
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

async function readAuxiliaryItems(
  cache: LibraryQueryCache,
  ownerId: string | null,
  filter: 'all' | 'pending',
  current: () => boolean,
) {
  const [cloud, local] = await Promise.all([
    readCloudItems(),
    readLocalItems(cache, filter, current),
  ])

  return [...cloud, ...local].sort(compareResumes)

  async function readCloudItems() {
    const items: ResumeItem[] = []

    // 数量尚未就绪时，以不足一批的返回确认该来源已读完。
    while (
      ownerId &&
      current() &&
      items.length < (cache.index?.cloud[filter] ?? Infinity)
    ) {
      const batch =
        filter === 'all'
          ? await getResumeLibraryOptionsPage(ownerId, items.length)
          : await getResumeLibraryPage(ownerId, filter, items.length)

      items.push(...batch)

      if (batch.length < RESUME_LIBRARY_PAGE_SIZE) break
    }

    return items
  }
}

async function readLocalItems(
  cache: LibraryQueryCache,
  filter: 'all' | 'pending',
  current: () => boolean,
) {
  const local = await readLocalIndex(cache)
  const ids = local[filter]
  const items: ResumeItem[] = []

  for (
    let offset = 0;
    offset < ids.length && current();
    offset += RESUME_LIBRARY_PAGE_SIZE
  ) {
    const batch = await getOfflineResumeSummariesByIds(
      ids.slice(offset, offset + RESUME_LIBRARY_PAGE_SIZE),
    )

    items.push(...batch)
  }

  return items
}

export function createAuxiliaryActions(
  runtime: LibraryRuntime,
  set: LibrarySet,
  get: LibraryGet,
): Pick<
  ResumeLibrarySlice,
  'loadLibraryOptions' | 'loadLibraryPendingItems' | 'loadLibraryOfflineOptions'
> {
  const requests = new Map<
    string,
    { revision: number; promise: Promise<void> }
  >()

  function shareRead(
    kind: string,
    force: boolean | undefined,
    load: () => Promise<void>,
  ) {
    const existing = requests.get(kind)

    if (!force && existing?.revision === runtime.revision)
      return existing.promise

    const promise = load().finally(() => {
      if (requests.get(kind)?.promise === promise) requests.delete(kind)
    })

    requests.set(kind, { revision: runtime.revision, promise })

    return promise
  }

  return {
    loadLibraryOptions: (force) =>
      shareRead('options', force, () =>
        loadAuxiliary(runtime, set, get, 'options', force),
      ),
    loadLibraryPendingItems: (force) =>
      shareRead('pending', force, () =>
        loadAuxiliary(runtime, set, get, 'pending', force),
      ),
    loadLibraryOfflineOptions: (force) =>
      shareRead('offline', force, async () => {
        if (!force && runtime.offlineLoaded) return

        const request = ++runtime.offlineRequest
        const currentRevision = runtime.revision

        const current = () =>
          request === runtime.offlineRequest &&
          currentRevision === runtime.revision

        set({ libraryOfflineLoading: true, libraryOfflineError: null })

        try {
          const cache = getQueryCache(runtime, '')
          const complete = readCompleteLibraryItems(cache)

          const items = complete
            ? complete.filter((item) => item.isOffline)
            : await readLocalItems(cache, 'all', current)

          if (!current()) return

          runtime.offlineLoaded = true
          set({ offlineResumes: items })
        } catch (error) {
          if (current()) set({ libraryOfflineError: getErrorMessage(error) })
        } finally {
          if (current()) set({ libraryOfflineLoading: false })
        }
      }),
  }
}
