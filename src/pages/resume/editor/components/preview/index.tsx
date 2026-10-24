import type { RefObject } from 'react'
import type { ResumeDocumentStateChange } from '@/components/resume/pagination/types'
import type { TemplateDefinition } from '@/lib/resume-template/definition-schema'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import { useMemo } from 'react'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import useResumeConfigStore from '@/store/resume/config'
import useResumeStore from '@/store/resume/form'

interface ResumePreviewProps {
  resumeRef: RefObject<HTMLDivElement | null>
  sourceRef?: RefObject<HTMLDivElement | null>
  onDocumentStateChange?: ResumeDocumentStateChange
  scrollContainerRef?: RefObject<HTMLDivElement | null>
  snapshotOverride?: PersistedResumeSnapshot | null
  definitionOverride?: TemplateDefinition | null
  projectionReferenceDate?: string
}

export default function ResumePreview({
  resumeRef,
  sourceRef,
  onDocumentStateChange,
  scrollContainerRef,
  snapshotOverride,
  definitionOverride,
  projectionReferenceDate,
}: ResumePreviewProps) {
  const {
    type,
    templateBinding,
    basics,
    job_intent: jobIntent,
    application_info: applicationInfo,
    edu_background: eduBackground,
    work_experience: workExperience,
    internship_experience: internshipExperience,
    campus_experience: campusExperience,
    project_experience: projectExperience,
    skill_specialty: skillSpecialty,
    honors_certificates: honorsCertificates,
    self_evaluation: selfEvaluation,
    hobbies,
    order,
    visibility,
  } = useResumeStore()

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

  const previewData = buildTemplateResumeData(
    snapshotOverride ?? {
      basics,
      job_intent: jobIntent,
      application_info: applicationInfo,
      edu_background: eduBackground,
      work_experience: workExperience,
      internship_experience: internshipExperience,
      campus_experience: campusExperience,
      project_experience: projectExperience,
      skill_specialty: skillSpecialty,
      honors_certificates: honorsCertificates,
      self_evaluation: selfEvaluation,
      hobbies,
      order,
      type,
      templateBinding,
      visibility,
    },
  )

  return (
    <div
      ref={scrollContainerRef}
      className='min-h-0 flex-1 overflow-auto p-3 md:p-8'
    >
      <ScaledReadonlyPreview
        data={previewData}
        appearance={editorAppearance}
        definition={definitionOverride}
        documentRef={resumeRef}
        sourceRef={sourceRef}
        onDocumentStateChange={onDocumentStateChange}
        projectionReferenceDate={projectionReferenceDate}
      />
    </div>
  )
}
