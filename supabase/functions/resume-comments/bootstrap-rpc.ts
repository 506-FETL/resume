import type {
  AdminClient,
  ResolvedAccess,
  AccessScopeRow,
  ShareRow,
} from './types.ts'
import type {
  BootstrapRpcInput,
  BootstrapInputContext,
  BootstrapRpcResult,
  BootstrapRepairEnvelope,
} from './bootstrap-types.ts'
import {
  mapBootstrapRpcError,
  bootstrapProtocolError,
  mapBootstrapRepairError,
  BootstrapInternalError,
} from './bootstrap-errors.ts'
import { validateBootstrapRpcResult } from './bootstrap-protocol.ts'
import {
  derivePasswordGeneration,
  timingSafeStringEqual,
} from '../shared/resume-comment-auth.ts'
import { CommentApiError, isRecord } from '../shared/resume-comment-schema.ts'
import { validateBootstrapAccess } from './bootstrap-access.ts'
import {
  isUuidValue,
  isPositiveSafeInteger,
  isDateOnly,
  isNonNegativeSafeInteger,
} from './validation.ts'
import { buildCommentAnchorDocument } from '../shared/resume-comment-core.ts'

export async function bootstrapResumeComments(
  admin: AdminClient,
  input: BootstrapRpcInput,
  collaboratorLease: BootstrapInputContext['collaboratorLease'],
): Promise<BootstrapRpcResult> {
  const { data, error } = await admin.rpc(
    'bootstrap_resume_comments_with_collaboration_lease_v2',
    {
      ...input,
      p_collaboration_protocol_version:
        collaboratorLease?.protocolVersion ?? null,
      p_member_lease_id: collaboratorLease?.memberLeaseId ?? null,
    },
  )

  if (error) throw mapBootstrapRpcError(error)

  return validateBootstrapRpcResult(data, input)
}

export async function assertCurrentSharePasswordGeneration({
  result,
  input,
  tokenSecret,
}: {
  result: BootstrapRpcResult
  input: BootstrapRpcInput
  tokenSecret: string | null
}) {
  if (input.p_access_kind !== 'share') return
  if (!tokenSecret || input.p_password_generation === null)
    return bootstrapProtocolError('invalid_share_password_context')

  const currentGeneration = await derivePasswordGeneration(
    result.access.sharePasswordHash,
    tokenSecret,
  )

  if (!timingSafeStringEqual(currentGeneration, input.p_password_generation)) {
    throw new CommentApiError(
      'share_unavailable',
      '分享访问状态已变化，请重新验证',
      401,
    )
  }
}

export async function resolveCommentAccessRpc(
  admin: AdminClient,
  input: BootstrapRpcInput,
  collaboratorLease: BootstrapInputContext['collaboratorLease'],
): Promise<{
  access: ResolvedAccess
  sharePasswordHash: string | null
}> {
  const { data, error } = await admin.rpc('resolve_resume_comment_access_v2', {
    ...input,
    p_collaboration_protocol_version:
      collaboratorLease?.protocolVersion ?? null,
    p_member_lease_id: collaboratorLease?.memberLeaseId ?? null,
  })

  if (error) throw mapBootstrapRpcError(error)
  if (
    !isRecord(data) ||
    data.protocolVersion !== 1 ||
    data.status !== 'ok' ||
    !isRecord(data.scope)
  ) {
    return bootstrapProtocolError('invalid_access_rpc_protocol')
  }

  const envelope = validateBootstrapAccess(data.access, input)
  const scopeValue = data.scope

  if (
    !isUuidValue(scopeValue.id) ||
    scopeValue.id !== envelope.scopeId ||
    scopeValue.kind !== 'version' ||
    scopeValue.owner_user_id !== envelope.ownerUserId ||
    !isUuidValue(scopeValue.resume_id) ||
    scopeValue.version_id !== envelope.versionId ||
    typeof scopeValue.document_hash !== 'string' ||
    !isPositiveSafeInteger(scopeValue.document_revision) ||
    !isDateOnly(scopeValue.projection_reference_date) ||
    !isNonNegativeSafeInteger(scopeValue.next_event_seq) ||
    scopeValue.archived_at !== null
  ) {
    return bootstrapProtocolError('invalid_access_rpc_protocol')
  }

  const scope = scopeValue as unknown as AccessScopeRow

  const share =
    envelope.kind === 'share'
      ? ({
          id: envelope.shareId!,
          user_id: envelope.ownerUserId,
          current_release_id: envelope.releaseId,
          allow_comments: envelope.canWrite,
          is_active: true,
          archived_at: null,
          expires_at: null,
          password_hash: envelope.sharePasswordHash,
          version_id: envelope.versionId,
        } satisfies ShareRow)
      : null

  return {
    access: {
      kind: envelope.kind,
      scope,
      userId: envelope.userId,
      actorKind: envelope.actorKind,
      actorId: envelope.actorId,
      actorKey: envelope.actorKey,
      legacyAnonymousId: envelope.legacyAnonymousId,
      share,
      releaseId: envelope.releaseId,
      versionId: envelope.versionId,
      canWrite: envelope.canWrite,
      canManageAll: envelope.canManageAll,
    },
    sharePasswordHash: envelope.sharePasswordHash,
  }
}

export async function assertResolvedSharePasswordGeneration({
  input,
  sharePasswordHash,
  tokenSecret,
}: {
  input: BootstrapRpcInput
  sharePasswordHash: string | null
  tokenSecret: string | null
}) {
  if (input.p_access_kind !== 'share') return
  if (!tokenSecret || input.p_password_generation === null)
    return bootstrapProtocolError('invalid_share_password_context')

  const currentGeneration = await derivePasswordGeneration(
    sharePasswordHash,
    tokenSecret,
  )

  if (!timingSafeStringEqual(currentGeneration, input.p_password_generation)) {
    throw new CommentApiError(
      'share_unavailable',
      '分享访问状态已变化，请重新验证',
      401,
    )
  }
}

export async function repairBootstrapScope(
  admin: AdminClient,
  repair: BootstrapRepairEnvelope,
): Promise<string> {
  try {
    const projected = buildCommentAnchorDocument(
      repair.snapshot,
      repair.projectionReferenceDate,
    )

    const { data, error } = await admin.rpc(
      'ensure_resume_version_comment_scope',
      {
        p_owner_user_id: repair.ownerUserId,
        p_version_id: repair.versionId,
        p_anchor_document: projected.document,
        p_document_hash: projected.documentHash,
        p_projection_reference_date: repair.projectionReferenceDate,
        p_expected_document_revision: repair.documentRevision,
      },
    )

    if (error) throw mapBootstrapRepairError(error)
    if (!isUuidValue(data))
      return bootstrapProtocolError('invalid_scope_repair_result')

    return data
  } catch (error) {
    if (
      error instanceof BootstrapInternalError ||
      error instanceof CommentApiError
    )
      throw error

    return bootstrapProtocolError('scope_repair_failed')
  }
}
