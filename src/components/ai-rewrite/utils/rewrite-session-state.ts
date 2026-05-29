import type { RewriteAction, RewriteCandidate, RewriteSessionState } from '../types'

export const INITIAL_REWRITE_SESSION_STATE: RewriteSessionState = {
  status: 'idle',
  action: null,
  candidates: [],
  errorMessage: null,
  jdDraft: '',
}

export function startRewriteStreaming(state: RewriteSessionState, action: RewriteAction): RewriteSessionState {
  return {
    ...state,
    status: 'streaming',
    action,
    candidates: [],
    errorMessage: null,
  }
}

export function succeedRewriteSession(state: RewriteSessionState, candidates: RewriteCandidate[]): RewriteSessionState {
  return {
    ...state,
    status: 'success',
    candidates,
    errorMessage: null,
  }
}

export function failRewriteSession(state: RewriteSessionState, message: string): RewriteSessionState {
  return {
    ...state,
    status: 'error',
    candidates: [],
    errorMessage: message,
  }
}

export function resetRewriteSession(): RewriteSessionState {
  return INITIAL_REWRITE_SESSION_STATE
}

export function setRewriteJdDraft(state: RewriteSessionState, jdDraft: string): RewriteSessionState {
  return {
    ...state,
    jdDraft,
  }
}

export function waitForRewriteJd(state: RewriteSessionState): RewriteSessionState {
  return {
    ...state,
    status: 'waiting_jd',
    action: 'align_jd',
    candidates: [],
    errorMessage: null,
  }
}

export function getRewriteCanRetry(state: RewriteSessionState, jdMinChars: number): boolean {
  if (!state.action || state.status === 'streaming')
    return false

  return state.action !== 'align_jd' || state.jdDraft.trim().length >= jdMinChars
}
