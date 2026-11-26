import type {
  ExampleRef,
  TemplateCatalogItem,
} from '@/lib/resume-template/source/types'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { isOfflineResumeId } from '@/lib/resume-id'
import { preparationScope } from '@/lib/resume-preparation/storage'
import { exampleKey, templateKey } from '@/lib/resume-template/source/types'
import { useResumeTemplateStore } from '@/store/resume-template'
import useCurrentResumeStore from '@/store/resume/current'
import useUserStore from '@/store/user'
import { useTemplatePageStore } from '../store'
import { useTemplateCreationDraftStore } from '../store/creation'
import { catalogTemplateRef } from '../utils'

export function useTemplateCreation(
  item: Pick<
    TemplateCatalogItem,
    'templateId' | 'currentVersion' | 'defaultExample'
  >,
) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pendingRef = useRef(false)
  const mountedRef = useRef(true)
  const sessionRef = useRef(0)
  const template = catalogTemplateRef(item)
  const resourceKey = templateKey(template)

  const authStatus = useUserStore((state) => state.authStatus)
  const ownerId = useUserStore((state) => state.currentUser?.id ?? null)
  const previewOpen = useTemplatePageStore((state) => state.previewOpen)

  const details = useTemplatePageStore(
    (state) => state.previewStep === 'details',
  )

  const currentId = useCurrentResumeStore((state) => state.resumeId)
  const key = `${preparationScope(ownerId)}:${resourceKey}`

  const ready = useTemplateCreationDraftStore(
    (state) => state.key === key && state.ready && authStatus !== 'unknown',
  )

  const operation = useTemplateCreationDraftStore((state) =>
    ready ? state.draft.operation : undefined,
  )

  const saveError = useTemplateCreationDraftStore((state) =>
    state.key === key ? state.saveError : null,
  )

  const example = useTemplatePageStore(
    (state) =>
      state.selectedExamples[item.templateId]?.example ?? item.defaultExample,
  )

  const selectedKey = exampleKey(operation?.example ?? example)

  const definitionReady = useResumeTemplateStore(
    (state) => state.definitions[resourceKey]?.status === 'ready',
  )

  const exampleReady = useResumeTemplateStore(
    (state) => state.examples[selectedKey]?.status === 'ready',
  )

  const mode =
    operation?.mode ??
    (ownerId && !(currentId && isOfflineResumeId(currentId))
      ? 'cloud'
      : 'local')

  useLayoutEffect(() => {
    sessionRef.current += 1
    pendingRef.current = false
    setLoading(false)
    setError(null)
  }, [key, previewOpen, authStatus])

  useLayoutEffect(() => {
    if (details && previewOpen && authStatus !== 'unknown')
      useTemplateCreationDraftStore.getState().load(key)
  }, [key, details, previewOpen, authStatus])

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
        next.previewStep !== previous.previewStep ||
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
    definitionReady && exampleReady && exampleKey(example) === selectedKey

  async function create(example: ExampleRef) {
    if (pendingRef.current || !ready || !details || !previewOpen) return

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

    let submission: typeof import('../store/submit-creation') | undefined

    try {
      submission = await import('../store/submit-creation')

      if (!isCurrent()) return

      await state.setOperation(operation)

      if (!isCurrent()) return

      const result = await submission.saveTemplateResume(operation)

      if (!isCurrent()) return

      await submission.recordExampleEvidence(result, ownerId)

      if (!isCurrent()) return

      await state.discard()

      if (!isCurrent()) return

      submission.openCreatedResume(result)

      toast.success(
        result.mode === 'local'
          ? '已保存到本设备，可继续编辑或导出'
          : '已保存到云端，可继续编辑或导出',
      )

      useTemplatePageStore.getState().setPreviewOpen(false)
      navigate('/resume/editor?prepare=1')
    } catch (reason) {
      if (!isCurrent()) return

      if (
        !previousOperation &&
        useTemplateCreationDraftStore.getState().draft.operation
          ?.operationId === operation.operationId &&
        submission?.failedBeforeWrite(operation.operationId, reason)
      )
        await state.setOperation(undefined).catch(() => undefined)

      if (isCurrent())
        setError(
          !submission
            ? '暂时无法加载创建功能，请重试。'
            : reason instanceof Error
              ? reason.message
              : '创建失败，请重试',
        )
    } finally {
      if (isCurrent()) {
        pendingRef.current = false
        setLoading(false)
      }
    }
  }

  return {
    operation,
    ready,
    locked: loading || Boolean(operation),
    loading,
    error: error ?? saveError,
    mode,
    isExampleReady,
    create,
  }
}
