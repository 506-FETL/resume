import type { ShareViewResult } from '@/lib/supabase/resume/share.types'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useStore } from 'zustand'
import { ResumeCommentClientError } from '@/features/resume-comments/api/client'
import { fetchSharedResume } from '@/lib/supabase/resume/share'
import { createShareViewStore } from '../store'
import { applyShareResult, refreshDelay } from '../utils'

export function useShareView(token: string | undefined) {
  const store = useMemo(createShareViewStore, [token])
  const state = useStore(store, (value) => value.state)
  const lifecycle = useRef({
    generation: 0,
    failures: 0,
    password: undefined as string | undefined,
    controller: null as AbortController | null,
    pending: null as Promise<ShareViewResult | undefined> | null,
  })

  const load = useCallback(
    (
      password?: string,
      refresh = false,
    ): Promise<ShareViewResult | undefined> => {
      const session = lifecycle.current
      if (session.pending) return session.pending
      if (!token) {
        store.getState().setState({ phase: 'unavailable' })
        return Promise.resolve(undefined)
      }
      const generation = session.generation
      const controller = new AbortController()
      session.controller = controller
      const previous = store.getState().state
      const request = async () => {
        try {
          const result = await fetchSharedResume(
            token,
            password ?? session.password,
            {
              refresh,
              signal: controller.signal,
              knownContentRevision:
                previous.phase === 'ready'
                  ? previous.contentRevision
                  : undefined,
              accessToken:
                previous.phase === 'ready'
                  ? previous.commentAccess?.context.accessToken
                  : undefined,
            },
          )
          if (generation !== session.generation || controller.signal.aborted)
            return undefined
          session.failures = 0
          if (result.needPassword || result.unavailable)
            session.password = undefined
          else if (password !== undefined) session.password = password
          store
            .getState()
            .setState(applyShareResult(store.getState().state, result))
          return result
        } catch (error) {
          if (generation !== session.generation || controller.signal.aborted)
            return undefined
          session.failures += 1
          if (store.getState().state.phase !== 'ready')
            store.getState().setState({ phase: 'unavailable' })
          throw error
        } finally {
          if (generation === session.generation) {
            session.pending = null
            session.controller = null
          }
        }
      }
      session.pending = request()
      return session.pending
    },
    [store, token],
  )

  useEffect(() => {
    const session = lifecycle.current
    session.generation += 1
    session.failures = 0
    session.password = undefined
    session.pending = null
    load().catch(() => undefined)
    return () => {
      session.generation += 1
      session.controller?.abort()
      session.pending = null
    }
  }, [load])

  useEffect(() => {
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    function schedule() {
      clearTimeout(timer)
      if (
        disposed ||
        document.hidden ||
        store.getState().state.phase !== 'ready'
      )
        return
      timer = setTimeout(
        check,
        refreshDelay(store.getState().state, lifecycle.current.failures),
      )
    }
    function check() {
      clearTimeout(timer)
      if (
        disposed ||
        document.hidden ||
        store.getState().state.phase !== 'ready'
      )
        return
      load(undefined, true)
        .catch(() => undefined)
        .finally(schedule)
    }
    const visibility = () => {
      if (document.hidden) clearTimeout(timer)
      else check()
    }
    const unsubscribe = store.subscribe(schedule)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('focus', check)
    window.addEventListener('online', check)
    schedule()
    return () => {
      disposed = true
      clearTimeout(timer)
      unsubscribe()
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('focus', check)
      window.removeEventListener('online', check)
    }
  }, [load, store])

  const refreshCommentAccess = useCallback(async () => {
    const result = await load(undefined, true)
    const current = store.getState().state
    if (!result || current.phase !== 'ready' || !current.commentAccess)
      throw new ResumeCommentClientError(
        'share_unavailable',
        '分享访问状态已变化，请重新验证',
      )
    return current.commentAccess.context
  }, [load, store])

  return { state, load, refreshCommentAccess }
}
