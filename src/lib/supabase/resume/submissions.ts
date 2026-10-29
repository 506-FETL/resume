import type {
  JobSubmission,
  JobSubmissionMaterial,
  SubmissionInput,
  SubmissionMaterialInput,
  SubmissionRevision,
  JobSubmissionState,
} from '@/pages/tracker/submission-types'
import { parseSharedTemplateDefinition } from '@/lib/resume-template/share'
import { mapSourceToPersistedSnapshot } from '@/store/resume/helpers'
import supabase from '../client'
import { getCurrentUser } from '../user'
import { TrackerProcessError } from './tracker-companies'

type SubmissionRequestGuard = (userId: string | null) => void

export class SubmissionSaveError extends TrackerProcessError {
  readonly outcome: 'rejected' | 'unknown'

  constructor(
    message: string,
    outcome: 'rejected' | 'unknown',
    conflictJobId: string | null = null,
  ) {
    super(message, conflictJobId)
    this.name = 'SubmissionSaveError'
    this.outcome = outcome
  }
}

const SUMMARY_FIELDS =
  'id,user_id,job_id,is_primary,submitted_on,channel,note,created_at,supplemented_at,jd_updated_at,material_kind,resume_id,version_id,file_name,file_mime,file_size'

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
      status >= 400 && status < 500 && ![408, 499].includes(status)

    throw new SubmissionSaveError(
      detail?.error ?? '保存未能确认，请保留本次操作编号后重试',
      rejected ? 'rejected' : 'unknown',
      detail?.conflictJobId ?? null,
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

export async function getJobSubmissionState(
  jobId: string,
  assertUser?: SubmissionRequestGuard,
): Promise<JobSubmissionState> {
  const rows = await listJobSubmissions(jobId, assertUser)
  const primary = rows.find((row) => row.is_primary)

  if (primary)
    return {
      kind: 'ready',
      primary,
      legacy: rows.filter((row) => !row.is_primary),
    }

  return rows.length
    ? { kind: 'needs-resolution', legacy: rows }
    : { kind: 'none' }
}

export async function getJobSubmissionMaterial(
  id: string,
  assertUser?: SubmissionRequestGuard,
  revisionId?: string,
): Promise<JobSubmissionMaterial> {
  const data = await invokeSubmission(
    { id, revisionId, action: 'material' },
    undefined,
    assertUser,
  )

  const common = {
    jdText: data.jdText,
    jdUpdatedAt: data.jdUpdatedAt,
    submittedOn: data.submittedOn,
    channel: data.channel,
    note: data.note,
  }

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
      { id, revisionId, action: 'download' },
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

export async function getJobSubmissionJd(
  id: string,
  assertUser?: SubmissionRequestGuard,
): Promise<Pick<JobSubmissionMaterial, 'jdText' | 'jdUpdatedAt'>> {
  const data = await invokeSubmission(
    { id, action: 'material' },
    undefined,
    assertUser,
  )

  return { jdText: data.jdText, jdUpdatedAt: data.jdUpdatedAt }
}

export async function resolveJobSubmission(
  jobId: string,
  id: string,
  assertUser?: SubmissionRequestGuard,
): Promise<JobSubmission> {
  return invokeSubmission(
    { action: 'resolve', jobId, id },
    undefined,
    assertUser,
  )
}

export async function updateJobSubmissionDetails(
  id: string,
  fields: {
    submittedOn: string | null
    channel: string | null
    note: string | null
    reason: string
  },
  assertUser?: SubmissionRequestGuard,
): Promise<JobSubmission> {
  return invokeSubmission(
    { action: 'update-details', id, ...fields },
    undefined,
    assertUser,
  )
}

export async function correctJobSubmissionMaterial(
  id: string,
  material: SubmissionMaterialInput & { jobId: string; reason: string },
  assertUser?: SubmissionRequestGuard,
): Promise<JobSubmission> {
  const { file, ...fields } = material

  return invokeSubmission(
    { ...fields, id, action: 'correct-material' },
    file,
    assertUser,
  )
}

export async function listJobSubmissionRevisions(
  id: string,
  assertUser?: SubmissionRequestGuard,
): Promise<SubmissionRevision[]> {
  const user = await getCurrentUser()

  assertUser?.(user?.id ?? null)

  if (!user) throw new Error('请先登录')

  const { data, error } = await supabase
    .from('job_submission_revisions')
    .select('id,submission_id,created_at,reason')
    .eq('submission_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  assertUser?.(user.id)

  if (error) throw new Error('无法读取更正历史，请重试', { cause: error })

  return data ?? []
}
