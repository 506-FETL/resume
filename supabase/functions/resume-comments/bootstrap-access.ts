import { isUuidValue, isPositiveSafeInteger } from './validation.ts'
import { bootstrapProtocolError } from './bootstrap-errors.ts'
import type {
  BootstrapRpcInput,
  BootstrapAccessEnvelope,
} from './bootstrap-types.ts'
import { isRecord } from '../shared/resume-comment-schema.ts'

function readProtocolNullableUuid(
  value: Record<string, unknown>,
  field: string,
): string | null {
  if (value[field] === null) return null
  if (!isUuidValue(value[field]))
    return bootstrapProtocolError('invalid_rpc_protocol')

  return value[field]
}

function readProtocolNullableString(
  value: Record<string, unknown>,
  field: string,
): string | null {
  if (value[field] === null) return null
  if (typeof value[field] !== 'string')
    return bootstrapProtocolError('invalid_rpc_protocol')

  return value[field]
}

export function validateBootstrapAccess(
  value: unknown,
  input: BootstrapRpcInput,
): BootstrapAccessEnvelope {
  if (!isRecord(value)) return bootstrapProtocolError('invalid_rpc_protocol')

  const userId = readProtocolNullableUuid(value, 'userId')
  const actorId = readProtocolNullableUuid(value, 'actorId')
  const legacyAnonymousId = readProtocolNullableUuid(value, 'legacyAnonymousId')
  const shareId = readProtocolNullableUuid(value, 'shareId')
  const releaseId = readProtocolNullableUuid(value, 'releaseId')

  const sharePasswordHash = readProtocolNullableString(
    value,
    'sharePasswordHash',
  )

  if (
    value.kind !== input.p_access_kind ||
    userId !== input.p_user_id ||
    (value.actorKind !== null &&
      value.actorKind !== 'user' &&
      value.actorKind !== 'anonymous') ||
    (typeof value.actorKey !== 'string' && value.actorKey !== null) ||
    typeof value.canWrite !== 'boolean' ||
    typeof value.canManageAll !== 'boolean' ||
    !isUuidValue(value.scopeId) ||
    !isPositiveSafeInteger(value.versionId) ||
    !isUuidValue(value.ownerUserId) ||
    (input.p_scope_id !== null && value.scopeId !== input.p_scope_id) ||
    (input.p_version_id !== null && value.versionId !== input.p_version_id)
  ) {
    return bootstrapProtocolError('invalid_rpc_protocol')
  }

  if (input.p_access_kind === 'owner') {
    if (
      userId === null ||
      value.ownerUserId !== userId ||
      value.actorKind !== 'user' ||
      actorId !== userId ||
      value.actorKey !== `user:${userId}` ||
      legacyAnonymousId !== null ||
      shareId !== null ||
      releaseId !== null ||
      sharePasswordHash !== null ||
      value.canWrite !== true ||
      value.canManageAll !== true
    ) {
      return bootstrapProtocolError('invalid_rpc_protocol')
    }
  } else if (input.p_access_kind === 'collaborator') {
    if (
      userId === null ||
      value.actorKind !== 'user' ||
      actorId !== userId ||
      value.actorKey !== `user:${userId}` ||
      legacyAnonymousId !== null ||
      shareId !== null ||
      releaseId !== null ||
      sharePasswordHash !== null ||
      value.canWrite !== (input.p_collaborator_role === 'editor') ||
      value.canManageAll !== false
    ) {
      return bootstrapProtocolError('invalid_rpc_protocol')
    }
  } else {
    if (
      shareId !== input.p_share_id ||
      releaseId !== input.p_release_id ||
      value.canManageAll !== false
    ) {
      return bootstrapProtocolError('invalid_rpc_protocol')
    }
    if (userId !== null) {
      if (
        value.actorKind !== 'user' ||
        actorId !== userId ||
        value.actorKey !== `user:${userId}` ||
        (legacyAnonymousId !== null &&
          legacyAnonymousId !== input.p_anonymous_id)
      ) {
        return bootstrapProtocolError('invalid_rpc_protocol')
      }
    } else if (input.p_anonymous_id !== null) {
      if (
        value.actorKind !== 'anonymous' ||
        actorId !== input.p_anonymous_id ||
        value.actorKey !== `anonymous:${input.p_anonymous_id}` ||
        legacyAnonymousId !== null
      ) {
        return bootstrapProtocolError('invalid_rpc_protocol')
      }
    } else if (
      value.actorKind !== null ||
      actorId !== null ||
      value.actorKey !== null ||
      legacyAnonymousId !== null
    ) {
      return bootstrapProtocolError('invalid_rpc_protocol')
    }
  }

  return {
    kind: input.p_access_kind,
    userId,
    actorKind:
      value.actorKind === 'user' || value.actorKind === 'anonymous'
        ? value.actorKind
        : null,
    actorId,
    actorKey: typeof value.actorKey === 'string' ? value.actorKey : null,
    legacyAnonymousId,
    canWrite: value.canWrite,
    canManageAll: value.canManageAll,
    scopeId: value.scopeId,
    versionId: value.versionId,
    ownerUserId: value.ownerUserId,
    shareId,
    releaseId,
    sharePasswordHash,
  }
}
