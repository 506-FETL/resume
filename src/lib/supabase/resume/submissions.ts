import type {
  JobSubmission,
  JobSubmissionMaterial,
  SubmissionInput,
  SubmissionMaterialInput,
} from '@/pages/tracker/submission-types'
import { parseSharedTemplateDefinition } from '@/lib/resume-template/share'
import { mapSourceToPersistedSnapshot } from '@/store/resume/helpers'
import supabase from '../client'
import { getCurrentUser } from '../user'

type SubmissionRequestGuard = (userId: string | null) => void

export class SubmissionSaveError extends Error {
  readonly outcome: 'rejected' | 'unknown'

  constructor(message: string, outcome: 'rejected' | 'unknown') {
    super(message)
    this.name = 'SubmissionSaveError'
    this.outcome = outcome
  }
}

const SUMMARY_FIELDS =
  'id,user_id,job_id,submitted_on,channel,note,created_at,supplemented_at,jd_updated_at,material_kind,resume_id,version_id,file_name,file_mime,file_size'

async function invokeSubmission(
  input: Record<string, unknown>,
  file?: File,
  assertUser?: SubmissionRequestGuard,
) {
  const user = await getCurrentUser()

  assertUser?.(user?.id ?? null)

  if (!user) throw new Error('请先登录')

  const body = new FormData()

  body.set('input', JSON.stringify(input))

  if (file) body.set('file', file)

  const { data, error } = await supabase.functions.invoke('job-submissions', {
    body,
  })

  assertUser?.(user.id)

  if (error) {
    const status = error.context?.status
    const detail = await error.context?.json?.().catch(() => null)

    const rejected =
      status >= 400 && status < 500 && ![408, 409, 499].includes(status)

    throw new SubmissionSaveError(
      detail?.error ?? '保存未能确认，请保留本次操作编号后重试',
      rejected ? 'rejected' : 'unknown',
    )
  }

  return data
}

export async function listJobSubmissions(
  jobId: string,
  assertUser?: SubmissionRequestGuard,
): Promise<JobSubmission[]> {
  const user = await getCurrentUser()

  assertUser?.(user?.id ?? null)

  if (!user) throw new Error('请先登录')

  const { data, error } = await supabase
    .from('job_submissions')
    .select(SUMMARY_FIELDS)
    .eq('job_id', jobId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  assertUser?.(user.id)

  if (error) {
    throw new Error(
      error.code === 'PGRST205'
        ? '投递记录服务暂时不可用，请稍后重试'
        : error.message || '暂时无法读取投递记录，请稍后重试',
      { cause: error },
    )
  }

  return (data ?? []) as JobSubmission[]
}

export async function recordJobSubmission(
  input: SubmissionInput,
  assertUser?: SubmissionRequestGuard,
): Promise<JobSubmission> {
  const { file, ...fields } = input

  return invokeSubmission({ ...fields, action: 'record' }, file, assertUser)
}

export async function supplementJobSubmission(
  id: string,
  material: SubmissionMaterialInput & { jobId: string },
  assertUser?: SubmissionRequestGuard,
): Promise<JobSubmission> {
  const { file, ...fields } = material

  return invokeSubmission(
    { ...fields, id, action: 'supplement' },
    file,
    assertUser,
  )
}

export async function getJobSubmissionMaterial(
  id: string,
  assertUser?: SubmissionRequestGuard,
): Promise<JobSubmissionMaterial> {
  const data = await invokeSubmission(
    { id, action: 'material' },
    undefined,
    assertUser,
  )

  const common = { jdText: data.jdText, jdUpdatedAt: data.jdUpdatedAt }

  if (data.kind === 'platform') {
    const definition = parseSharedTemplateDefinition(data.templateManifest)

    return {
      ...common,
      kind: 'platform',
      snapshot: mapSourceToPersistedSnapshot(data.snapshot),
      definition,
      projectionReferenceDate: data.projectionReferenceDate,
    }
  }
  if (data.kind === 'file') {
    const file = await invokeSubmission(
      { id, action: 'download' },
      undefined,
      assertUser,
    )

    return {
      ...common,
      kind: 'file',
      file: new Blob([file], { type: data.fileMime }),
      fileName: data.fileName,
      fileMime: data.fileMime,
      fileSize: data.fileSize,
    }
  }

  return { ...common, kind: 'pending' }
}

export interface PendingSubmissionSummary {
  id: string
  job_id: string
  created_at: string
  company: { company: string; position: string }
}

export async function listPendingSubmissionSummaries(): Promise<
  PendingSubmissionSummary[]
> {
  const user = await getCurrentUser()

  if (!user) throw new Error('请先登录')

  const { data, error } = await supabase
    .from('job_submissions')
    .select('id,job_id,created_at,company!inner(company,position,archived)')
    .eq('user_id', user.id)
    .eq('material_kind', 'pending')
    .eq('company.archived', false)
    .order('created_at', { ascending: true })
    .returns<PendingSubmissionSummary[]>()

  if (error)
    throw new Error('暂时无法读取待补材料，请稍后重试', { cause: error })

  return data ?? []
}
