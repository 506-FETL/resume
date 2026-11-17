import type { AiMessage } from '../types'
import type { ContextOptions } from './context-events'
import type { ExperienceSourceRelation } from '@/lib/experience-sources/types'
import { isOfflineResumeId } from '@/lib/offline-resume-manager'
import { resolveActiveResumeId } from '../active-resume'
import { getExperienceRelations } from '@/lib/experience-sources/api'
import { listMessages } from '@/lib/supabase/ai/messages'
import {
  readContextCheckpoint,
  saveContextCheckpoint,
} from '@/lib/supabase/ai/context'
import {
  CONTEXT_BUDGET,
  contextFitsRequest,
  contextNeedsCompaction,
  estimateContextTokens,
} from './context-budget'
import { summarizeContext, summaryFitsRequest } from './compact-context'
import { toModelMessages } from './to-model-messages'

export async function readConversationSources(
  conversationId: string,
  signal: AbortSignal,
  options: { resumeId?: string | null } = {},
): Promise<ExperienceSourceRelation[]> {
  const resumeId =
    options.resumeId === undefined ? resolveActiveResumeId() : options.resumeId

  const [conversation, resume] = await Promise.all([
    getExperienceRelations({
      target: 'conversation',
      targetId: conversationId,
      signal,
    }),
    resumeId && !isOfflineResumeId(resumeId)
      ? getExperienceRelations({ target: 'resume', targetId: resumeId, signal })
      : Promise.resolve([]),
  ])

  return [
    ...new Map(
      [...resume, ...conversation].map((reference) => [
        reference.sourceId,
        reference,
      ]),
    ).values(),
  ]
}

export async function prepareConversationContext(
  conversationId: string,
  signal: AbortSignal,
  options: ContextOptions & {
    resumeId?: string | null
    sources?: ExperienceSourceRelation[]
    forceCompaction?: boolean
  } = {},
) {
  const targetResumeId =
    options.resumeId === undefined ? resolveActiveResumeId() : options.resumeId

  const [checkpoint, sources] = await Promise.all([
    readContextCheckpoint(conversationId, signal),
    options.sources ?? readConversationSources(conversationId, signal, options),
  ])

  const sourceVersions = sources.map((reference) => ({
    id: reference.sourceId,
    versionId: reference.versionId,
    currentVersionId: reference.currentVersionId,
    updatedAt: reference.updatedAt,
  }))

  const fingerprint = JSON.stringify({
    sourceProjectionVersion: 3,
    resumeId: targetResumeId,
    sources: sourceVersions.sort((a, b) => a.id.localeCompare(b.id)),
  })

  const reusable =
    checkpoint?.source_fingerprint === fingerprint ? checkpoint : null

  const after = reusable
    ? {
        id: reusable.boundary_message_id,
        createdAt: reusable.boundary_created_at,
      }
    : undefined

  let messages: AiMessage[] = []
  let before: AiMessage | undefined

  while (true) {
    signal.throwIfAborted()

    const page = await listMessages(conversationId, {
      limit: 100,
      before,
      after,
      signal,
    })

    messages = [...page.messages, ...messages]

    if (!page.hasMore) break

    before = page.messages[0]
  }

  let summary = reusable?.summary
  let compactionFailed = false
  let compactedMessageCount = 0

  while (
    options.forceCompaction ||
    contextNeedsCompaction(
      toModelMessages(messages, undefined, summary, sources, targetResumeId),
    )
  ) {
    const boundaries = messages.flatMap((message, index) =>
      message.role === 'user' ? [index] : [],
    )

    const keepFrom =
      boundaries[
        Math.max(
          options.forceCompaction ? 0 : 1,
          boundaries.length - CONTEXT_BUDGET.recentTurns,
        )
      ]

    if (!keepFrom) {
      if (
        contextFitsRequest(
          toModelMessages(
            messages,
            undefined,
            summary,
            sources,
            targetResumeId,
          ),
        )
      )
        break

      throw new Error(
        '这一轮材料超出可处理范围，请缩短正文或改为引用职业档案。原消息已保存。',
      )
    }

    let end = keepFrom

    // 每次摘要请求也遵守入口限制，且边界只能落在完整用户轮次之间。
    for (const boundary of boundaries.filter(
      (index) => index > 0 && index <= keepFrom,
    )) {
      const candidate = toModelMessages(
        messages.slice(0, boundary),
        undefined,
        undefined,
        sources,
        targetResumeId,
      ).filter((message) => message.role !== 'system')

      if (
        contextNeedsCompaction(candidate) ||
        !summaryFitsRequest(candidate, summary)
      ) {
        const previous = boundaries
          .filter((index) => index > 0 && index < boundary)
          .at(-1)

        end = previous ?? boundary
        break
      }
    }

    const earlier = messages.slice(0, end)

    const material = toModelMessages(
      earlier,
      undefined,
      undefined,
      sources,
      targetResumeId,
    ).filter((message) => message.role !== 'system')

    if (new TextEncoder().encode(JSON.stringify(material)).byteLength > 800_000)
      throw new Error(
        '历史中有一轮材料过长，无法完整整理。请新建对话并引用资料，原记录仍保留。',
      )

    const boundary = earlier[earlier.length - 1]
    const started = performance.now()

    const detail = {
      scope: 'history' as const,
      messageCount: earlier.length,
      boundaryMessageId: boundary.id,
      estimatedTokens: estimateContextTokens(material),
    }

    options.onCompaction?.({ ...detail, phase: 'start' })

    try {
      summary = await summarizeContext(material, summary, signal)
    } catch (error) {
      const fallback =
        !options.forceCompaction &&
        !signal.aborted &&
        contextFitsRequest(
          toModelMessages(
            messages,
            undefined,
            summary,
            sources,
            targetResumeId,
          ),
        )

      options.onCompaction?.({
        ...detail,
        phase: 'failed',
        durationMs: performance.now() - started,
        fallback,
      })

      if (fallback) {
        compactionFailed = true
        break
      }

      throw error
    }

    await saveContextCheckpoint(
      conversationId,
      boundary,
      summary,
      fingerprint,
      estimateContextTokens(material),
      signal,
    )

    messages = messages.slice(end)
    compactedMessageCount += earlier.length

    options.onCompaction?.({
      ...detail,
      phase: 'complete',
      durationMs: performance.now() - started,
    })
  }

  return {
    messages,
    summary,
    sources,
    compactionFailed,
    compactedMessageCount,
    estimatedTokens: estimateContextTokens(
      toModelMessages(messages, undefined, summary, sources, targetResumeId),
    ),
  }
}
