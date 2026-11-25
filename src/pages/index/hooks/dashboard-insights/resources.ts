import { requestDashboardResource } from './resource-request'
import { useCallback, useEffect, useState } from 'react'
import { EMPTY_DASHBOARD_JOBS, loadDashboardJobs } from './jobs'
import type { TrendScores } from './types'
import type { AtsSummary } from './types'
import type { VersionSummaries } from './types'
import type { DashboardResource } from './types'
import type { DashboardResources } from './types'

const listAtsSummary = (owner: string) =>
  import('./queries').then((module) => module.getDashboardAtsSummary(owner))

const listTrend = (owner: string) =>
  import('./queries').then((module) => module.listDashboardTrend(owner))

const loadWeeklyEdits = (owner: string) =>
  import('./queries').then((module) => module.loadDashboardWeeklyEdits(owner))

const listResumeHistoryVersionSummaries = (owner: string) =>
  import('./queries').then((module) => module.listDashboardVersions(owner))

export function useDashboardResource<T>(
  fetcher: (owner: string) => Promise<T>,
  empty: T,
  ready: boolean,
  enabled: boolean,
  accountId: string | undefined,
): DashboardResource<T> {
  const [attempt, setAttempt] = useState(0)

  const [state, setState] = useState({
    data: empty,
    loading: true,
    error: null as string | null,
    hasLoaded: false,
    accountId,
  })

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    let cancelled = false

    if (!ready) return

    setState((previous) => ({
      ...previous,
      ...(previous.accountId !== accountId
        ? { data: empty, hasLoaded: false }
        : {}),
      accountId,
      loading: enabled,
      error: null,
    }))

    if (!enabled || !accountId) {
      setState({
        data: empty,
        loading: false,
        error: null,
        hasLoaded: true,
        accountId,
      })

      return
    }

    requestDashboardResource(fetcher, accountId)
      .then((data) => {
        if (!cancelled)
          setState({
            data,
            loading: false,
            error: null,
            hasLoaded: true,
            accountId,
          })
      })
      .catch(() => {
        if (!cancelled)
          setState((previous) => ({
            ...previous,
            loading: false,
            error: '加载失败',
            accountId,
          }))
      })

    return () => {
      cancelled = true
    }
  }, [fetcher, ready, enabled, accountId, attempt, empty])

  return state.accountId === accountId
    ? { ...state, retry }
    : { data: empty, loading: true, error: null, hasLoaded: false, retry }
}

const EMPTY_ATS: AtsSummary = {
  avgAtsScore: null,
  atsResumeCount: 0,
  scoredResumeCount: 0,
  atsTodoTotal: 0,
}

const EMPTY_TREND: TrendScores = []

const EMPTY_WEEKLY_EDITS: Record<string, number> = {}

const EMPTY_VERSIONS: VersionSummaries = []

// 各资源独立请求、重试；账户切换时立即遮蔽旧数据并取消旧请求的写入。
export function useDashboardResources(
  ready: boolean,
  enabled: boolean,
  accountId?: string,
): DashboardResources {
  const jobs = useDashboardResource(
    loadDashboardJobs,
    EMPTY_DASHBOARD_JOBS,
    ready,
    enabled,
    accountId,
  )

  const ats = useDashboardResource(
    listAtsSummary,
    EMPTY_ATS,
    ready,
    enabled,
    accountId,
  )

  const trend = useDashboardResource(
    listTrend,
    EMPTY_TREND,
    ready,
    enabled,
    accountId,
  )

  const versions = useDashboardResource(
    listResumeHistoryVersionSummaries,
    EMPTY_VERSIONS,
    ready,
    enabled,
    accountId,
  )

  const weeklyEdits = useDashboardResource(
    loadWeeklyEdits,
    EMPTY_WEEKLY_EDITS,
    ready,
    enabled,
    accountId,
  )

  return { jobs, ats, trend, versions, weeklyEdits }
}
