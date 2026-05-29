import type { RewriteAction, RewriteCandidate } from './types'
import { useCallback, useState } from 'react'
import {
  failRewriteSession,
  INITIAL_REWRITE_SESSION_STATE,
  resetRewriteSession,
  setRewriteJdDraft,
  startRewriteStreaming,
  succeedRewriteSession,
  waitForRewriteJd,
} from './rewrite-session-state'

export function useRewriteSession() {
  const [state, setState] = useState(INITIAL_REWRITE_SESSION_STATE)

  const startStreaming = useCallback((action: RewriteAction) => {
    setState(prev => startRewriteStreaming(prev, action))
  }, [])

  const succeed = useCallback((candidates: RewriteCandidate[]) => {
    setState(prev => succeedRewriteSession(prev, candidates))
  }, [])

  const fail = useCallback((message: string) => {
    setState(prev => failRewriteSession(prev, message))
  }, [])

  const reset = useCallback(() => {
    setState(resetRewriteSession())
  }, [])

  const setJdDraft = useCallback((jdDraft: string) => {
    setState(prev => setRewriteJdDraft(prev, jdDraft))
  }, [])

  const waitForJd = useCallback(() => {
    setState(prev => waitForRewriteJd(prev))
  }, [])

  const openWaitingJd = useCallback((_action: RewriteAction) => {
    setState(prev => waitForRewriteJd(prev))
  }, [])

  return { state, startStreaming, succeed, fail, reset, setJdDraft, waitForJd, openWaitingJd }
}
