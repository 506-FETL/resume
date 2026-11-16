import type { AdminClient, ResolvedAccess, SyncRelocation } from './types.ts'
import type { CommentApiOp } from '../shared/resume-comment-schema.ts'
import {
  CommentApiError,
  readRequestId,
  readRequiredString,
  readNonNegativeInteger,
  isRecord,
} from '../shared/resume-comment-schema.ts'
import type {
  CommentAnchorDocumentNode,
  ResumeCommentAnchor,
} from '../shared/resume-comment-core.ts'
import {
  sha256Hex,
  stableStringify,
  relocateResumeCommentAnchor,
} from '../shared/resume-comment-core.ts'
import { readReplay, enforceRateLimit } from './write-access.ts'
import { loadThreads, loadThreadCounts } from './queries.ts'
import { loadPersistedResumeSnapshot } from './scope-repository.ts'
import { scheduleBackground } from '../shared/operation-metrics.ts'
import { notifyWrite, resolveCommentEventType } from './events.ts'

export async function syncCommentDocument({
  req,
  admin,
  body,
  access,
  op,
  anonymousPepper,
  realtimeSecret,
  success,
}: {
  req: Request
  admin: AdminClient
  body: Record<string, unknown>
  access: ResolvedAccess
  op: CommentApiOp
  anonymousPepper: string
  realtimeSecret: string
  success: (data: unknown, eventSeq: number) => Response
}): Promise<Response> {
  if (
    access.kind !== 'owner' ||
    !access.userId ||
    access.scope.kind !== 'version' ||
    access.scope.version_id == null
  ) {
    throw new CommentApiError(
      'unauthorized',
      '只有简历所有者可以同步评论文档',
      403,
    )
  }

  const requestId = readRequestId(body)
  const anchorDocument = body.anchorDocument
  const documentHash = readRequiredString(body, 'documentHash', 64)

  const projectionReferenceDate = readRequiredString(
    body,
    'projectionReferenceDate',
    10,
  )

  const expectedDocumentRevision = readNonNegativeInteger(
    body,
    'expectedDocumentRevision',
  )

  if (
    !isRecord(anchorDocument) ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(projectionReferenceDate) ||
    !/^[0-9a-f]{64}$/u.test(documentHash) ||
    sha256Hex(stableStringify(anchorDocument)) !== documentHash ||
    anchorDocument.projectionReferenceDate !== projectionReferenceDate
  ) {
    throw new CommentApiError('stale_document', '简历评论文档校验失败', 409)
  }

  const replay = await readReplay(admin, access.actorKey!, requestId)

  if (replay) {
    if (!isRecord(replay))
      throw new CommentApiError('unexpected', '评论文档同步响应无效', 500)

    const eventSeq = Number(replay.eventSeq)

    const [{ threads, profiles }, counts] = await Promise.all([
      loadThreads(admin, access.scope.id),
      loadThreadCounts(admin, access.scope.id),
    ])

    return success(
      {
        ...replay,
        threads,
        profiles,
        counts,
        event: {
          event_seq: eventSeq,
          thread_id: null,
          type: 'document_synced',
          created_at: new Date().toISOString(),
          is_own: true,
        },
      },
      eventSeq,
    )
  }

  await enforceRateLimit({
    req,
    admin,
    access,
    threadId: null,
    pepper: anonymousPepper,
  })

  const [{ data: threadRows, error: threadError }, snapshot] =
    await Promise.all([
      admin
        .from('resume_comment_threads')
        .select('id,anchor')
        .eq('scope_id', access.scope.id)
        .eq('anchor_status', 'anchored')
        .is('deleted_at', null)
        .is('resolved_at', null),
      loadPersistedResumeSnapshot(admin, access.userId, access.scope.resume_id),
    ])

  if (threadError) throw threadError

  const nodeMap = new Map<string, CommentAnchorDocumentNode>(
    (Array.isArray(anchorDocument.nodes) ? anchorDocument.nodes : [])
      .filter(isRecord)
      .map((node) => [
        String(node.nodeKey),
        node as unknown as CommentAnchorDocumentNode,
      ]),
  )

  const relocations: SyncRelocation[] = []

  for (const thread of threadRows ?? []) {
    const anchor = thread.anchor as ResumeCommentAnchor

    const result = relocateResumeCommentAnchor(
      anchor,
      nodeMap.get(anchor.nodeKey),
      documentHash,
    )

    if (result.status === 'detached') {
      relocations.push({ threadId: thread.id, ...result })
      continue
    }
    if (!result.moved && !result.contextChanged) {
      continue
    }

    relocations.push({ threadId: thread.id, ...result })
  }

  const { data, error } = await admin.rpc(
    'sync_resume_version_comment_document_v3',
    {
      p_scope_id: access.scope.id,
      p_version_id: access.versionId,
      p_owner_user_id: access.userId,
      p_snapshot: snapshot,
      p_anchor_document: anchorDocument,
      p_document_hash: documentHash,
      p_expected_document_revision: expectedDocumentRevision,
      p_projection_reference_date: projectionReferenceDate,
      p_relocations: relocations,
      p_actor_key: access.actorKey,
      p_request_id: requestId,
    },
  )

  if (error) throw error

  scheduleBackground(
    notifyWrite({
      admin,
      access,
      realtimeSecret,
      eventSeq: Number(data.eventSeq),
      type: resolveCommentEventType(op),
    }),
  )

  const eventSeq = Number(data.eventSeq)

  const [{ threads, profiles }, counts] = await Promise.all([
    loadThreads(
      admin,
      access.scope.id,
      relocations.map((relocation) => relocation.threadId),
    ),
    loadThreadCounts(admin, access.scope.id),
  ])

  return success(
    {
      ...data,
      threads,
      profiles,
      counts,
      event: {
        event_seq: eventSeq,
        thread_id: null,
        type: 'document_synced',
        created_at: new Date().toISOString(),
        is_own: true,
      },
    },
    eventSeq,
  )
}
