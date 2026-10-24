import type {
  ResumeOption,
  ResumePreviewData,
} from '../components/drawer/types'
import type { TrackerAccountScope as ResumeScope } from './account-scope'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { getAllResumesFromUser, getResumeById } from '@/lib/supabase/resume'
import { getTrackerErrorMessage } from '../utils'
import {
  getTrackerAccountScope,
  subscribeTrackerAccountScope,
} from './account-scope'

const CACHE_TTL = 60_000

interface CacheEntry<T> {
  data?: T
  expiresAt: number
  promise?: Promise<T>
}

const optionsCache = new Map<string, CacheEntry<ResumeOption[]>>()
const previewCache = new Map<string, CacheEntry<ResumePreviewData>>()

// 即使身份 A → B → A 发生在同一轮渲染中，旧请求也不能回填新会话。
subscribeTrackerAccountScope(() => {
  optionsCache.clear()
  previewCache.clear()
})

export const getTrackerResumeScope = getTrackerAccountScope

function getCachedResource<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  requestScope: ResumeScope,
): T | undefined {
  if (requestScope !== getTrackerAccountScope() || !requestScope.userId)
    return undefined

  const entry = cache.get(key)

  return entry && entry.expiresAt > Date.now() ? entry.data : undefined
}

function readResource<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  requestScope: ResumeScope,
  load: () => Promise<T>,
): Promise<T> {
  if (requestScope !== getTrackerAccountScope() || !requestScope.userId)
    return Promise.reject(new Error('登录状态已变更，请重新加载'))

  const cached = cache.get(key)

  if (cached?.promise) return cached.promise
  if (cached?.data !== undefined && cached.expiresAt > Date.now())
    return Promise.resolve(cached.data)

  const entry: CacheEntry<T> = { expiresAt: 0 }

  cache.set(key, entry)

  entry.promise = Promise.resolve()
    .then(() => {
      if (requestScope !== getTrackerAccountScope())
        throw new Error('登录状态已变更，请重新加载')

      return load()
    })
    .then((data) => {
      if (requestScope !== getTrackerAccountScope())
        throw new Error('登录状态已变更，请重新加载')

      entry.data = data
      entry.expiresAt = Date.now() + CACHE_TTL

      return data
    })
    .catch((error: unknown) => {
      // 失败不缓存，也不清理切换身份后同一 key 的新请求。
      if (cache.get(key) === entry) cache.delete(key)

      throw error
    })
    .finally(() => {
      entry.promise = undefined
    })

  return entry.promise
}

export function loadTrackerResumeOptions(
  requestScope = getTrackerAccountScope(),
) {
  return readResource(
    optionsCache,
    'options',
    requestScope,
    async () => (await getAllResumesFromUser()) as ResumeOption[],
  )
}

export function loadTrackerResumePreview(
  requestScope: ResumeScope,
  resumeId: string,
) {
  return readResource(previewCache, resumeId, requestScope, async () => {
    const data = await getResumeById<ResumePreviewData>(resumeId, '*')

    if (!data) throw new Error('这份简历暂时无法查看')

    return data
  })
}

interface ResourceState<T> {
  scope: ResumeScope
  key: string
  data: T | null
  error: string | null
}

function useResumeResource<T>(
  enabled: boolean,
  key: string,
  cache: Map<string, CacheEntry<T>>,
  load: (requestScope: ResumeScope, key: string) => Promise<T>,
) {
  const currentScope = useSyncExternalStore(
    subscribeTrackerAccountScope,
    getTrackerResumeScope,
    getTrackerResumeScope,
  )

  const cached = getCachedResource(cache, key, currentScope)

  const [state, setState] = useState<ResourceState<T> | null>(() =>
    cached === undefined
      ? null
      : { scope: currentScope, key, data: cached, error: null },
  )

  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    if (!enabled) return

    const publish = (data: T | null, error: string | null) => {
      setState((previous) =>
        previous?.scope === currentScope &&
        previous.key === key &&
        previous.data === data &&
        previous.error === error
          ? previous
          : { scope: currentScope, key, data, error },
      )
    }

    const cached = getCachedResource(cache, key, currentScope)

    if (cached !== undefined) {
      publish(cached, null)

      return
    }

    let active = true

    setState(null)

    load(currentScope, key)
      .then((data) => {
        if (active && currentScope === getTrackerResumeScope())
          publish(data, null)
      })
      .catch((error: unknown) => {
        if (active && currentScope === getTrackerResumeScope())
          publish(null, getTrackerErrorMessage(error))
      })

    return () => {
      active = false
    }
  }, [enabled, currentScope, key, cache, load, attempt])

  const current =
    state?.scope === currentScope && state.key === key ? state : null

  // 缓存命中的首轮渲染直接复用原始数据，避免 Tab 重挂载时卸载预览、闪过加载态。
  return {
    data: cached ?? current?.data ?? null,
    error: cached === undefined ? (current?.error ?? null) : null,
    loading: enabled && cached === undefined && !current,
    retry,
    scope: currentScope,
  }
}

export function useTrackerResumeOptions(enabled: boolean) {
  return useResumeResource(
    enabled,
    'options',
    optionsCache,
    loadTrackerResumeOptions,
  )
}

export function useTrackerResumePreview(
  resumeId: string | null,
  enabled: boolean,
) {
  return useResumeResource(
    enabled && Boolean(resumeId),
    resumeId ?? '',
    previewCache,
    loadTrackerResumePreview,
  )
}
