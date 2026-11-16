import type {
  BootstrapRpcInput,
  BootstrapRpcResult,
} from './bootstrap-types.ts'
import { isRecord } from '../shared/resume-comment-schema.ts'
import { bootstrapProtocolError } from './bootstrap-errors.ts'
import {
  isUuidValue,
  isPositiveSafeInteger,
  isDateOnly,
  isNonNegativeSafeInteger,
} from './validation.ts'
import { validateBootstrapAccess } from './bootstrap-access.ts'
import { validateBootstrapPayload } from './bootstrap-payload.ts'

export function validateBootstrapRpcResult(
  value: unknown,
  input: BootstrapRpcInput,
): BootstrapRpcResult {
  if (
    !isRecord(value) ||
    value.protocolVersion !== 1 ||
    (value.status !== 'ok' && value.status !== 'scope_missing')
  ) {
    return bootstrapProtocolError('invalid_rpc_protocol')
  }
  if (value.status === 'scope_missing') {
    if (
      input.p_access_kind === 'collaborator' ||
      !isRecord(value.access) ||
      value.access.kind !== input.p_access_kind ||
      (value.access.sharePasswordHash !== null &&
        typeof value.access.sharePasswordHash !== 'string') ||
      (input.p_access_kind === 'owner' &&
        value.access.sharePasswordHash !== null) ||
      !isRecord(value.repair) ||
      !isUuidValue(value.repair.ownerUserId) ||
      !isUuidValue(value.repair.resumeId) ||
      !isPositiveSafeInteger(value.repair.versionId) ||
      !isPositiveSafeInteger(value.repair.documentRevision) ||
      !isRecord(value.repair.snapshot) ||
      !isDateOnly(value.repair.projectionReferenceDate) ||
      (input.p_version_id !== null &&
        value.repair.versionId !== input.p_version_id) ||
      (input.p_resume_id !== null &&
        value.repair.resumeId !== input.p_resume_id) ||
      (input.p_access_kind === 'owner' &&
        value.repair.ownerUserId !== input.p_user_id)
    ) {
      return bootstrapProtocolError('invalid_rpc_protocol')
    }

    return {
      protocolVersion: 1,
      status: 'scope_missing',
      access: {
        kind: input.p_access_kind,
        sharePasswordHash:
          typeof value.access.sharePasswordHash === 'string'
            ? value.access.sharePasswordHash
            : null,
      },
      repair: {
        ownerUserId: value.repair.ownerUserId,
        resumeId: value.repair.resumeId,
        versionId: value.repair.versionId,
        documentRevision: value.repair.documentRevision,
        snapshot: value.repair.snapshot,
        projectionReferenceDate: value.repair.projectionReferenceDate,
      },
    }
  }
  if (!isNonNegativeSafeInteger(value.eventSeq))
    return bootstrapProtocolError('invalid_rpc_protocol')

  const access = validateBootstrapAccess(value.access, input)

  return {
    protocolVersion: 1,
    status: 'ok',
    access,
    bootstrap: validateBootstrapPayload(
      value.bootstrap,
      access,
      value.eventSeq,
    ),
    eventSeq: value.eventSeq,
  }
}
