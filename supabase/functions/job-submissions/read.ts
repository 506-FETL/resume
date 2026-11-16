import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import { UUID, BUCKET } from './constants.ts'

interface SubmissionMaterialRow {
  job_id: string
  material_kind: string
  file_path: string
  file_name: string
  [key: string]: unknown
}

export async function readSubmissionMaterial({
  admin,
  userId,
  input,
  id,
  action,
  respond,
  headers,
}: {
  admin: SupabaseClient
  userId: string
  input: Record<string, unknown>
  id: string
  action: 'material' | 'download'
  respond: (body: unknown, status?: number) => Response
  headers: Headers
}): Promise<Response> {
  const currentFields: string =
    input.revisionId != null
      ? 'id'
      : action === 'download'
        ? 'job_id,material_kind,file_path,file_name'
        : '*'

  const { data: current, error } = await admin
    .from('job_submissions')
    .select(currentFields)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!current) return respond({ error: '投递记录不存在' }, 404)

  let row = current as unknown as SubmissionMaterialRow

  if (input.revisionId != null) {
    if (!UUID.test(String(input.revisionId)))
      return respond({ error: '历史编号无效' }, 400)

    const revisionFields: string =
      action === 'download'
        ? 'job_id:before_snapshot->>job_id,material_kind:before_snapshot->>material_kind,file_path:before_snapshot->>file_path,file_name:before_snapshot->>file_name'
        : 'before_snapshot'

    const { data: revision, error: revisionError } = await admin
      .from('job_submission_revisions')
      .select(revisionFields)
      .eq('id', input.revisionId)
      .eq('submission_id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (revisionError) throw revisionError
    if (!revision) return respond({ error: '更正历史不存在' }, 404)

    row =
      action === 'download'
        ? (revision as unknown as SubmissionMaterialRow)
        : (
            revision as unknown as {
              before_snapshot: SubmissionMaterialRow
            }
          ).before_snapshot
  }

  const { data: job, error: jobError } = await admin
    .from('company')
    .select('id')
    .eq('id', row.job_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (jobError) throw jobError
  if (!job) return respond({ error: '岗位不存在' }, 404)

  if (action === 'download') {
    if (row.material_kind !== 'file')
      return respond({ error: '没有文件材料' }, 400)

    const { data, error: downloadError } = await admin.storage
      .from(BUCKET)
      .download(row.file_path)

    if (downloadError) throw downloadError

    // functions-js decodes DOCX MIME as text; use its binary response contract.
    headers.set('Content-Type', 'application/octet-stream')

    headers.set(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
    )

    return new Response(data, { headers })
  }

  return respond({
    submittedOn: row.submitted_on,
    channel: row.channel,
    note: row.note,
    kind: row.material_kind,
    snapshot: row.snapshot,
    templateManifest: row.template_manifest,
    projectionReferenceDate: row.projection_reference_date,
    jdText: row.jd_text,
    jdUpdatedAt: row.jd_updated_at,
    fileName: row.file_name,
    fileMime: row.file_mime,
    fileSize: row.file_size,
  })
}
