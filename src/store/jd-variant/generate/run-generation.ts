import {
  MAX_KEYWORDS,
  MAX_VARIANT_DEPTH,
  MIN_KEYWORDS,
} from '@/components/jd-variant/const'
import type { GenerateVariantArgs } from '@/components/jd-variant/types'
import {
  buildEditableView,
  computeMatchRate,
} from '@/components/jd-variant/utils/editable-view'
import { parseVariantResponse } from '@/components/jd-variant/utils/parse-response'
import {
  parseLlmJsonObject,
  runJdVariantParse,
  runJdVariantRewrite,
} from '@/lib/llm'
import {
  applyOfflineVariantChanges,
  cloneOfflineResumeAsDraft,
  fetchOfflineVariantTree,
  getOfflineResumeById,
  isOfflineResumeId,
  markOfflineVariantReady,
} from '@/lib/offline-resume-manager'
import {
  derivedEvidence,
  flushPendingEvidence,
} from '@/lib/resume-preparation/evidence'
import {
  completeDerivedPreparation,
  loadPreparation,
  reserveDerivedPreparationId,
  updatePreparation,
} from '@/lib/resume-preparation/storage'
import type { PersistedResumeSnapshot, VariantMetadata } from '@/lib/schema'
import {
  applyVariantChanges,
  cloneResumeAsDraft,
  fetchVariantTree,
  getResumeById,
  markVariantReady,
} from '@/lib/supabase/resume'
import type { VariantTask } from '../types'
import { makeIdleTask } from '../types'
import type {
  CloudResumeRecord,
  GetState,
  OfflineResumeRecord,
} from './task-state'
import { computeDepth, type makePatch } from './task-state'

