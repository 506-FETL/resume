import { BOARD_COLUMNS } from '../../const'
import {
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '../../lib/account-scope'
import type { ApplicationStatus, JobApplication, ViewMode } from '../../types'
import { getTrackerErrorMessage } from '../../utils/errors'
import {
  type TrackerFilters,
  getTrackerJobPage,
  type TrackerCounts,
  type TrackerHistoryCounts,
  type TrackerCursor,
  type TrackerLane,
} from '@/lib/supabase/resume/company/tracker-pages'
import { trackerQuery } from './job-query'
import { createJobCounts } from './job-counts'
import { filterJobs } from '../../utils/filtering'
import { createPageMerge } from './job-page-merge'
import type { PersistenceRuntime } from './runtime'
import type { PersistenceState } from './types'

const LIST_SIZE = 32
const COLUMN_SIZE = 12

function createRange(archived: boolean, filters: TrackerFilters) {
  const now = new Date()

  const date = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10)

  return {
    archived,
    filters: {
      ...filters,
      ...(filters.metric === 'pending'
        ? {
            today: date,
            staleBefore: new Date(now.getTime() - 7 * 86400000).toISOString(),
          }
        : {}),
      ...(filters.sortBy === 'days' ? { now: now.toISOString() } : {}),
    },
    ids: new Set<string>(),
    cursors: new Map<TrackerLane, TrackerCursor>(),
    more: {} as PersistenceState['pageMore'],
    errors: {} as PersistenceState['pageErrors'],
    pending: new Map<string, Promise<void>>(),
    ready: false,
    complete: false,
    error: null as string | null,
  }
}

type Range = ReturnType<typeof createRange>

type Mode = ViewMode | 'all'

export const emptyTrackerPages = {
  baseScopeComplete: false,
  scopeComplete: false,
  viewJobIds: new Set<string>(),
  pageMore: {} as PersistenceState['pageMore'],
  pageLoading: {} as PersistenceState['pageLoading'],
  pageErrors: {} as PersistenceState['pageErrors'],
  historyCounts: null as TrackerHistoryCounts | null,
  countsKey: null as string | null,
  counts: null as TrackerCounts | null,
  countsError: null as string | null,
}

