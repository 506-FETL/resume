import type { ViewState } from './types'
import type { ShareViewResult } from '@/lib/supabase/resume/share.types'
import { CURRENT_REFRESH_MS, HISTORY_REFRESH_MS, MAX_RETRY_MS } from './const'
import { readShareCommentAccess } from './hooks/use-share-comment-access'

export function refreshDelay(state: ViewState, failures: number): number {
  const base =
    state.phase === 'ready' && state.sourceKind === 'current'
      ? CURRENT_REFRESH_MS
      : HISTORY_REFRESH_MS
  return Math.min(MAX_RETRY_MS, base * 2 ** Math.min(failures, 4))
}

export function applyShareResult(
  previous: ViewState,
  result: ShareViewResult,
): ViewState {
  if (result.unavailable) return { phase: 'unavailable' }
  if (result.needPassword)
    return {
      phase: 'password',
      wrong: Boolean(result.wrongPassword),
      rateLimited: Boolean(result.rateLimited),
    }
  const sameContent =
    previous.phase === 'ready' &&
    (result.notModified ||
      (Boolean(result.contentRevision) &&
        result.contentRevision === previous.contentRevision))
  const snapshot = sameContent ? previous.snapshot : result.snapshot
  const templateDefinition = sameContent
    ? previous.templateDefinition
    : result.templateDefinition
  if (!snapshot || !templateDefinition) return { phase: 'unavailable' }
  return {
    phase: 'ready',
    snapshot,
    templateDefinition,
    sourceKind:
      result.sourceKind === 'current' && result.contentRevision
        ? 'current'
        : 'history',
    contentRevision: result.contentRevision,
    displayName: result.displayName ?? null,
    shareId: result.shareId ?? '',
    releaseId: result.releaseId ?? '',
    releaseNo: result.releaseNo ?? null,
    versionId: result.versionId ?? 0,
    documentRevision: result.documentRevision ?? 0,
    allowComments: result.allowComments === true,
    projectionReferenceDate: result.projectionReferenceDate,
    commentAccess: readShareCommentAccess(result),
  }
}