export async function runGeneration(
  args: GenerateVariantArgs,
  get: GetState,
  patch: ReturnType<typeof makePatch>,
  ctrl: AbortController,
  ownerId: string | null,
  assertOwner: () => void,
) {
  const { parentResumeId } = args

  // E4: 深度检查
  try {
    const fetcher = isOfflineResumeId(args.parentResumeId)
      ? fetchOfflineVariantTree
      : fetchVariantTree

    const lineage = await fetcher(args.parentResumeId)
    const depth = computeDepth(lineage.root, args.parentResumeId)

    if (depth >= MAX_VARIANT_DEPTH) {
      throw new Error(
        `派生层级过深（已达 ${MAX_VARIANT_DEPTH} 层），请基于原始简历派生`,
      )
    }
  } catch (depthErr) {
    if (
      depthErr instanceof Error &&
      depthErr.message.includes('派生层级过深')
    ) {
      throw depthErr
    }
  }

  // Phase 1: parse JD（or reuse keywords）
  let keywords: string[] = args.reuseKeywords ?? []
  let summary: string | undefined

  if (keywords.length === 0) {
    const { content } = await runJdVariantParse(
      args.jdText,
      ({ content: c, reasoning }) => {
        const cur = get().tasks[parentResumeId] ?? makeIdleTask(parentResumeId)

        patch(parentResumeId, {
          parseReasoning: reasoning ?? cur.parseReasoning,
          rewriteContent: c ?? cur.rewriteContent,
        })
      },
      { abortController: ctrl },
    )

    if (ctrl.signal.aborted) {
      return
    }

    const parsed = parseLlmJsonObject<{
      keywords?: unknown
      summary?: unknown
    }>(content)

    const ks = Array.isArray(parsed.keywords)
      ? parsed.keywords.filter((x): x is string => typeof x === 'string')
      : []

    if (ks.length < MIN_KEYWORDS) {
      throw new Error('JD 关键词太少，请粘贴更完整的 JD')
    }

    keywords = Array.from(new Set(ks)).slice(0, MAX_KEYWORDS)

    summary = typeof parsed.summary === 'string' ? parsed.summary : undefined
  }

  patch(parentResumeId, { keywords })

  // 取 parent snapshot
  const isOffline = isOfflineResumeId(args.parentResumeId)
  let parentSnapshot: PersistedResumeSnapshot
  let parentDisplayName: string | undefined
  let parentMetadata: VariantMetadata | null | undefined

  if (isOffline) {
    const offlineParent = (await getOfflineResumeById(args.parentResumeId)) as
      | OfflineResumeRecord
      | undefined

    if (!offlineParent) {
      throw new Error('源简历不存在')
    }

    parentMetadata = offlineParent.derived_metadata
    parentSnapshot = offlineParent.data
    parentDisplayName = offlineParent.display_name
  } else {
    const cloudParent = await getResumeById<CloudResumeRecord>(
      args.parentResumeId,
    )

    if (!cloudParent) {
      throw new Error('源简历不存在')
    }

    parentMetadata = cloudParent.derived_metadata
    parentSnapshot = cloudParent
    parentDisplayName = cloudParent.display_name
  }

  // 先读取并保存来源；失败时还没有创建正文副本。重试沿用同一草稿身份。
  assertOwner()
  await flushPendingEvidence(parentResumeId, ownerId)

  const sourceRecord = await loadPreparation(parentResumeId, ownerId)

  const retryKey = JSON.stringify([
    ownerId,
    parentResumeId,
    args.jdText,
    args.reuseKeywords ?? null,
  ])

  const draftId = await reserveDerivedPreparationId(retryKey, isOffline)

  assertOwner()

  await updatePreparation(draftId, ownerId, () => ({
    ...sourceRecord,
    evidence: [
      ...new Map(
        [
          ...sourceRecord.evidence,
          ...derivedEvidence(parentMetadata, parentSnapshot),
        ].map((item) => [item.id, item]),
      ).values(),
    ],
    resolutions: { ...sourceRecord.resolutions },
  }))

  assertOwner()
  patch(parentResumeId, { draftResumeId: draftId })

  if (isOffline)
    await cloneOfflineResumeAsDraft({
      draftId,
      parentResumeId: args.parentResumeId,
      jdText: args.jdText,
      keywords,
      summary,
    })
  else
    await cloneResumeAsDraft({
      draftId,
      expectedOwner: ownerId ?? undefined,
      parent: {
        ...parentSnapshot,
        resume_id: args.parentResumeId,
        display_name: parentDisplayName,
      },
      jdText: args.jdText,
      keywords,
      summary,
    })

  assertOwner()

  patch(parentResumeId, { draftResumeId: draftId, phase: 'rewriting' })

  // Phase 2: rewrite
  const editable = buildEditableView(parentSnapshot)

  const { content: rewriteRaw } = await runJdVariantRewrite(
    { resumeJson: editable, jdText: args.jdText, keywords },
    ({ content, reasoning }) => {
      const cur = get().tasks[parentResumeId] ?? makeIdleTask(parentResumeId)

      const next: Partial<VariantTask> = {
        rewriteContent: content ?? cur.rewriteContent,
        rewriteReasoning: reasoning ?? cur.rewriteReasoning,
      }

      try {
        const partial = parseVariantResponse(content ?? '', {
          strict: false,
        })

        next.completedSections = Array.from(
          new Set(partial.changes.map((c) => c.section)),
        )

        next.changes = partial.changes
      } catch {
        /* ignore partial errors */
      }

      patch(parentResumeId, next)
    },
    { abortController: ctrl },
  )

  if (ctrl.signal.aborted) {
    return
  }

  const { changes } = parseVariantResponse(rewriteRaw, {
    strict: true,
    snapshot: parentSnapshot,
  })

  assertOwner()

  // 应用 + 标记 ready
  let finalSnapshot: PersistedResumeSnapshot = parentSnapshot

  if (isOffline) {
    finalSnapshot = (await applyOfflineVariantChanges(
      draftId,
      changes,
    )) as PersistedResumeSnapshot
  } else {
    finalSnapshot = await applyVariantChanges(
      draftId,
      parentSnapshot,
      changes,
      ownerId ?? undefined,
    )
  }

  assertOwner()

  const matchRate = computeMatchRate(keywords, finalSnapshot)
  const generatedAt = new Date().toISOString()

  if (isOffline) {
    await markOfflineVariantReady(draftId, {
      matchRate,
      generatedAt,
      changes,
      keywords,
    })
  } else {
    await markVariantReady(draftId, {
      expectedOwner: ownerId ?? undefined,
      matchRate,
      generatedAt,
      changes,
      keywords,
    })
  }

  assertOwner()
  // 清理失败仍保留稳定映射，后续重试查询既有草稿，不重复创建。
  await completeDerivedPreparation(retryKey).catch(() => undefined)

  patch(parentResumeId, { phase: 'success', changes, matchRate })
}
