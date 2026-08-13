import type { RefObject } from 'react'
import type { ResumeDocumentStateChange } from '@/components/resume/pagination/types'
import { useEffect, useMemo, useState } from 'react'
import ScaledResumeDocument from '@/components/resume/pagination/scaled-resume-document'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { ResumeTemplateRuntime } from '@/components/resume/runtime/ResumeTemplateRuntime'
import { getBuiltInTemplateManifest } from '@/lib/resume-template/runtime/get-built-in-manifest'
import { getManifestFromTemplateBinding } from '@/lib/resume-template/runtime/get-manifest-from-binding'
import useResumeConfigStore from '@/store/resume/config'
import useResumeStore from '@/store/resume/form'

interface ResumePreviewProps {
  resumeRef: RefObject<HTMLDivElement | null>
  sourceRef?: RefObject<HTMLDivElement | null>
  onDocumentStateChange?: ResumeDocumentStateChange
  scrollContainerRef?: RefObject<HTMLDivElement | null>
}

export default function ResumePreview({
  resumeRef,
  sourceRef,
  onDocumentStateChange,
  scrollContainerRef,
}: ResumePreviewProps) {
  const { type, templateBinding, basics, job_intent: jobIntent, application_info: applicationInfo, edu_background: eduBackground, work_experience: workExperience, internship_experience: internshipExperience, campus_experience: campusExperience, project_experience: projectExperience, skill_specialty: skillSpecialty, honors_certificates: honorsCertificates, self_evaluation: selfEvaluation, hobbies, order, visibility } = useResumeStore()
  const spacing = useResumeConfigStore(state => state.spacing)
  const spacingPreview = useResumeConfigStore(state => state.spacingPreview)
  const font = useResumeConfigStore(state => state.font)
  const theme = useResumeConfigStore(state => state.theme)
  const editorAppearance = useMemo(() => ({
    spacing: spacingPreview ?? spacing,
    font,
    theme,
  }), [font, spacing, spacingPreview, theme])

  const previewData = buildTemplateResumeData({
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
  })

  const [manifest, setManifest] = useState(() => getBuiltInTemplateManifest(type))

  useEffect(() => {
    let cancelled = false

    async function loadManifest() {
      const fallbackManifest = getBuiltInTemplateManifest(templateBinding?.basedOnResumeType ?? type)

      if (!templateBinding) {
        setManifest(fallbackManifest)
        return
      }

      try {
        const resolvedManifest = await getManifestFromTemplateBinding(templateBinding)
        if (!cancelled) {
          setManifest(resolvedManifest ?? fallbackManifest)
        }
      }
      catch {
        if (!cancelled) {
          setManifest(fallbackManifest)
        }
      }
    }

    loadManifest()

    return () => {
      cancelled = true
    }
  }, [templateBinding, type])

  return (
    <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-auto p-3 md:p-8">
      <ScaledResumeDocument
        appearance={editorAppearance}
        contentVersion={JSON.stringify([
          previewData,
          manifest.id,
          manifest.version,
          editorAppearance,
        ])}
        documentRef={resumeRef}
        sourceRef={sourceRef}
        onStateChange={onDocumentStateChange}
      >
        <ResumeTemplateRuntime
          data={previewData}
          manifest={manifest}
          appearance={editorAppearance}
        />
      </ScaledResumeDocument>
    </div>
  )
}
