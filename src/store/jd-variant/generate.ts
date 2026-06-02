import type { StoreApi } from 'zustand'
import type { JdVariantStore, VariantTask } from './types'
import type { GenerateVariantArgs } from '@/components/jd-variant/types'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import { MAX_KEYWORDS, MAX_VARIANT_DEPTH, MIN_KEYWORDS } from '@/components/jd-variant/const'
import { buildEditableView, computeMatchRate } from '@/components/jd-variant/utils/editable-view'
import { parseVariantResponse } from '@/components/jd-variant/utils/parse-response'
import { parseLlmJsonObject, runJdVariantParse, runJdVariantRewrite } from '@/lib/llm'
import {
  applyOfflineVariantChanges,
  cloneOfflineResumeAsDraft,
  deleteOfflineDraftVariant,
  fetchOfflineVariantTree,
  getOfflineResumeById,
  isOfflineResumeId,
  markOfflineVariantFailed,
  markOfflineVariantReady,
} from '@/lib/offline-resume-manager'
import {
  applyVariantChanges,
  cloneResumeAsDraft,
  deleteDraftVariant,
  fetchVariantTree,
  getResumeById,
  markVariantFailed,
  markVariantReady,
} from '@/lib/supabase/resume'
import { makeIdleTask } from './types'

type SetState = StoreApi<JdVariantStore>['setState']
type GetState = StoreApi<JdVariantStore>['getState']

const controllers = new Map<string, AbortController>()

function makePatch(set: SetState) {
  return (parentResumeId: string, partial: Partial<VariantTask>) => {
    set(s => ({
      tasks: {
        ...s.tasks,
        [parentResumeId]: { ...(s.tasks[parentResumeId] ?? makeIdleTask(parentResumeId)), ...partial },
      },
    }))
  }
}

interface OfflineResumeRecord {
  resume_id: string
  display_name?: string
  data: PersistedResumeSnapshot
}

interface CloudResumeRecord extends PersistedResumeSnapshot {
  resume_id: string
  display_name?: string
}

function computeDepth(
  root: { resumeId: string, children: { resumeId: string, children: unknown[] }[] },
  targetId: string,
  d = 0,
): number {
  if (root.resumeId === targetId)
    return d
  for (const c of root.children) {
    const r = computeDepth(c as typeof root, targetId, d + 1)
    if (r >= 0)
      return r
  }
  return -1
}

