import type { ResumeHistoryVersionListItem } from '@/lib/supabase/resume/history/types'
import {
  HISTORY_PAGE_SIZE,
  listHistoryVersionPage,
} from '@/lib/supabase/resume/history/queries/timeline'
import {
  DEFAULT_VERSION_FILTER,
  type VersionFilterCriteria,
} from '../../filter'
import { normalizeHistoryVersionListItem } from '../../utils/versions'
import type { Get, HistoryRuntime, Set, TimelinePage } from './types'

export const initialTimeline = {
  versions: [],
  timelineVersions: [],
  latestVersion: null,
  versionSummaryReady: false,
  versionTotal: null,
  matchingVersions: null,
  versionFilter: DEFAULT_VERSION_FILTER,
  versionPage: 0,
  versionsLoaded: false,
  versionsLoading: false,
  versionsError: null,
}

export function mergeVersions(
  known: ResumeHistoryVersionListItem[],
  received: ResumeHistoryVersionListItem[],
) {
  const ids = new Set(received.map((version) => version.id))

  return [...received, ...known.filter((version) => !ids.has(version.id))]
}

export function pageKey(filter: VersionFilterCriteria, page: number) {
  return JSON.stringify([
    filter.keyword.trim().toLowerCase(),
    filter.source,
    filter.milestoneOnly,
    filter.sort,
    page,
  ])
}

export function visiblePage(result: TimelinePage) {
  return {
    timelineVersions: result.items,
    matchingVersions: result.total,
    versionsLoaded: true,
    versionsLoading: false,
    versionsError: null,
  }
}

export async function showVersionPage(
  runtime: HistoryRuntime,
  set: Set,
  get: Get,
  filter: VersionFilterCriteria,
  page: number,
) {
  const { resumeId, versionFilter, versionPage } = get()

  if (!resumeId) return

  const key = pageKey(filter, page)
  const samePage = key === pageKey(versionFilter, versionPage)
  const cached = runtime.pages.get(key)
  const summaryReady = get().versionSummaryReady

  set({
    versionFilter: filter,
    versionPage: page,
    ...(cached
      ? {
          ...visiblePage(cached),
          versionsLoading: !summaryReady,
          versions: mergeVersions(get().versions, cached.items),
        }
      : {
          ...(!samePage && {
            versionsLoaded: false,
            timelineVersions: [],
            ...(pageKey(filter, 0) !== pageKey(versionFilter, 0) && {
              matchingVersions: null,
            }),
          }),
          versionsLoading: true,
          versionsError: null,
        }),
  })

  if (cached && summaryReady) return

  const isVisible = () =>
    key === pageKey(get().versionFilter, get().versionPage)

  let request = runtime.pageRequests.get(key)

  if (!request) {
    request = listHistoryVersionPage(resumeId, filter, page).then(
      ({ items, total, latest }) => ({
        items: items.map(normalizeHistoryVersionListItem),
        total,
        filter,
        page,
        latest,
      }),
    )

    runtime.pageRequests.set(key, request)
  }

  try {
    const result = await request

    if (runtime.pageRequests.get(key) !== request) return

    const lastPage = Math.max(
      0,
      Math.ceil(result.total / HISTORY_PAGE_SIZE) - 1,
    )

    if (!isVisible()) {
      if (page <= lastPage) runtime.pages.set(key, result)

      return
    }

    const unfiltered =
      !filter.keyword.trim() && filter.source === 'all' && !filter.milestoneOnly

    if (
      unfiltered &&
      get().versionTotal !== null &&
      get().versionTotal !== result.total
    )
      runtime.pages.clear()

    const known = runtime.replaceKnownVersions ? [] : get().versions

    runtime.replaceKnownVersions = false

    set({
      versions: mergeVersions(known, result.items),
      ...(unfiltered && { versionTotal: result.total }),
      latestVersion: result.latest,
      versionSummaryReady: true,
    })

    if (page > lastPage) {
      if (isVisible())
        await showVersionPage(runtime, set, get, filter, lastPage)

      return
    }

    runtime.pages.set(key, result)

    if (isVisible()) set(visiblePage(result))
  } catch (error) {
    if (runtime.pageRequests.get(key) === request && isVisible())
      set({
        versionsLoading: false,
        versionsError:
          error instanceof Error ? error.message : '版本记录加载失败',
      })
  } finally {
    if (runtime.pageRequests.get(key) === request)
      runtime.pageRequests.delete(key)
  }
}
