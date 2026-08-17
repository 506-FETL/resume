import type {
  CollaborationCommentAccess,
  CollaborationConnectionPhase,
  CreateSessionCallbacks,
  SessionActivationOptions,
} from './types'
import type { DocumentManager } from '@/lib/automerge'
import supabase from '@/lib/supabase/client'
import { buildCollaborationRoomName, buildCollaborationShareUrl, getParticipantColor } from '../shared'

interface EnableSessionOptions extends SessionActivationOptions {
  createCallbacks: CreateSessionCallbacks
  getDocumentManager: () => DocumentManager | null
  onPhaseChange?: (phase: Exclude<CollaborationConnectionPhase, null>) => void
}

export async function enableCollaborationSession(options: EnableSessionOptions) {
  const {
    sessionId,
    resumeId,
    userId,
    userName,
    role,
    shouldSaveSnapshot = false,
    getState,
    setState,
    createCallbacks,
    getDocumentManager,
    onPhaseChange,
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
  })

  const adapter = await docManager.enableCollaboration(sessionId, callbacks)
  adapterPeerIdRef.current = adapter.peerId || null

  if (shouldSaveSnapshot && docManager.getHandle()) {
    onPhaseChange?.('syncing')
    await docManager.saveToSupabase(docManager.getHandle())
  }

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
  input: { sessionId: string, resumeId: string, hostLeaseId?: string },
): Promise<T> {
  const { data: sessionResult } = await supabase.auth.getSession()
  if (!sessionResult.session) {
    throw new Error('请先登录后再使用实时协作评论')
  }
  const { data, error } = await supabase.functions.invoke('resume-comments', {
    body: { op, ...input },
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
  return callCollaborationCommentOperation<{
    sessionId: string
    resumeId: string
    expiresAt: string
    hostLeaseId: string
  }>('register_collaboration_session', input)
}

export function joinCollaborationCommentSession(input: {
  sessionId: string
  resumeId: string
}) {
  return callCollaborationCommentOperation<CollaborationCommentAccess>(
    'join_collaboration_session',
    input,
  )
}

export function renewCollaborationCommentSession(input: {
  sessionId: string
  resumeId: string
}) {
  return callCollaborationCommentOperation<CollaborationCommentAccess>(
    'renew_collaboration_session',
    input,
  )
}

export async function leaveCollaborationCommentSession(input: {
  sessionId: string
  resumeId: string
  hostLeaseId?: string
}) {
  await callCollaborationCommentOperation<{ sessionId: string, revoked: boolean }>(
    'leave_collaboration_session',
    input,
  )
}
