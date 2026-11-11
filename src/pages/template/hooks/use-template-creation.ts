import type { TemplateCreationDraft } from '@/lib/resume-template/create/types'
import type {
  ExampleRef,
  TemplateCatalogItem,
} from '@/lib/resume-template/source/types'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { isOfflineResumeId } from '@/lib/offline-resume-manager'
import {
  collectSectionEvidence,
  recordPreparationEvidence,
} from '@/lib/resume-preparation/evidence'
import { preparationScope } from '@/lib/resume-preparation/storage'
import { CreationLookupFailedError } from '@/lib/resume-template/create/types'
import { exampleKey, templateKey } from '@/lib/resume-template/source/types'
import { DEFAULT_ORDER } from '@/lib/schema'
import useResumeListStore from '@/pages/resume/store'
import { useResumeCreationStore } from '@/store/resume-creation'
import { useResumeTemplateStore } from '@/store/resume-template'
import useCurrentResumeStore from '@/store/resume/current'
import useUserStore from '@/store/user'
import { useTemplatePageStore } from '../store'
import { useTemplateCreationDraftStore } from '../store/creation'
import { catalogTemplateRef } from '../utils'

export function useTemplateCreation(item: TemplateCatalogItem) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pendingRef = useRef(false)
  const mountedRef = useRef(true)
  const sessionRef = useRef(0)
  const template = catalogTemplateRef(item)
  const resourceKey = templateKey(template)

  const definition = useResumeTemplateStore(
    (state) => state.definitions[resourceKey],
  )

  const examples = useResumeTemplateStore((state) => state.examples)
  const authStatus = useUserStore((state) => state.authStatus)
  const ownerId = useUserStore((state) => state.currentUser?.id ?? null)
  const previewOpen = useTemplatePageStore((state) => state.previewOpen)
  const currentId = useCurrentResumeStore((state) => state.resumeId)
  const listLoading = useResumeListStore((state) => state.loading)
  const isOnline = useResumeListStore((state) => state.isOnline)
  const state = useTemplateCreationDraftStore()
  const key = `${preparationScope(ownerId)}:${resourceKey}`
  const ready = authStatus !== 'unknown' && state.key === key && state.ready

  const mode =
    (ready ? state.draft.operation?.mode : undefined) ??
    (currentId && isOfflineResumeId(currentId)
      ? 'local'
      : (listLoading ? Boolean(ownerId) : isOnline)
        ? 'cloud'
        : 'local')

  useLayoutEffect(() => {
    sessionRef.current += 1
    pendingRef.current = false
    setLoading(false)
    setError(null)

    if (previewOpen && authStatus !== 'unknown')
      useTemplateCreationDraftStore
        .getState()
        .load(key)
        .catch(() => undefined)
  }, [key, previewOpen, authStatus])

  useEffect(() => {
    mountedRef.current = true

    const invalidate = () => {
      sessionRef.current += 1
      pendingRef.current = false
      setLoading(false)
      setError(null)
    }

    const unsubscribeUser = useUserStore.subscribe((next, previous) => {
      if (next.currentUser?.id !== previous.currentUser?.id) invalidate()
    })

    const unsubscribePage = useTemplatePageStore.subscribe((next, previous) => {
      if (
        next.previewOpen !== previous.previewOpen ||
        next.selectedTemplateId !== previous.selectedTemplateId
      )
        invalidate()
    })

    return () => {
      mountedRef.current = false
      unsubscribeUser()
      unsubscribePage()
    }
  }, [])

  const isExampleReady = (example: ExampleRef) =>
    definition?.status === 'ready' &&
    examples[exampleKey(example)]?.status === 'ready'

  async function create(example: ExampleRef) {
    if (pendingRef.current || !ready || !previewOpen) return

    const session = sessionRef.current
    const state = useTemplateCreationDraftStore.getState()

    if (
      state.key !== key ||
      (useUserStore.getState().currentUser?.id ?? null) !== ownerId
    )
      return

    const previousOperation = state.draft.operation

    const operation = previousOperation ?? {
      template,
      example,
      mode,
      displayName: state.draft.displayName.trim() || '示例简历',
      description: state.draft.description.trim(),
      operationId: crypto.randomUUID(),
    }

    const isCurrent = () =>
      mountedRef.current &&
      sessionRef.current === session &&
      (useUserStore.getState().currentUser?.id ?? null) === ownerId &&
      useTemplateCreationDraftStore.getState().key === key &&
      useTemplatePageStore.getState().previewOpen &&
      useTemplatePageStore.getState().selectedTemplateId === item.templateId

    pendingRef.current = true
    setLoading(true)
    setError(null)

    try {
      await state.setOperation(operation)

      if (!isCurrent()) return

      const result = await useResumeCreationStore.getState().start(operation)

      if (!isCurrent()) return

      const prepared = useResumeCreationStore.getState().prepared

      if (prepared?.resumeId === result.resumeId)
        await recordPreparationEvidence(
          result.resumeId,
          ownerId,
          DEFAULT_ORDER.flatMap((section) =>
            collectSectionEvidence(
              section,
              prepared.snapshot[section],
              'example',
            ),
          ),
          '简历已创建，示例检查记录保存失败，请在导出前重试',
        )

      if (!isCurrent()) return

      await state.discard()

      if (!isCurrent()) return

      useResumeListStore.getState().addResume({
        resume_id: result.resumeId,
        display_name: result.displayName,
        description: result.description,
        type: result.type,
        created_at: result.createdAt,
        updated_at: result.updatedAt,
        isOffline: result.mode === 'local',
        templateBinding: result.templateBinding,
      })

      useCurrentResumeStore
        .getState()
        .setCurrentResume(result.resumeId, result.type)

      useResumeCreationStore.getState().reset()

      toast.success(
        result.mode === 'local'
          ? '已保存到本设备，可继续编辑或导出'
          : '已保存到云端，可继续编辑或导出',
      )

      useTemplatePageStore.getState().setPreviewOpen(false)
      navigate('/resume/editor?prepare=1')
    } catch (reason) {
      if (!isCurrent()) return

      const prepared = useResumeCreationStore.getState().prepared

      if (
        !previousOperation &&
        (prepared?.operationId !== operation.operationId ||
          reason instanceof CreationLookupFailedError)
      )
        await state.setOperation(undefined).catch(() => undefined)

      if (isCurrent())
        setError(reason instanceof Error ? reason.message : '创建失败，请重试')
    } finally {
      if (isCurrent()) {
        pendingRef.current = false
        setLoading(false)
      }
    }
  }

  const draft: TemplateCreationDraft = ready
    ? state.draft
    : { displayName: '示例简历', description: '' }

  return {
    draft,
    patchDraft: (
      patch: Partial<Pick<typeof state.draft, 'displayName' | 'description'>>,
    ) => {
      if (ready && useTemplateCreationDraftStore.getState().key === key)
        state.patch(patch)
    },
    ready,
    locked: loading || (ready && Boolean(state.draft.operation)),
    loading,
    error: error ?? state.saveError,
    mode,
    isExampleReady,
    create,
  }
}
