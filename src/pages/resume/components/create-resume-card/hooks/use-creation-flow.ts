import {
  bindJobResume,
  jobContextUrl,
  useJobContextStore,
} from '@/lib/job-context'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { extractResumeFile } from '@/lib/resume-import/extract'
import {
  organizeResumeText,
  type ImportStage,
} from '@/lib/resume-import/organize'
import { DEFAULT_ORDER, DEFAULT_VISIBILITY } from '@/lib/schema'
import {
  collectSectionEvidence,
  recordPreparationEvidence,
} from '@/lib/resume-preparation/evidence'
import { createProfileExample } from '@/lib/resume-preparation/profile-example'
import { populatedSections, importReady } from '../utils'
import {
  preparationScope,
  updatePreparation,
} from '@/lib/resume-preparation/storage'
import { getDefaultTemplateSelection } from '@/lib/resume-template/runtime/default-selection'
import { resumeTemplateSource } from '@/lib/resume-template/source'
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
  const [routeParams] = useSearchParams()
  const routeJobId = routeParams.get('jobId')
  const [error, setError] = useState<string | null>(null)
  const [importStage, setImportStage] = useState<ImportStage | null>(null)
  const reading = importStage !== null
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
    setImportStage(null)
    setCreating(false)
    setError(null)

    if (open) {
      useCreationDraftStore.getState().setStep('choose')
      useCreationDraftStore.getState().load(scope)
    }
  }, [open, scope])

  async function importSource(file?: File) {
    const state = useCreationDraftStore.getState()

    if (state.draft.creation || state.scope !== scope) return

    abortRef.current?.abort()

    const controller = new AbortController()
    const session = sessionRef.current
    const originalText = state.draft.sourceText

    abortRef.current = controller
    setImportStage(file ? 'reading' : 'organizing')
    setError(null)

    const isCurrent = () =>
      mountedRef.current &&
      !controller.signal.aborted &&
      abortRef.current === controller &&
      session === sessionRef.current &&
      useCreationDraftStore.getState().scope === scope &&
      (useUserStore.getState().currentUser?.id ?? null) === userId &&
      useCreationDraftStore.getState().draft.sourceText === originalText

    try {
      const source = file
        ? await extractResumeFile(file, controller.signal)
        : {
            text: originalText,
            sourceName: state.draft.sourceName || '粘贴内容',
          }

      if (!isCurrent()) return

      const result = await organizeResumeText(source.text, {
        signal: controller.signal,
        ownerId: userId,
        onStage: (stage) => {
          if (isCurrent()) setImportStage(stage)
        },
      })

      if (!isCurrent()) return

      state.patch({
        ...result,
        sourceText: source.text,
        sourceName: source.sourceName,
        selectedTemplate: undefined,
        contentSource: 'import',
        creationMode: undefined,
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
      })

      state.setStep('review')
    } catch (reason) {
      if (isCurrent())
        setError(
          reason instanceof Error
            ? reason.message
            : '导入未完成，可以换一个文件或粘贴文字。',
        )
    } finally {
      if (abortRef.current === controller && mountedRef.current)
        setImportStage(null)
    }
  }

  function parseText() {
    return importSource()
  }

  function readFile(file: File) {
    return importSource(file)
  }

  function prepareProfile() {
    const state = useCreationDraftStore.getState()

    state.patch({
      content: createProfileExample(state.draft.profile),
      contentSource: 'profile',
      creationMode: undefined,
      sourceText: '',
      sourceName: '',
      unassignedText: '',
      warnings: [],
    })

    state.setStep('template')
    setError(null)
  }

  async function create() {
    if (creating) return

    const state = useCreationDraftStore.getState()
    const capturedOwner = userId
    const session = sessionRef.current
    const capturedJobId = routeJobId
    const previouslySubmitted = Boolean(state.draft.creation?.submitted)
    let submitted = previouslySubmitted

    if (state.scope !== scope) return

    const isCurrent = () =>
      mountedRef.current &&
      sessionRef.current === session &&
      useCreationDraftStore.getState().scope === scope &&
      (useUserStore.getState().currentUser?.id ?? null) === capturedOwner

    setCreating(true)
    setError(null)

    try {
      const selection =
        state.draft.creation?.selection ??
        state.draft.selectedTemplate ??
        (previouslySubmitted
          ? { ...(await getDefaultTemplateSelection()), name: '默认模板' }
          : null)

      if (!selection) throw new Error('请选择一个模板')

      const exampleSource =
        state.draft.contentSource === 'profile' ||
        state.draft.contentSource === 'template'

      const original =
        state.draft.contentSource === 'template' && !state.draft.creation
          ? (await resumeTemplateSource.getExample(selection.example)).content
          : state.draft.content

      if (!isCurrent()) return

      const content =
        original && !exampleSource
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
      if (!state.draft.creation && !exampleSource && !importReady(state.draft))
        throw new Error('尚未识别到可填充的内容，请补充内容或重新导入')

      const creation = state.draft.creation ?? {
        operationId: crypto.randomUUID(),
        mode:
          state.draft.creationMode ??
          (online ? ('cloud' as const) : ('local' as const)),
        selection,
        displayName: state.draft.displayName.trim() || '示例简历',
        description: state.draft.description.trim(),
      }

      state.patch({
        content,
        creation,
        selectedTemplate: selection,
      })

      const draft = useCreationDraftStore.getState().draft

      await state.persist()

      if (!isCurrent()) return

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

      if (!isCurrent()) return

      state.patch({ creation: { ...creation, submitted: true } })
      await state.persist()

      if (!isCurrent()) return

      submitted = true

      const result = await useResumeCreationStore.getState().start({
        ...selection,
        ...creation,
        description: creation.description ?? '',
        content,
      })

      if (!isCurrent()) return

      const prepared = useResumeCreationStore.getState().prepared

      if (exampleSource && prepared?.resumeId === result.resumeId) {
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

      if (capturedJobId && result.mode !== 'local') {
        const context = await bindJobResume(capturedJobId, result.resumeId)

        if (!isCurrent()) return

        useJobContextStore.getState().setContext(context)
      }

      await useCreationDraftStore.getState().discard()
      useResumeCreationStore.getState().reset()

      if (!isCurrent()) return

      toast.success(
        result.mode === 'local'
          ? '已保存到本设备，可继续编辑或导出'
          : '已保存到云端，可继续编辑或导出',
      )

      onClose()
      onCreated?.()

      navigate(
        capturedJobId
          ? jobContextUrl('/resume/editor', capturedJobId, { prepare: '1' })
          : '/resume/editor?prepare=1',
      )
    } catch (reason) {
      if (!isCurrent()) return

      const latest = useCreationDraftStore.getState()
      const prepared = useResumeCreationStore.getState().prepared

      if (
        !previouslySubmitted &&
        prepared?.operationId !== latest.draft.creation?.operationId
      )
        submitted = false

      if (!submitted) state.patch({ creation: undefined })

      setError(reason instanceof Error ? reason.message : '创建失败，请重试')
    } finally {
      if (isCurrent()) setCreating(false)
    }
  }

  return {
    scope,
    error,
    reading,
    importStage,
    creating,
    parseText,
    readFile,
    create,
    prepareProfile,
    clearError: () => setError(null),
    cancelRead: () => {
      abortRef.current?.abort()
      setImportStage(null)
    },
  }
}
