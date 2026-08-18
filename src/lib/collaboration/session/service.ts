import type {
  CollaborationCommentAccess,
  CollaborationDocumentBootstrap,
  CollaborationGuestAuthorization,
  CreateSessionCallbacks,
  SessionActivationOptions,
} from './types'
import type { DocumentManager } from '@/lib/automerge'
import supabase from '@/lib/supabase/client'
import { buildCollaborationRoomName, buildCollaborationShareUrl, getParticipantColor } from '../shared'

interface EnableSessionOptions extends SessionActivationOptions {
  createCallbacks: CreateSessionCallbacks
  getDocumentManager: () => DocumentManager | null
  isCurrentSession: () => boolean
}

export const COLLABORATION_CONNECTION_TIMEOUT_MS = 12_000
export const COLLABORATION_EDGE_OPERATION_TIMEOUT_MS = 12_000
export const COLLABORATION_PROTOCOL_VERSION = 2 as const

export async function connectDocumentSession(options: EnableSessionOptions) {
  const {
    sessionId,
    resumeId,
    userId,
    userName,
    role,
    getState,
    setState,
    createCallbacks,
    getDocumentManager,
    isCurrentSession,
  } = options

  const docManager = getDocumentManager()

  if (!docManager) {
    throw new Error('文档尚未初始化，无法开启协作')
  }

  const color = getParticipantColor(userId)
  const identity = { userId, userName, color }

  const adapterPeerIdRef = { current: null as string | null }
  const callbacks = createCallbacks({
    role,
    identity,
    getState,
    setState,
    adapterPeerIdRef,
    isCurrentSession,
  })

  const adapter = await docManager.enableCollaboration(sessionId, callbacks)
  adapterPeerIdRef.current = adapter.peerId || null
  let timeout: ReturnType<typeof setTimeout> | null = null

  try {
    await Promise.race([
      adapter.whenReady(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('协作实时频道连接超时')),
          COLLABORATION_CONNECTION_TIMEOUT_MS,
        )
      }),
    ])
  }
  finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }

  if (!adapter.isReady()) {
    throw new Error('协作实时频道在就绪前已断开')
  }
  adapterPeerIdRef.current = adapter.peerId || null

  return {
    sessionId,
    resumeId,
    role,
    self: {
      peerId: adapterPeerIdRef.current,
      ...identity,
    },
    shareUrl: buildCollaborationShareUrl(
      resumeId,
      sessionId,
      docManager.getDocumentUrl() || undefined,
    ),
    roomName: buildCollaborationRoomName(resumeId, sessionId),
  }
}

type CollaborationCommentOperation
  = | 'register_collaboration_session'
    | 'join_collaboration_session'
    | 'renew_collaboration_session'
    | 'leave_collaboration_session'

// 携带后端业务错误码的协作操作错误。supabase.functions.invoke 在非 2xx 时
// 返回的 FunctionsHttpError.message 恒为英文 "Edge Function returned a non-2xx status code"，
// 需从响应体解析出 { code, message } 才能让上层按 code 分支处理并展示中文文案。
export class CollaborationOperationError extends Error {
  code?: string
  status?: number

  constructor(message: string, options: { code?: string, status?: number } = {}) {
    super(message)
    this.name = 'CollaborationOperationError'
    this.code = options.code
    this.status = options.status
  }
}

// 尝试从 FunctionsHttpError 的响应体读取后端返回的 { ok, error: { code, message } }
async function extractOperationError(error: unknown): Promise<CollaborationOperationError> {
  const context = (error as { context?: { json?: () => Promise<unknown>, status?: number } })?.context
  const status = context?.status
  try {
    const body = await context?.json?.()
    const payloadError = (body as { error?: { code?: string, message?: string } })?.error
    if (payloadError?.message) {
      return new CollaborationOperationError(payloadError.message, { code: payloadError.code, status })
    }
  }
  catch {
    // 响应体不是 JSON 或读取失败，回退到友好默认文案
  }
  return new CollaborationOperationError('协作服务暂时不可用，请稍后重试', { status })
}

async function callCollaborationCommentOperation<T>(
  op: CollaborationCommentOperation,
  input: {
    sessionId: string
    resumeId: string
    hostLeaseId?: string
    memberLeaseId?: string
  },
): Promise<T> {
  const { data: sessionResult } = await supabase.auth.getSession()
  if (!sessionResult.session) {
    throw new Error('请先登录后再使用实时协作评论')
  }
  const { data, error } = await supabase.functions.invoke('resume-comments', {
    body: { op, protocolVersion: COLLABORATION_PROTOCOL_VERSION, ...input },
    timeout: COLLABORATION_EDGE_OPERATION_TIMEOUT_MS,
  })
  if (error) {
    throw await extractOperationError(error)
  }
  if (!data?.ok) {
    throw new CollaborationOperationError(data?.error?.message || '协作评论权限校验失败', {
      code: data?.error?.code,
    })
  }
  return data.data as T
}

export async function registerCollaborationCommentSession(input: {
  sessionId: string
  resumeId: string
}) {
  const registration = await callCollaborationCommentOperation<{
    sessionId: string
    resumeId: string
    expiresAt: string
    hostLeaseId: string
    protocolVersion: 2
  }>('register_collaboration_session', input)
  if (registration.protocolVersion !== COLLABORATION_PROTOCOL_VERSION) {
    throw new CollaborationOperationError('协作服务协议版本不匹配', {
      code: 'collaboration_protocol_mismatch',
    })
  }
  return registration
}

export async function joinCollaborationCommentSession(input: {
  sessionId: string
  resumeId: string
  memberLeaseId: string
}): Promise<CollaborationGuestAuthorization> {
  const result = await callCollaborationCommentOperation<
    CollaborationCommentAccess & { bootstrap: CollaborationDocumentBootstrap }
  >(
    'join_collaboration_session',
    input,
  )

  const { bootstrap, ...commentAccess } = result
  if (!bootstrap?.documentData) {
    throw new CollaborationOperationError('协作服务未返回共享简历快照', {
      code: 'collaboration_snapshot_unavailable',
    })
  }
  if (
    commentAccess.protocolVersion !== COLLABORATION_PROTOCOL_VERSION
    || commentAccess.memberLeaseId !== input.memberLeaseId
  ) {
    throw new CollaborationOperationError('协作服务返回的成员租约不匹配', {
      code: 'collaboration_member_lease_mismatch',
    })
  }
  return { commentAccess, bootstrap }
}

export async function renewCollaborationCommentSession(input: {
  sessionId: string
  resumeId: string
  memberLeaseId: string
}) {
  const commentAccess = await callCollaborationCommentOperation<CollaborationCommentAccess>(
    'renew_collaboration_session',
    input,
  )
  if (
    commentAccess.protocolVersion !== COLLABORATION_PROTOCOL_VERSION
    || commentAccess.memberLeaseId !== input.memberLeaseId
  ) {
    throw new CollaborationOperationError('协作服务返回的成员租约不匹配', {
      code: 'collaboration_member_lease_mismatch',
    })
  }
  return commentAccess
}

export async function leaveCollaborationCommentSession(input: {
  sessionId: string
  resumeId: string
  hostLeaseId?: string
  memberLeaseId?: string
}) {
  const result = await callCollaborationCommentOperation<{
    sessionId: string
    revoked: boolean
    protocolVersion: 2
  }>(
    'leave_collaboration_session',
    input,
  )
  if (result.protocolVersion !== COLLABORATION_PROTOCOL_VERSION) {
    throw new CollaborationOperationError('协作服务协议版本不匹配', {
      code: 'collaboration_protocol_mismatch',
    })
  }
  return result
}
