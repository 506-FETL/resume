import type {
  BootstrapAccessEnvelope,
  BootstrapPayload,
  BootstrapScope,
} from './bootstrap-types.ts'
import { isRecord } from '../shared/resume-comment-schema.ts'
import { bootstrapProtocolError } from './bootstrap-errors.ts'
import {
  isNonNegativeSafeInteger,
  isUuidValue,
  isDateOnly,
} from './validation.ts'

export function validateBootstrapPayload(
  value: unknown,
  access: BootstrapAccessEnvelope,
  eventSeq: number,
): BootstrapPayload {
  if (!isRecord(value)) return bootstrapProtocolError('invalid_rpc_protocol')

  const scopeValue = value.scope
  const versionValue = value.version
  const countsValue = value.counts

  if (
    !isRecord(scopeValue) ||
    !isRecord(versionValue) ||
    !isRecord(countsValue) ||
    !Array.isArray(value.threads) ||
    !Array.isArray(value.profiles) ||
    !Array.isArray(value.accessibleScopes) ||
    !Array.isArray(value.threadReadStates) ||
    !isNonNegativeSafeInteger(value.lastReadEventSeq)
  ) {
    return bootstrapProtocolError('invalid_rpc_protocol')
  }

  const anchorDocument = scopeValue.anchor_document

  if (
    scopeValue.kind !== 'version' ||
    scopeValue.id !== access.scopeId ||
    scopeValue.owner_user_id !== access.ownerUserId ||
    !isUuidValue(scopeValue.resume_id) ||
    scopeValue.version_id !== access.versionId ||
    scopeValue.history_version_id !== null ||
    scopeValue.share_release_id !== null ||
    typeof scopeValue.document_hash !== 'string' ||
    !isNonNegativeSafeInteger(scopeValue.document_revision) ||
    !isDateOnly(scopeValue.projection_reference_date) ||
    scopeValue.next_event_seq !== eventSeq ||
    scopeValue.archived_at !== null ||
    !isRecord(anchorDocument) ||
    !Array.isArray(anchorDocument.nodes) ||
    !anchorDocument.nodes.every(
      (node) => isRecord(node) && typeof node.nodeKey === 'string',
    ) ||
    versionValue.id !== access.versionId ||
    !isNonNegativeSafeInteger(versionValue.version_no) ||
    (versionValue.version_name !== null &&
      typeof versionValue.version_name !== 'string') ||
    (versionValue.milestone_name !== null &&
      typeof versionValue.milestone_name !== 'string') ||
    (versionValue.status !== 'active' && versionValue.status !== 'frozen') ||
    (versionValue.content_hash !== null &&
      typeof versionValue.content_hash !== 'string') ||
    !isNonNegativeSafeInteger(versionValue.document_revision) ||
    !isDateOnly(versionValue.projection_reference_date) ||
    !isNonNegativeSafeInteger(versionValue.shared_link_count) ||
    !isNonNegativeSafeInteger(countsValue.unresolved) ||
    !isNonNegativeSafeInteger(countsValue.resolved) ||
    !isNonNegativeSafeInteger(countsValue.detached) ||
    value.accessibleScopes.length !== 1
  ) {
    return bootstrapProtocolError('invalid_rpc_protocol')
  }

  const accessibleScope = value.accessibleScopes[0]

  if (
    !isRecord(accessibleScope) ||
    accessibleScope.id !== access.scopeId ||
    accessibleScope.owner_user_id !== access.ownerUserId ||
    accessibleScope.version_id !== access.versionId ||
    accessibleScope.next_event_seq !== eventSeq ||
    accessibleScope.last_read_event_seq !== value.lastReadEventSeq
  ) {
    return bootstrapProtocolError('invalid_rpc_protocol')
  }

  const threadIds = new Set<string>()

  const threadReadStates = value.threadReadStates.map((item) => {
    if (
      !isRecord(item) ||
      !isUuidValue(item.threadId) ||
      threadIds.has(item.threadId) ||
      !isNonNegativeSafeInteger(item.latestCommentEventSeq) ||
      !isNonNegativeSafeInteger(item.lastReadEventSeq) ||
      item.latestCommentEventSeq > eventSeq ||
      item.lastReadEventSeq > eventSeq ||
      typeof item.unread !== 'boolean' ||
      item.unread !== item.latestCommentEventSeq > item.lastReadEventSeq
    ) {
      return bootstrapProtocolError('invalid_rpc_protocol')
    }

    threadIds.add(item.threadId)

    return {
      threadId: item.threadId,
      latestCommentEventSeq: item.latestCommentEventSeq,
      lastReadEventSeq: item.lastReadEventSeq,
      unread: item.unread,
    }
  })

  const payloadThreadIds = new Set(
    value.threads.flatMap((thread) => {
      if (!isRecord(thread) || !isUuidValue(thread.id))
        return bootstrapProtocolError('invalid_rpc_protocol')

      return [thread.id]
    }),
  )

  if (
    payloadThreadIds.size !== threadIds.size ||
    [...payloadThreadIds].some((threadId) => !threadIds.has(threadId))
  ) {
    return bootstrapProtocolError('invalid_rpc_protocol')
  }

  const nodes = anchorDocument.nodes.map((node) => {
    if (!isRecord(node) || typeof node.nodeKey !== 'string')
      return bootstrapProtocolError('invalid_rpc_protocol')

    return { nodeKey: node.nodeKey }
  })

  const scope: BootstrapScope = {
    id: scopeValue.id,
    kind: 'version',
    owner_user_id: scopeValue.owner_user_id,
    resume_id: scopeValue.resume_id,
    version_id: scopeValue.version_id,
    history_version_id: null,
    share_release_id: null,
    anchor_document: { nodes },
    document_hash: scopeValue.document_hash,
    document_revision: scopeValue.document_revision,
    projection_reference_date: scopeValue.projection_reference_date,
    next_event_seq: scopeValue.next_event_seq,
    archived_at: null,
  }

  const versionName =
    typeof versionValue.version_name === 'string'
      ? versionValue.version_name
      : null

  const milestoneName =
    typeof versionValue.milestone_name === 'string'
      ? versionValue.milestone_name
      : null

  const contentHash =
    typeof versionValue.content_hash === 'string'
      ? versionValue.content_hash
      : null

  return {
    scope,
    version: {
      id: versionValue.id,
      version_no: versionValue.version_no,
      version_name: versionName,
      milestone_name: milestoneName,
      status: versionValue.status,
      content_hash: contentHash,
      document_revision: versionValue.document_revision,
      projection_reference_date: versionValue.projection_reference_date,
      shared_link_count: versionValue.shared_link_count,
    },
    counts: {
      unresolved: countsValue.unresolved,
      resolved: countsValue.resolved,
      detached: countsValue.detached,
    },
    threads: value.threads,
    profiles: value.profiles,
    accessibleScopes: [
      {
        ...scope,
        last_read_event_seq: value.lastReadEventSeq,
      },
    ],
    lastReadEventSeq: value.lastReadEventSeq,
    threadReadStates,
  }
}
