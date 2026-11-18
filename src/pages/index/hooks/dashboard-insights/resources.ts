import { requestDashboardResource } from './resource-request'
import { useCallback, useEffect, useState } from 'react'
import type { JobSummaries } from './types'
import type { AtsSummaries } from './types'
import type { VersionSummaries } from './types'
import type { DashboardResource } from './types'
import type { DashboardResources } from './types'

const listAtsSummaries = () =>
  import('@/lib/supabase/resume/ats').then((module) =>
    module.listAtsSummaries(),
  )

const listJobApplicationSummaries = () =>
  import('@/lib/supabase/resume/company/queries').then((module) =>
    module.listJobApplicationSummaries(),
  )

const listResumeHistoryVersionSummaries = () =>
  import('@/lib/supabase/resume/history/queries/versions').then((module) =>
    module.listResumeHistoryVersionSummaries(),
  )

export function useDashboardResource<T>(
  fetcher: () => Promise<T>,
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

    if (!enabled) {
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

export const EMPTY_JOBS: JobSummaries = []

export const EMPTY_ATS: AtsSummaries = []

export const EMPTY_VERSIONS: VersionSummaries = []

// 各资源独立请求、重试；账户切换时立即遮蔽旧数据并取消旧请求的写入。
export function useDashboardResources(
  ready: boolean,
  enabled: boolean,
  accountId?: string,
): DashboardResources {
  const jobs = useDashboardResource(
    listJobApplicationSummaries,
    EMPTY_JOBS,
    ready,
    enabled,
    accountId,
  )

  const ats = useDashboardResource(
    listAtsSummaries,
    EMPTY_ATS,
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

  return { jobs, ats, versions }
}
