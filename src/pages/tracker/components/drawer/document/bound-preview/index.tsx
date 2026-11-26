import type { ResumePreviewData } from '../../types'
import { useMemo } from 'react'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import { normalizeResumePreviewData } from '../../../../utils'

export default function SharedResumePreview({
  data,
}: {
  data: ResumePreviewData
}) {
  const normalizedData = useMemo(
    () => buildTemplateResumeData(normalizeResumePreviewData(data)),
    [data],
  )

  return (
    <div className='p-3 sm:p-4'>
      <ScaledReadonlyPreview data={normalizedData} appearance={data} />
    </div>
  )
}
