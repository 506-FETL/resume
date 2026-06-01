import type { GenerateVariantArgs, GeneratorState } from './types'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import { useCallback, useEffect, useRef, useState } from 'react'
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
import { MAX_KEYWORDS, MAX_VARIANT_DEPTH, MIN_KEYWORDS } from './const'
import { parseVariantResponse } from './parse-variant-response'
import { buildEditableView, computeMatchRate } from './utils'

const initialState: GeneratorState = {
  phase: 'idle',
  draftResumeId: null,
  keywords: [],
  changes: [],
  completedSections: [],
  errorMessage: null,
  matchRate: 0,
  parseReasoning: '',
  rewriteReasoning: '',
  rewriteContent: '',
  logs: [],
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

export function useJdVariantGenerator() {
  const [state, setState] = useState<GeneratorState>(initialState)
  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => setState(initialState), [])

  const abort = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setState(s => ({ ...s, phase: 'aborted' }))
  }, [])

  useEffect(() => () => abortRef.current?.abort(), [])

  const generate = useCallback(async (args: GenerateVariantArgs) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setState({ ...initialState, phase: 'parsing' })

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
        // 仅当深度异常时抛出；fetchVariantTree 自身错误（无网/无父）跳过让后续步骤报错
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
            setState(s => ({
              ...s,
              parseReasoning: reasoning ?? s.parseReasoning,
              rewriteContent: c ?? s.rewriteContent,
            }))
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
      setState(s => ({ ...s, keywords }))

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
      setState(s => ({ ...s, draftResumeId: draftId, phase: 'rewriting' }))

      // Phase 2: rewrite
      const editable = buildEditableView(parentSnapshot)
      const { content: rewriteRaw } = await runJdVariantRewrite(
        { resumeJson: editable, jdText: args.jdText, keywords },
        ({ content, reasoning }) => {
          setState((s) => {
            const next: Partial<GeneratorState> = {
              rewriteContent: content ?? s.rewriteContent,
              rewriteReasoning: reasoning ?? s.rewriteReasoning,
            }
            try {
              const partial = parseVariantResponse(content ?? '', { strict: false })
              next.completedSections = Array.from(new Set(partial.changes.map(c => c.section)))
              next.changes = partial.changes
            }
            catch {
              /* ignore partial errors */
            }
            return { ...s, ...next }
          })
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

      setState(s => ({ ...s, phase: 'success', changes, matchRate }))
    }
    catch (err) {
      if (ctrl.signal.aborted) {
        return
      }
      const message = err instanceof Error ? err.message : '派生失败'
      setState((s) => {
        if (s.draftResumeId) {
          const isOff = isOfflineResumeId(s.draftResumeId)
          const fail = isOff ? markOfflineVariantFailed : markVariantFailed
          fail(s.draftResumeId, message).catch(() => undefined)
        }
        return { ...s, phase: 'error', errorMessage: message }
      })
    }
    finally {
      if (abortRef.current === ctrl) {
        abortRef.current = null
      }
    }
  }, [])

  const discardDraft = useCallback(async () => {
    const id = state.draftResumeId
    if (!id) {
      return
    }
    if (isOfflineResumeId(id)) {
      await deleteOfflineDraftVariant(id)
    }
    else {
      await deleteDraftVariant(id)
    }
    reset()
  }, [state.draftResumeId, reset])

  return { state, generate, abort, reset, discardDraft }
}