export function createJobPages(core: PersistenceRuntime) {
  const { get, set } = core
  const ranges = new Map<string, Range>()
  let view: ViewMode = 'board'
  let active: Range | undefined
  let activeKey = ''

  const completedBase = (archived: boolean) => {
    const prefix = String(archived) + '-{}-'

    return [...ranges].find(
      ([key, range]) => key.startsWith(prefix) && range.complete,
    )?.[1].ids
  }

  const { refreshJobCounts, runJobBatch, resetCounts } = createJobCounts(
    core,
    completedBase,
  )

  const sync = (range: Range) => {
    if (active !== range) return

    set({
      isInitialized: range.ready,
      loading: range.pending.has('initial'),
      error: range.error,
      baseScopeComplete: Boolean(completedBase(range.archived)),
      scopeComplete: range.complete,
      viewJobIds: range.ids,
      pageMore: { ...range.more },
      pageErrors: { ...range.errors },
      pageLoading: Object.fromEntries(
        [...range.pending.keys()].map((key) => [key, true]),
      ),
    })
  }

  const read = (
    archived: boolean,
    mode: Mode,
    range: Range,
    lane?: TrackerLane,
  ): Promise<void> => {
    const key = lane ?? 'initial'
    const pending = range.pending.get(key)

    if (pending) return pending

    const scope = getTrackerAccountScope()
    let replaceOnSuccess = !lane && !range.cursors.size
    const mergePage = createPageMerge(core, scope.userId)
    const generation = new Map(core.generations)

    const board = mode === 'board'
    const size = mode === 'all' ? 200 : board ? COLUMN_SIZE : LIST_SIZE

    const groups: TrackerLane[] =
      board && !lane ? BOARD_COLUMNS.map((c) => c.status) : [lane ?? 'list']

    const run = async () => {
      do {
        const rows = await getTrackerJobPage(
          archived,
          board,
          size,
          lane === 'list' ? undefined : lane,
          range.cursors.get(lane ?? 'list'),
          range.filters,
        )

        if (
          !isTrackerAccountScopeCurrent(scope) ||
          ![...ranges.values()].includes(range)
        )
          return

        if (replaceOnSuccess) {
          range.ids = new Set(
            [...range.ids].filter(
              (id) => core.generations.get(id) !== generation.get(id),
            ),
          )
          replaceOnSuccess = false
        }

        const batch: JobApplication[] = []

        for (const group of groups) {
          const items =
            group === 'list' ? rows : rows.filter((j) => j.status === group)

          const page = items.slice(0, size)
          const last = page.at(-1)

          if (last)
            range.cursors.set(group, {
              id: last.id,
              time: board ? last.created_at : last.updated_at,
              created: last.created_at,
              status: last.status,
            })

          range.more[group] = items.length > size
          batch.push(...page)
        }

        range.ids = mergePage(batch, archived, range.ids)
        range.complete = !Object.values(range.more).some(Boolean)
        range.ready = mode !== 'all' || range.complete

        sync(range)
      } while (mode === 'all' && !range.complete)
    }

    if (!lane) range.error = null
    if (lane) delete range.errors[lane]

    const task = run()
      .catch((error) => {
        if (!isTrackerAccountScopeCurrent(scope)) return
        if (lane) range.errors[lane] = getTrackerErrorMessage(error)
        else range.error = getTrackerErrorMessage(error)

        throw error
      })
      .finally(() => {
        if (range.pending.get(key) === task) range.pending.delete(key)

        sync(range)
      })

    range.pending.set(key, task)
    sync(range)

    return task
  }

  const ensure = (mode: Mode, force = false) => {
    const state = get()

    if (!getTrackerAccountScope().userId) return Promise.resolve()

    refreshJobCounts(force)

    const archived = state.showArchived
    const query = trackerQuery(state, view)
    const prefix = String(archived) + '-' + query.key + '-'
    const globalPrefix = String(archived) + '-{}-'
    const key = prefix + mode

    const complete = [...ranges.entries()].find(
      ([k, r]) =>
        (k.startsWith(prefix) || k.startsWith(globalPrefix)) && r.complete,
    )?.[1]

    const previous = complete ?? ranges.get(key)
    const listRange = ranges.get(prefix + 'list')

    if (force) {
      for (const k of ranges.keys())
        if (k.startsWith(String(archived) + '-')) ranges.delete(k)
    }

    const range = (!force && previous) || createRange(archived, query.filters)

    if (
      !force &&
      !previous &&
      mode === 'all' &&
      listRange?.ready &&
      !listRange.pending.size &&
      listRange.more.list
    ) {
      range.ids = new Set(listRange.ids)
      range.cursors = new Map(listRange.cursors)
      range.more = { ...listRange.more }
    }
    if (force && previous?.ready) {
      range.ready = true
      range.ids = new Set(previous.ids)
    }

    ranges.set(key, range)
    active = range
    activeKey = key
    sync(range)

    if (!force && (range.ready || range.error)) return Promise.resolve()

    return read(archived, mode, range)
  }

  return {
    ...emptyTrackerPages,
    runJobBatch,
    refreshJobCounts,
    resetJobPages: () => {
      ranges.clear()
      active = undefined
      resetCounts()
      activeKey = ''
    },
    ensureJobsView: (mode: ViewMode) => {
      view = mode

      return ensure(trackerQuery(get(), mode).localOrder ? 'all' : mode)
    },
    ensureAllJobs: () => ensure('all'),
    reloadJobs: () => {
      const state = get()
      const query = trackerQuery(state, view)
      const mode = query.localOrder ? 'all' : view

      if (
        active?.error &&
        activeKey === String(state.showArchived) + '-' + query.key + '-' + mode
      )
        return read(state.showArchived, mode, active)

      return ensure(mode, true)
    },
    loadMoreJobs: (status?: ApplicationStatus) => {
      const lane = status ?? 'list'

      const query = trackerQuery(get(), view)

      if (
        activeKey !==
          String(get().showArchived) + '-' + query.key + '-' + view ||
        !active ||
        !active.more[lane]
      )
        return Promise.resolve()

      return read(get().showArchived, status ? 'board' : 'list', active, lane)
    },
    rememberJob: (job: JobApplication) => {
      for (const r of new Set(ranges.values())) {
        const f = r.filters

        const match =
          (!f.companyId || f.companyId === job.tracker_company_id) &&
          filterJobs(
            [job],
            f.status ?? null,
            f.keyword ?? '',
            r.archived,
            f.metric ?? null,
            f.focused,
          ).length > 0

        if (match) r.ids.add(job.id)
        else r.ids.delete(job.id)

        r.ids = new Set(r.ids)
      }

      if (active) sync(active)
    },
  }
}
