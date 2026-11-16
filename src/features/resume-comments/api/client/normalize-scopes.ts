import type {
  AccessibleCommentScopeSummary,
  CommentScopeSummary,
} from '../../store/types.ts'
import type {
  CommentThreadCounts,
  CommentThreadReadState,
  CommentVersionReference,
} from '../../types.ts'
import { ResumeCommentClientError } from './error'
import type { CommentRealtimeAccess } from './types'
import { asArray, asNullableString, asNumber, asRecord } from './values'

export function normalizeScope(value: unknown): CommentScopeSummary {
  const scope = asRecord(value)
  const anchorDocument = asRecord(scope.anchor_document)

  const nodeOrder = asArray(anchorDocument.nodes).flatMap((value) => {
    const node = asRecord(value)

    return typeof node.nodeKey === 'string' ? [node.nodeKey] : []
  })

  return {
    id: String(scope.id ?? ''),
    kind: 'version',
    resumeId: String(scope.resume_id ?? ''),
    ownerUserId: String(scope.owner_user_id ?? ''),
    versionId: asNumber(scope.version_id),
    documentHash: String(scope.document_hash ?? ''),
    documentRevision: asNumber(scope.document_revision),
    nodeOrder,
    projectionReferenceDate: String(scope.projection_reference_date ?? ''),
    nextEventSeq: asNumber(scope.next_event_seq),
  }
}

export function normalizeAccessibleScope(
  value: unknown,
): AccessibleCommentScopeSummary {
  const scope = asRecord(value)

  return {
    id: String(scope.id ?? ''),
    kind: 'version',
    resumeId: String(scope.resume_id ?? ''),
    versionId: asNumber(scope.version_id),
    projectionReferenceDate: String(scope.projection_reference_date ?? ''),
    documentRevision: asNumber(scope.document_revision),
    nextEventSeq: asNumber(scope.next_event_seq),
    lastReadEventSeq: asNumber(scope.last_read_event_seq),
    updatedAt: String(scope.updated_at ?? ''),
  }
}

export function normalizeVersion(value: unknown): CommentVersionReference {
  const version = asRecord(value)

  return {
    versionId: asNumber(version.id),
    versionNo: asNumber(version.version_no),
    versionName:
      asNullableString(version.version_name) ??
      asNullableString(version.milestone_name),
    status: version.status === 'frozen' ? 'frozen' : 'active',
    documentHash: String(version.content_hash ?? ''),
    documentRevision: asNumber(version.document_revision),
    projectionReferenceDate: String(version.projection_reference_date ?? ''),
    sharedLinkCount: asNumber(version.shared_link_count),
  }
}

export function normalizeCounts(value: unknown): CommentThreadCounts {
  const counts = asRecord(value)

  return {
    unresolved: asNumber(counts.unresolved),
    resolved: asNumber(counts.resolved),
    detached: asNumber(counts.detached),
  }
}

export function normalizeRealtimeAccess(value: unknown): CommentRealtimeAccess {
  const access = asRecord(value)

  return {
    topic: String(access.topic ?? ''),
    expiresAt: String(access.expiresAt ?? ''),
    token: String(access.token ?? ''),
  }
}

export function normalizeThreadReadStates(
  value: unknown,
): CommentThreadReadState[] {
  const threadIds = new Set<string>()

  return asArray(value).map((item) => {
    const state = asRecord(item)
    const threadId = String(state.threadId ?? '')
    const latestCommentEventSeq = asNumber(state.latestCommentEventSeq)
    const lastReadEventSeq = asNumber(state.lastReadEventSeq)

    if (
      !threadId ||
      threadIds.has(threadId) ||
      latestCommentEventSeq < 0 ||
      lastReadEventSeq < 0
    ) {
      throw new ResumeCommentClientError('unexpected', '评论已读状态协议不兼容')
    }

    threadIds.add(threadId)

    return { threadId, latestCommentEventSeq, lastReadEventSeq }
  })
}
