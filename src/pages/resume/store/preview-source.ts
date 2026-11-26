import type { ResumePreviewRequest } from './preview-types'
import {
  isCloudResumeId,
  isOfflineResumeId,
  ResumeNotFoundError,
} from '@/lib/resume-id'
import { readResumeListTemplateBinding } from '@/lib/resume-template/list-binding'
import { RESUME_RENDER_SELECTOR } from '@/lib/supabase/resume/persisted-fields'

export async function readResumePreviewSource(
  { resumeId, accountId }: ResumePreviewRequest,
  signal: AbortSignal,
): Promise<Record<string, unknown>> {
  if (isOfflineResumeId(resumeId)) {
    const [record, { hydrateOfflineResumeData }] = await Promise.all([
      import('@/lib/offline-resume-manager/database').then(
        async ({ getDB }) => {
          const db = await getDB()

          return db.get('resumes', resumeId)
        },
      ),
      import('@/lib/offline-resume-manager/appearance'),
    ])

    signal.throwIfAborted()

    if (!record) throw new ResumeNotFoundError()

    const data = hydrateOfflineResumeData(record.data)

    return {
      ...data,
      type: record.type,
      templateBinding: await previewBinding(data.templateBinding),
    }
  }

  if (!accountId || !isCloudResumeId(resumeId)) throw new ResumeNotFoundError()

  const { readOwnedResumeRow } =
    await import('@/lib/supabase/resume/read-owned-row')

  const row = await readOwnedResumeRow(
    resumeId,
    accountId,
    RESUME_RENDER_SELECTOR,
    signal,
  )

  return { ...row, templateBinding: await previewBinding(row.template_binding) }
}

async function previewBinding(value: unknown) {
  const binding = readResumeListTemplateBinding(value)

  if (binding) return binding

  // 旧简历按已发布的默认版本显示，预览不改写正文或其更新时间。
  const { resolveDefaultTemplateBinding } =
    await import('@/lib/resume-template/runtime/default-selection')

  return resolveDefaultTemplateBinding(value)
}
