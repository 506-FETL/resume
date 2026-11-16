import { CommentApiError, isRecord } from '../shared/resume-comment-schema.ts'
import type { CollaborationMemberRow } from './types.ts'
import { isUuidValue, COLLABORATION_SESSION_PATTERN } from './validation.ts'

export function readCollaborationProtocolVersion(
  body: Record<string, unknown>,
): 1 | 2 {
  if (body.protocolVersion === undefined) return 1
  if (body.protocolVersion === 1 || body.protocolVersion === 2)
    return body.protocolVersion

  throw new CommentApiError('not_found', '协作协议版本无效', 400)
}

export function readSupportedCollaborationProtocolVersions(
  body: Record<string, unknown>,
): ReadonlySet<1 | 2> {
  if (body.supportedProtocolVersions === undefined) return new Set()
  if (
    !Array.isArray(body.supportedProtocolVersions) ||
    body.supportedProtocolVersions.length === 0 ||
    body.supportedProtocolVersions.some((value) => value !== 1 && value !== 2)
  ) {
    throw new CommentApiError('not_found', '协作协议能力声明无效', 400)
  }

  return new Set(body.supportedProtocolVersions as Array<1 | 2>)
}

export function allowNewLegacyCollaborationSession() {
  const rawCutoff = Deno.env
    .get('COLLABORATION_LEGACY_REGISTER_CUTOFF_AT')
    ?.trim()

  if (!rawCutoff) return true

  const cutoffAt = Date.parse(rawCutoff)

  if (!Number.isFinite(cutoffAt)) {
    throw new CommentApiError('unexpected', '协作兼容截止时间配置无效', 500)
  }

  return Date.now() < cutoffAt
}

export function negotiateCollaborationProtocolVersion(
  requested: 1 | 2,
  supported: ReadonlySet<1 | 2>,
  existing: 1 | 2,
) {
  if (requested === existing || supported.has(existing)) return existing

  throw new CommentApiError('unauthorized', '协作协议版本不匹配', 401)
}

export function throwCollaborationRpcError(error: unknown): never {
  if (
    isRecord(error) &&
    typeof error.code === 'string' &&
    typeof error.message === 'string'
  ) {
    const mapping: Record<string, CommentApiError> = {
      '42501:unauthorized': new CommentApiError(
        'unauthorized',
        '协作会话已结束或不存在',
        401,
      ),
      'P0409:owner_must_host': new CommentApiError(
        'owner_must_host',
        '简历所有者应恢复为协作发起者',
        409,
      ),
      'P0409:collaboration_session_conflict': new CommentApiError(
        'collaboration_session_conflict',
        '协作会话标识已被占用',
        409,
      ),
      'P0409:session_id_retired': new CommentApiError(
        'session_id_retired',
        '协作会话标识已永久失效，请重新开启协作',
        409,
      ),
      'P0409:member_protocol_conflict': new CommentApiError(
        'member_protocol_conflict',
        '协作协议版本冲突',
        409,
      ),
      'P0409:member_lease_conflict': new CommentApiError(
        'member_lease_conflict',
        '该账号已在另一窗口加入此协作',
        409,
      ),
      'P0409:member_lease_retired': new CommentApiError(
        'member_lease_retired',
        '协作者成员租约已失效，请重新打开邀请',
        409,
      ),
      'P0409:attempt_limit': new CommentApiError(
        'attempt_limit',
        '协作者加入尝试过多，请稍后重新分享',
        409,
      ),
      'P0409:upgrade_required': new CommentApiError(
        'upgrade_required',
        '请刷新页面后重新开启实时协作',
        426,
      ),
      '22023:invalid_collaboration_claim': new CommentApiError(
        'not_found',
        '协作会话参数无效',
        400,
      ),
      '22023:invalid_member_claim': new CommentApiError(
        'not_found',
        '协作者成员租约无效',
        400,
      ),
    }

    const mapped = mapping[`${error.code}:${error.message}`]

    if (mapped) throw mapped
  }

  throw error
}

export function readClaimedMember(value: unknown): CollaborationMemberRow {
  if (
    !isRecord(value) ||
    !isUuidValue(value.userId) ||
    !isUuidValue(value.memberLeaseId) ||
    typeof value.sessionId !== 'string' ||
    !COLLABORATION_SESSION_PATTERN.test(value.sessionId) ||
    (value.protocolVersion !== 1 && value.protocolVersion !== 2) ||
    (value.role !== 'editor' && value.role !== 'viewer') ||
    typeof value.expiresAt !== 'string' ||
    (value.revokedAt !== null && typeof value.revokedAt !== 'string')
  ) {
    throw new Error('Invalid collaboration member claim response')
  }

  return {
    session_id: value.sessionId,
    user_id: value.userId,
    member_lease_id: value.memberLeaseId,
    protocol_version: value.protocolVersion,
    role: value.role,
    expires_at: value.expiresAt,
    revoked_at: value.revokedAt,
  }
}
