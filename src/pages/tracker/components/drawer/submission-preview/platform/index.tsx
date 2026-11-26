import type { JobSubmissionMaterial } from '../../../../submission-types'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import { useMemo } from 'react'

export default function PlatformPreview({
  material,
}: {
  material: Extract<JobSubmissionMaterial, { kind: 'platform' }>
}) {
  const data = useMemo(
    () => buildTemplateResumeData(material.snapshot),
    [material.snapshot],
  )

  return (
    <ScaledReadonlyPreview
      data={data}
      appearance={material.snapshot}
      projectionReferenceDate={material.projectionReferenceDate}
      definition={material.definition}
    />
  )
}
