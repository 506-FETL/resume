import type { ResumeToolContext } from './types'
import { useMemo } from 'react'
import type { ResumeSchema } from '@/lib/schema'
import { getResumeEvidenceCount } from '@/lib/ats/evidence'
import { normalizeInlineText } from './text'

export default function ToolMeta({ context }: { context: ResumeToolContext }) {
  const summary = useMemo(
    () => getAdvancedToolResumeSummary(context.resume),
    [context.resume],
  )

  return (
    <div className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
      <span className='max-w-64 truncate font-medium text-foreground'>
        {summary.title}
      </span>
      <span>{summary.jobIntent}</span>
      <span>{summary.evidenceCount} 条经历</span>
      <span>{context.resumeType === 'offline' ? '本地简历' : '云端简历'}</span>
    </div>
  )
}

function getAdvancedToolResumeSummary(resume: ResumeSchema) {
  const evidenceCount = getResumeEvidenceCount(resume)

  return {
    title: normalizeInlineText(resume.basics.name) || '未命名简历',
    jobIntent:
      normalizeInlineText(resume.job_intent.jobIntent) || '未填写求职意向',
    evidenceCount,
  }
}
