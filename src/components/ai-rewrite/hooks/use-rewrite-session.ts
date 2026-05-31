import type { RewriteAction, RewriteCandidate } from '../types'
import { useState } from 'react'
import { failRewriteSession, INITIAL_REWRITE_SESSION_STATE, resetRewriteSession, setRewriteJdDraft, startRewriteStreaming, succeedRewriteSession, waitForRewriteJd } from '../utils/rewrite-session-state'

export function useRewriteSession() {
  const [state, setState] = useState(INITIAL_REWRITE_SESSION_STATE)

  function startStreaming(action: RewriteAction) {
    setState(prev => startRewriteStreaming(prev, action))
  }

  function succeed(candidates: RewriteCandidate[]) {
    setState(prev => succeedRewriteSession(prev, candidates))
  }

  function fail(message: string) {
    setState(prev => failRewriteSession(prev, message))
  }

  function reset() {
    setState(resetRewriteSession())
  }

  function setJdDraft(jdDraft: string) {
    setState(prev => setRewriteJdDraft(prev, jdDraft))
  }

  function waitForJd() {
    setState(prev => waitForRewriteJd(prev))
  }

  return { state, startStreaming, succeed, fail, reset, setJdDraft, waitForJd }
}
