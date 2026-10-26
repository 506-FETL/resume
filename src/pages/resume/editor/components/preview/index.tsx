import type { RefObject } from 'react'
import type { ResumeDocumentStateChange } from '@/components/resume/pagination/types'
import type { TemplateDefinition } from '@/lib/resume-template/definition-schema'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import {
  useCallback,
  useDeferredValue,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useDebouncedValue } from '@/hooks/use-debounce'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import useResumeConfigStore from '@/store/resume/config'
import useResumeStore from '@/store/resume/form'
import useResumeExportStore from '@/store/resume/export'
import CheckHighlight from '../check-highlight'

interface ResumePreviewProps {
  checksVisible?: boolean
  resumeRef: RefObject<HTMLDivElement | null>
  sourceRef?: RefObject<HTMLDivElement | null>
  onDocumentStateChange?: ResumeDocumentStateChange
  scrollContainerRef?: RefObject<HTMLDivElement | null>
  snapshotOverride?: PersistedResumeSnapshot | null
  definitionOverride?: TemplateDefinition | null
  projectionReferenceDate?: string
}

export default function ResumePreview({
  checksVisible = false,
  resumeRef,
  sourceRef,
  onDocumentStateChange,
  scrollContainerRef,
  snapshotOverride,
  definitionOverride,
  projectionReferenceDate,
}: ResumePreviewProps) {
  const fallbackScrollRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = scrollContainerRef ?? fallbackScrollRef

  const input = useResumeStore(
    useShallow((state) => ({
      currentResumeId: state.currentResumeId,
      type: state.type,
      templateBinding: state.templateBinding,
      basics: state.basics,
      job_intent: state.job_intent,
      application_info: state.application_info,
      edu_background: state.edu_background,
      work_experience: state.work_experience,
      internship_experience: state.internship_experience,
      campus_experience: state.campus_experience,
      project_experience: state.project_experience,
      skill_specialty: state.skill_specialty,
      honors_certificates: state.honors_certificates,
      self_evaluation: state.self_evaluation,
      hobbies: state.hobbies,
      order: state.order,
      visibility: state.visibility,
    })),
  )

  // 合并连续输入/粘贴，避免在每个空隙反复渲染和分页；正文写入与保存不延迟。
  const settledInput = useDebouncedValue(input, 180)

  const deferredInput = useDeferredValue(
    input.currentResumeId === settledInput.currentResumeId
      ? settledInput
      : input,
  )

  const spacing = useResumeConfigStore((state) => state.spacing)
  const spacingPreview = useResumeConfigStore((state) => state.spacingPreview)
  const font = useResumeConfigStore((state) => state.font)
  const theme = useResumeConfigStore((state) => state.theme)

  const editorAppearance = useMemo(
    () =>
      snapshotOverride
        ? {
            spacing: snapshotOverride.spacing,
            font: snapshotOverride.font,
            theme: snapshotOverride.theme,
          }
        : {
            spacing: spacingPreview ?? spacing,
            font,
            theme,
          },
    [font, snapshotOverride, spacing, spacingPreview, theme],
  )

  const previewData = useMemo(
    () => buildTemplateResumeData(snapshotOverride ?? deferredInput),
    [snapshotOverride, deferredInput],
  )

  const isSourceCurrent = useCallback(() => {
    if (snapshotOverride) return false

    const current = useResumeStore.getState()
    const config = useResumeConfigStore.getState()

    return (
      (Object.keys(deferredInput) as Array<keyof typeof deferredInput>).every(
        (key) => deferredInput[key] === current[key],
      ) &&
      editorAppearance.spacing === (config.spacingPreview ?? config.spacing) &&
      editorAppearance.font === config.font &&
      editorAppearance.theme === config.theme
    )
  }, [deferredInput, editorAppearance, snapshotOverride])

  useLayoutEffect(() => {
    useResumeExportStore.setState({ isSourceCurrent })

    return () => {
      if (useResumeExportStore.getState().isSourceCurrent === isSourceCurrent)
        useResumeExportStore.setState({ isSourceCurrent: null })
    }
  }, [isSourceCurrent])

  useLayoutEffect(() => {
    if (snapshotOverride || input === deferredInput) return

    const current = useResumeExportStore.getState().documentState

    if (current.status === 'measuring' && !current.signature) return

    onDocumentStateChange?.({
      ...current,
      status: 'measuring',
      signature: null,
      error: null,
    })
  }, [input, deferredInput, snapshotOverride, onDocumentStateChange])

  const handleDocumentStateChange = useCallback<
    NonNullable<ResumeDocumentStateChange>
  >(
    (state) => {
      // 旧预览的测量结果不能把最新正文误标为可导出。
      if (snapshotOverride || isSourceCurrent()) onDocumentStateChange?.(state)
    },
    [isSourceCurrent, onDocumentStateChange, snapshotOverride],
  )

  return (
    <div
      ref={scrollRef}
      className='relative min-h-0 flex-1 overflow-auto p-3 md:p-8'
    >
      <ScaledReadonlyPreview
        data={previewData}
        appearance={editorAppearance}
        definition={definitionOverride}
        documentRef={resumeRef}
        sourceRef={sourceRef}
        onDocumentStateChange={handleDocumentStateChange}
        projectionReferenceDate={projectionReferenceDate}
      />
      {!snapshotOverride && (
        <CheckHighlight
          enabled={checksVisible}
          rootRef={resumeRef}
          scrollRef={scrollRef}
        />
      )}
    </div>
  )
}
