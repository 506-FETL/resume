import type { ResumeSnapshot } from '@/lib/supabase/resume/history'
import { memo, useMemo } from 'react'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'

interface HistoryResumePreviewProps {
  snapshot: ResumeSnapshot
}

function HistoryResumePreview({ snapshot }: HistoryResumePreviewProps) {
  const previewData = useMemo(() => buildTemplateResumeData(snapshot), [snapshot])

  return (
    <ScaledReadonlyPreview data={previewData} appearance={snapshot} />
  )
}

export default memo(HistoryResumePreview)
