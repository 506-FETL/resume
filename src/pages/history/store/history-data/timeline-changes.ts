import type {
  LatestHistoryVersion,
  ResumeHistoryVersionListItem as Version,
} from '@/lib/supabase/resume/history/types'
import { HISTORY_PAGE_SIZE } from '@/lib/supabase/resume/history/queries/timeline'
import { matchesVersionFilter } from '../../filter'
import type { Get, HistoryRuntime, Set, TimelinePage } from './types'
import { mergeVersions, pageKey, visiblePage } from './timeline'

type Change = {
  before?: Version
  after?: Version
  latest?: LatestHistoryVersion
}

function patchPage(page: TimelinePage, { before, after }: Change) {
  const wasIncluded = Boolean(
    before && matchesVersionFilter(before, page.filter),
  )

  const isIncluded = Boolean(after && matchesVersionFilter(after, page.filter))

  if (wasIncluded === isIncluded) {
    return {
      ...page,
      items: isIncluded
        ? page.items.map((item) => (item.id === after!.id ? after! : item))
        : page.items,
    }
  }

  const total = page.total + (isIncluded ? 1 : -1)
  const direction = page.filter.sort === 'newest' ? -1 : 1
  const changed = isIncluded ? after! : before!
  const first = page.items[0]
  const last = page.items.at(-1)
  const start = page.page * HISTORY_PAGE_SIZE

  // 页首之前新增或删除一项会改变本页边界，需要重新取本页。
  if (
    page.page !== 0 &&
    first &&
    direction * (changed.version_no - first.version_no) < 0
  )
    return null

  if (isIncluded) {
    const items = [...page.items, changed]
      .sort((a, b) => direction * (a.version_no - b.version_no))
      .slice(0, HISTORY_PAGE_SIZE)

    return { ...page, items, total }
  }

  const items = page.items.filter((item) => item.id !== changed.id)

  if (start >= total && page.page !== 0) return null
  if (last && items.length < Math.min(HISTORY_PAGE_SIZE, total - start))
    return null

  return { ...page, items, total }
}

export function reconcileVersion(
  runtime: HistoryRuntime,
  set: Set,
  get: Get,
  change: Change,
) {
  const { before, after } = change
  const state = get()
  const visibleKey = pageKey(state.versionFilter, state.versionPage)
  const countChange = Number(Boolean(after)) - Number(Boolean(before))
  let latest = state.latestVersion

  runtime.pageRequests.clear()

  for (const [key, page] of runtime.pages) {
    const next = patchPage(page, change)

    if (next) runtime.pages.set(key, next)
    else runtime.pages.delete(key)
  }

  if (
    change.latest &&
    (!latest || change.latest.version_no >= latest.version_no)
  )
    latest = change.latest
  if (!after && before?.id === latest?.id) latest = null

  const visible = runtime.pages.get(visibleKey)

  const total =
    state.versionTotal === null ? null : state.versionTotal + countChange

  const deleting = before && !after

  const remaining = deleting
    ? state.versions.filter((item) => item.id !== before.id)
    : state.versions

  set({
    versions: after ? mergeVersions(remaining, [after]) : remaining,
    latestVersion: latest,
    versionSummaryReady:
      state.versionSummaryReady && (!total || Boolean(latest)),
    versionTotal: total,
    ...(visible
      ? visiblePage(visible)
      : {
          timelineVersions: state.timelineVersions.filter(
            (item) => item.id !== before?.id,
          ),
          ...(state.matchingVersions !== null && {
            matchingVersions:
              state.matchingVersions +
              Number(
                Boolean(
                  after && matchesVersionFilter(after, state.versionFilter),
                ),
              ) -
              Number(
                Boolean(
                  before && matchesVersionFilter(before, state.versionFilter),
                ),
              ),
          }),
        }),
  })

  if (total && !latest) runtime.pages.delete(visibleKey)
  if (!visible || (total && !latest))
    get().showVersionPage(state.versionFilter, state.versionPage)
}
