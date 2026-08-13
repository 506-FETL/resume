import type { RefObject } from 'react'
import type { ResumeDocumentStateChange } from '@/components/resume/pagination/types'
import type { TemplateManifest } from '@/lib/resume-template/schema'
import type { PersistedResumeSnapshot } from '@/lib/schema'
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
  snapshotOverride?: PersistedResumeSnapshot | null
  manifestOverride?: TemplateManifest | null
  projectionReferenceDate?: string
}

export default function ResumePreview({
  resumeRef,
  sourceRef,
  onDocumentStateChange,
  scrollContainerRef,
  snapshotOverride,
  manifestOverride,
  projectionReferenceDate,
}: ResumePreviewProps) {
  const { type, templateBinding, basics, job_intent: jobIntent, application_info: applicationInfo, edu_background: eduBackground, work_experience: workExperience, internship_experience: internshipExperience, campus_experience: campusExperience, project_experience: projectExperience, skill_specialty: skillSpecialty, honors_certificates: honorsCertificates, self_evaluation: selfEvaluation, hobbies, order, visibility } = useResumeStore()
  const spacing = useResumeConfigStore(state => state.spacing)
  const spacingPreview = useResumeConfigStore(state => state.spacingPreview)
  const font = useResumeConfigStore(state => state.font)
  const theme = useResumeConfigStore(state => state.theme)
  const editorAppearance = useMemo(() => snapshotOverride
    ? {
        spacing: snapshotOverride.spacing,
        font: snapshotOverride.font,
        theme: snapshotOverride.theme,
      }
    : {
        spacing: spacingPreview ?? spacing,
        font,
        theme,
      }, [font, snapshotOverride, spacing, spacingPreview, theme])

  const previewData = buildTemplateResumeData(snapshotOverride ?? {
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
      if (manifestOverride) {
        setManifest(manifestOverride)
        return
      }
      const effectiveType = snapshotOverride?.type ?? type
      const effectiveBinding = snapshotOverride?.templateBinding ?? templateBinding
      const fallbackManifest = getBuiltInTemplateManifest(effectiveBinding?.basedOnResumeType ?? effectiveType)

      if (!effectiveBinding) {
        setManifest(fallbackManifest)
        return
      }

      try {
        const resolvedManifest = await getManifestFromTemplateBinding(effectiveBinding)
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
  }, [manifestOverride, snapshotOverride, templateBinding, type])

  return (
    <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-auto p-3 md:p-8">
      <ScaledResumeDocument
        appearance={editorAppearance}
        contentVersion={JSON.stringify([
          previewData,
          manifest.id,
          manifest.version,
          editorAppearance,
          projectionReferenceDate,
        ])}
        documentRef={resumeRef}
        sourceRef={sourceRef}
        onStateChange={onDocumentStateChange}
      >
        <ResumeTemplateRuntime
          data={previewData}
          manifest={manifest}
          appearance={editorAppearance}
          projectionReferenceDate={projectionReferenceDate}
        />
      </ScaledResumeDocument>
    </div>
  )
}