export function createStartGenerate(set: SetState, get: GetState) {
  const patch = makePatch(set)

  return async (args: GenerateVariantArgs) => {
    const { parentResumeId } = args
    controllers.get(parentResumeId)?.abort()
    const ctrl = new AbortController()
    controllers.set(parentResumeId, ctrl)
    patch(parentResumeId, { ...makeIdleTask(parentResumeId), phase: 'parsing' })

    try {
      // E4: 深度检查
      try {
        const fetcher = isOfflineResumeId(args.parentResumeId) ? fetchOfflineVariantTree : fetchVariantTree
        const lineage = await fetcher(args.parentResumeId)
        const depth = computeDepth(lineage.root, args.parentResumeId)
        if (depth >= MAX_VARIANT_DEPTH) {
          throw new Error(`派生层级过深（已达 ${MAX_VARIANT_DEPTH} 层），请基于原始简历派生`)
        }
      }
      catch (depthErr) {
        if (depthErr instanceof Error && depthErr.message.includes('派生层级过深')) {
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
        const parsed = parseLlmJsonObject<{ keywords?: unknown, summary?: unknown }>(content)
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
      if (isOffline) {
        const offlineParent = await getOfflineResumeById(args.parentResumeId) as OfflineResumeRecord | undefined
        if (!offlineParent) {
          throw new Error('源简历不存在')
        }
        parentSnapshot = offlineParent.data
        parentDisplayName = offlineParent.display_name
      }
      else {
        const cloudParent = await getResumeById<CloudResumeRecord>(args.parentResumeId)
        if (!cloudParent) {
          throw new Error('源简历不存在')
        }
        parentSnapshot = cloudParent
        parentDisplayName = cloudParent.display_name
      }

      // 创建草稿
      const draftId = isOffline
        ? await cloneOfflineResumeAsDraft({
            parentResumeId: args.parentResumeId,
            jdText: args.jdText,
            keywords,
            summary,
          })
        : await cloneResumeAsDraft({
            parent: { ...parentSnapshot, resume_id: args.parentResumeId, display_name: parentDisplayName },
            jdText: args.jdText,
            keywords,
            summary,
          })
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
            const partial = parseVariantResponse(content ?? '', { strict: false })
            next.completedSections = Array.from(new Set(partial.changes.map(c => c.section)))
            next.changes = partial.changes
          }
          catch {
            /* ignore partial errors */
          }
          patch(parentResumeId, next)
        },
        { abortController: ctrl },
      )
      if (ctrl.signal.aborted) {
        return
      }

      const { changes } = parseVariantResponse(rewriteRaw, { strict: true })

      // 应用 + 标记 ready
      let finalSnapshot: PersistedResumeSnapshot = parentSnapshot
      if (isOffline) {
        await applyOfflineVariantChanges(draftId, changes)
      }
      else {
        finalSnapshot = await applyVariantChanges(draftId, parentSnapshot, changes)
      }
      const matchRate = computeMatchRate(keywords, finalSnapshot)
      const generatedAt = new Date().toISOString()
      if (isOffline) {
        await markOfflineVariantReady(draftId, { matchRate, generatedAt, changes, keywords })
      }
      else {
        await markVariantReady(draftId, { matchRate, generatedAt, changes, keywords })
      }

      patch(parentResumeId, { phase: 'success', changes, matchRate })
    }
    catch (err) {
      if (ctrl.signal.aborted) {
        return
      }
      const message = err instanceof Error ? err.message : '派生失败'
      const draftResumeId = get().tasks[parentResumeId]?.draftResumeId
      if (draftResumeId) {
        const fail = isOfflineResumeId(draftResumeId) ? markOfflineVariantFailed : markVariantFailed
        fail(draftResumeId, message).catch(() => undefined)
      }
      patch(parentResumeId, { phase: 'error', errorMessage: message })
    }
    finally {
      if (controllers.get(parentResumeId) === ctrl) {
        controllers.delete(parentResumeId)
      }
    }
  }
}

export function createAbortTask(set: SetState, get: GetState) {
  const patch = makePatch(set)

  return (parentResumeId: string) => {
    controllers.get(parentResumeId)?.abort()
    controllers.delete(parentResumeId)
    const draftResumeId = get().tasks[parentResumeId]?.draftResumeId
    if (draftResumeId) {
      const fail = isOfflineResumeId(draftResumeId) ? markOfflineVariantFailed : markVariantFailed
      fail(draftResumeId, '已取消').catch(() => undefined)
    }
    patch(parentResumeId, { phase: 'aborted' })
  }
}

export function createDiscardTask(set: SetState, get: GetState) {
  return async (parentResumeId: string) => {
    const draftResumeId = get().tasks[parentResumeId]?.draftResumeId
    controllers.get(parentResumeId)?.abort()
    controllers.delete(parentResumeId)
    if (draftResumeId) {
      if (isOfflineResumeId(draftResumeId)) {
        await deleteOfflineDraftVariant(draftResumeId)
      }
      else {
        await deleteDraftVariant(draftResumeId)
      }
    }
    set((s) => {
      const next = { ...s.tasks }
      delete next[parentResumeId]
      return { tasks: next }
    })
  }
}

export function createClearTask(set: SetState, _get: GetState) {
  return (parentResumeId: string) => {
    controllers.get(parentResumeId)?.abort()
    controllers.delete(parentResumeId)
    set((s) => {
      const next = { ...s.tasks }
      delete next[parentResumeId]
      return { tasks: next }
    })
  }
}
