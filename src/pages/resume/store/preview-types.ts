import type { ResumeTemplateBinding } from '@/lib/schema/resume/persisted'

export interface ResumePreviewRequest {
  accountId: string | null
  resumeId: string
  updatedAt: string
  templateBinding?: ResumeTemplateBinding | null
}

export interface ResumePreviewPaper {
  html: string
  width: number
  height: number
  objectUrls: string[]
  bytes: number
}

export type ResumePreviewEntry = {
  request: ResumePreviewRequest
  attempt: number
} & (
  | { status: 'queued' | 'generating' | 'error' }
  | { status: 'ready'; paper: ResumePreviewPaper }
)

export type GenerateResumePreview = (
  request: ResumePreviewRequest,
  signal: AbortSignal,
  retry: boolean,
) => Promise<ResumePreviewPaper>

export function resumePreviewKey(request: ResumePreviewRequest): string {
  const binding = request.templateBinding

  return JSON.stringify([
    request.accountId,
    request.resumeId,
    request.updatedAt,
    binding?.source,
    binding?.templateId,
    binding?.templateVersion,
    new Date().toISOString().slice(0, 10),
  ])
}

export function releasePreviewPaper(paper: ResumePreviewPaper) {
  paper.objectUrls.forEach((url) => URL.revokeObjectURL(url))
}
