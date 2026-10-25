import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { extractResumeFile } from '@/lib/resume-import/extract'
import { parseResumeText } from '@/lib/resume-import/parse'
import { DEFAULT_ORDER, DEFAULT_VISIBILITY } from '@/lib/schema'
import {
  collectSectionEvidence,
  recordPreparationEvidence,
} from '@/lib/resume-preparation/evidence'
import { createProfileExample } from '@/lib/resume-preparation/profile-example'
import { populatedSections, importReady } from '../utils'
import { PROFILE_GUIDES } from '@/lib/resume-preparation/const'
import {
  preparationScope,
  updatePreparation,
} from '@/lib/resume-preparation/storage'
import { getDefaultTemplateSelection } from '@/lib/resume-template/runtime/default-selection'
import useResumeListStore from '@/pages/resume/store'
import { useResumeCreationStore } from '@/store/resume-creation'
import useCurrentResumeStore from '@/store/resume/current'
import useUserStore from '@/store/user'
import { useCreationDraftStore } from '../store'

export function useCreationFlow({
  open,
  online,
  onCreated,
  onClose,
}: {
  open: boolean
  online: boolean
  onCreated?: () => void
  onClose: () => void
}) {
  const userId = useUserStore((state) => state.currentUser?.id ?? null)
  const scope = preparationScope(userId)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [creating, setCreating] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const sessionRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true

    const beforeUnload = (event: BeforeUnloadEvent) => {
      const state = useCreationDraftStore.getState()

      if (state.draft.sourceText && (state.saving || state.saveError))
        event.preventDefault()
    }

    window.addEventListener('beforeunload', beforeUnload)

    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [])

  useLayoutEffect(() => {
    sessionRef.current += 1
    abortRef.current?.abort()
    setReading(false)
    setError(null)

    if (open) {
      useCreationDraftStore.getState().setStep('choose')
      useCreationDraftStore.getState().load(scope)
    }
  }, [open, scope])

  function parseText() {
    const state = useCreationDraftStore.getState()

    try {
      const result = parseResumeText(state.draft.sourceText)

      state.patch({
        ...result,
        contentSource: 'import',
        content: {
          ...result.content,
          order: [...DEFAULT_ORDER],
          visibility: {
            ...DEFAULT_VISIBILITY,
            ...Object.fromEntries(
              populatedSections(result.content)
                .filter((key) => key !== 'basics')
                .map((key) => [key, false]),
            ),
          },
        },
        profile:
          result.content.work_experience.items.length > 0
            ? 'experienced'
            : state.draft.profile,
        reviewedSections: [],
        unassignedReviewed: false,
      })

      state.setStep('review')
      setError(null)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : '这段内容暂时无法整理，请检查原文。',
      )
    }
  }

  async function readFile(file: File) {
    abortRef.current?.abort()

    const controller = new AbortController()
    const session = sessionRef.current

    abortRef.current = controller
    setReading(true)
    setError(null)

    try {
      const result = await extractResumeFile(file, controller.signal)

      if (
        controller.signal.aborted ||
        session !== sessionRef.current ||
        useCreationDraftStore.getState().scope !== scope
      )
        return

      useCreationDraftStore.getState().patch({
        sourceText: result.text,
        sourceName: result.sourceName,
        content: null,
        contentSource: 'import',
        selectedTemplate: undefined,
        reviewedSections: [],
        unassignedReviewed: false,
      })
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(
          reason instanceof Error
            ? reason.message
            : '文件读取失败，可以改用粘贴。',
        )
    } finally {
      if (abortRef.current === controller && mountedRef.current)
        setReading(false)
    }
  }

  function prepareProfile() {
    const state = useCreationDraftStore.getState()

    state.patch({
      content: createProfileExample(state.draft.profile),
      contentSource: 'profile',
      sourceText: '',
      sourceName: '',
      unassignedText: '',
      warnings: [],
      reviewedSections: [],
    })

    state.setStep('template')
    setError(null)
  }

  async function create() {
    if (creating) return

    const state = useCreationDraftStore.getState()
    const capturedOwner = userId
    const previouslySubmitted = Boolean(state.draft.creation?.submitted)
    let submitted = previouslySubmitted

    if (state.scope !== scope) return

    setCreating(true)
    setError(null)

    try {
      const original = state.draft.content

      const content =
        original && state.draft.contentSource !== 'profile'
          ? {
              ...original,
              visibility: {
                ...DEFAULT_VISIBILITY,
                ...original.visibility,
                ...Object.fromEntries(
                  populatedSections(original)
                    .filter((key) => key !== 'basics')
                    .map((key) => [key, false]),
                ),
              },
            }
          : original

      if (!content) throw new Error('请先准备简历内容')
      if (
        !state.draft.creation &&
        state.draft.contentSource !== 'profile' &&
        !importReady(state.draft)
      )
        throw new Error('请先核对导入内容')

      const selection =
        state.draft.creation?.selection ??
        state.draft.selectedTemplate ??
        (previouslySubmitted
          ? { ...(await getDefaultTemplateSelection()), name: '默认模板' }
          : null)

      if (!selection) throw new Error('请选择一个模板')

      const creation = state.draft.creation ?? {
        operationId: crypto.randomUUID(),
        mode: online ? ('cloud' as const) : ('local' as const),
        selection,
        displayName:
          state.draft.contentSource === 'profile'
            ? `${PROFILE_GUIDES[state.draft.profile].label}简历`
            : [content.basics.name, content.job_intent.jobIntent]
                .filter(Boolean)
                .join(' · ') || '我的简历',
      }

      state.patch({
        content,
        creation,
        selectedTemplate: selection,
      })

      const draft = useCreationDraftStore.getState().draft

      await state.persist()

      if ((useUserStore.getState().currentUser?.id ?? null) !== capturedOwner)
        throw new Error('账号已切换，请在当前账号重新打开创建入口')

      const resumeId =
        creation.mode === 'local'
          ? `local-${creation.operationId}`
          : creation.operationId

      await updatePreparation(resumeId, capturedOwner, (record) => ({
        ...record,
        profile: draft.profile,
        sourceText: draft.sourceText,
        sourceName: draft.sourceName,
        unassignedText: draft.unassignedText,
      }))

      if ((useUserStore.getState().currentUser?.id ?? null) !== capturedOwner)
        throw new Error('账号已切换，请在当前账号重新打开创建入口')

      state.patch({ creation: { ...creation, submitted: true } })
      await state.persist()

      if ((useUserStore.getState().currentUser?.id ?? null) !== capturedOwner)
        throw new Error('账号已切换，请在当前账号重新打开创建入口')

      submitted = true

      const result = await useResumeCreationStore
        .getState()
        .start({ ...selection, ...creation, description: '', content })

      if (
        (useUserStore.getState().currentUser?.id ?? null) !== capturedOwner ||
        !mountedRef.current
      )
        return

      const prepared = useResumeCreationStore.getState().prepared

      if (
        draft.contentSource === 'profile' &&
        prepared?.resumeId === result.resumeId
      ) {
        await recordPreparationEvidence(
          result.resumeId,
          capturedOwner,
          DEFAULT_ORDER.flatMap((section) =>
            collectSectionEvidence(
              section,
              prepared.snapshot[section],
              'example',
            ),
          ),
          '简历已创建，示例检查记录保存失败，请在导出前重试',
        )
      }

      if ((useUserStore.getState().currentUser?.id ?? null) !== capturedOwner)
        return

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

      await useCreationDraftStore.getState().discard()
      useResumeCreationStore.getState().reset()

      if (
        (useUserStore.getState().currentUser?.id ?? null) !== capturedOwner ||
        !mountedRef.current
      )
        return

      toast.success(
        result.mode === 'local'
          ? '已保存到本设备，可继续编辑或导出'
          : '已保存到云端，可继续编辑或导出',
      )

      onClose()
      onCreated?.()
      navigate('/resume/editor?prepare=1')
    } catch (reason) {
      const latest = useCreationDraftStore.getState()
      const prepared = useResumeCreationStore.getState().prepared

      if (
        !previouslySubmitted &&
        prepared?.operationId !== latest.draft.creation?.operationId
      )
        submitted = false

      if (!submitted && useCreationDraftStore.getState().scope === scope)
        state.patch({ creation: undefined })

      if (
        mountedRef.current &&
        useCreationDraftStore.getState().scope === scope
      )
        setError(reason instanceof Error ? reason.message : '创建失败，请重试')
    } finally {
      if (mountedRef.current) setCreating(false)
    }
  }

  return {
    scope,
    error,
    reading,
    creating,
    parseText,
    readFile,
    create,
    prepareProfile,
    clearError: () => setError(null),
    cancelRead: () => {
      abortRef.current?.abort()
      setReading(false)
    },
  }
}
