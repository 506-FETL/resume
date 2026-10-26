/* global Deno */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import { corsPreflightResponse, isOriginAllowed } from '../shared/cors.ts'
import {
  authenticateSupabaseUser,
  SupabaseAuthenticationError,
} from '../shared/supabase-auth.ts'
import { createRequestContext } from '../shared/request-context.ts'
import { validateSubmissionFile } from './files.ts'

const BUCKET = 'job-submission-materials'

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS')
    return corsPreflightResponse(request, 'allowlist')

  const headers = createRequestContext(
    request,
    'job-submissions',
    'allowlist',
  ).responseHeaders()

  headers.set('Cache-Control', 'no-store')

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...Object.fromEntries(headers),
        'Content-Type': 'application/json',
      },
    })

  if (request.method !== 'POST' || !isOriginAllowed(request, 'allowlist'))
    return respond({ error: '请求无效' }, 400)

  const url = Deno.env.get('SUPABASE_URL') ?? ''

  const admin = createClient(
    url,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )

  let uploadedPath: string | null = null

  try {
    const { userId } = await authenticateSupabaseUser({
      request,
      client: admin,
      supabaseUrl: url,
    })

    if (!userId) return respond({ error: '请先登录' }, 401)

    // Stream-bound multipart before parsing, including clients without Content-Length.
    const reader = request.body?.getReader()
    const chunks: Uint8Array[] = []
    let size = 0

    if (!reader) return respond({ error: '请求为空' }, 400)

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      size += value.byteLength

      if (size > 11 * 1024 * 1024) {
        await reader.cancel()

        return respond({ error: '文件须为 10 MB 以内' }, 413)
      }

      chunks.push(value)
    }

    const bodyRequest = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: new Blob(chunks.map((chunk) => new Uint8Array(chunk).buffer)),
    })

    const form = await bodyRequest.formData()

    const input = JSON.parse(String(form.get('input') ?? '{}')) as Record<
      string,
      unknown
    >

    if (!input || typeof input !== 'object' || Array.isArray(input))
      return respond({ error: '请求内容无效' }, 400)

    const id = String(input.id ?? '')
    const action = input.action

    if (!UUID.test(id)) return respond({ error: '记录编号无效' }, 400)

    if (action === 'material' || action === 'download') {
      const { data: row, error } = await admin
        .from('job_submissions')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle()

      if (error) throw error
      if (!row) return respond({ error: '投递记录不存在' }, 404)

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

    if (action !== 'record' && action !== 'supplement')
      return respond({ error: '操作无效' }, 400)

    const jobId = String(input.jobId ?? '')
    const kind = input.materialKind

    if (
      !UUID.test(jobId) ||
      !['pending', 'platform', 'file'].includes(String(kind))
    )
      return respond({ error: '岗位或材料来源无效' }, 400)
    if (action === 'supplement' && kind === 'pending')
      return respond({ error: '请选择补充材料' }, 400)
    if (
      input.submittedOn != null &&
      (typeof input.submittedOn !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(input.submittedOn) ||
        Number.isNaN(new Date(input.submittedOn).getTime()) ||
        new Date(input.submittedOn).toISOString().slice(0, 10) !==
          input.submittedOn)
    )
      return respond({ error: '投递日期无效' }, 400)
    if (
      (input.channel != null &&
        (typeof input.channel !== 'string' || input.channel.length > 200)) ||
      (input.note != null &&
        (typeof input.note !== 'string' || input.note.length > 4000))
    )
      return respond({ error: '渠道或备注过长' }, 400)
    if (
      kind === 'platform' &&
      (!UUID.test(String(input.resumeId ?? '')) ||
        (input.versionId != null &&
          (!Number.isSafeInteger(input.versionId) ||
            Number(input.versionId) <= 0)))
    )
      return respond({ error: '简历版本无效' }, 400)

    // Ownership before accepting/uploading bytes. The RPC checks again under lock.
    const { data: job, error: ownershipError } = await admin
      .from('company')
      .select('id')
      .eq('id', jobId)
      .eq('user_id', userId)
      .maybeSingle()

    if (ownershipError) throw ownershipError
    if (!job) return respond({ error: '岗位不存在' }, 404)

    let material: Record<string, unknown> = { kind }

    if (kind === 'platform') {
      material = {
        kind,
        resumeId: input.resumeId,
        versionId: input.versionId ?? null,
      }
    } else if (kind === 'file') {
      const file = form.get('file')

      if (!(file instanceof File) || file.name.length > 255)
        return respond({ error: '请选择有效原文件' }, 400)

      const checked = await validateSubmissionFile(file)
      const path = `${userId}/${id}/${crypto.randomUUID()}.${checked.extension}`

      const { error } = await admin.storage
        .from(BUCKET)
        .upload(path, checked.bytes, {
          contentType: checked.mime,
          upsert: false,
        })

      if (error) throw error

      uploadedPath = path
      material = {
        kind,
        path,
        name: file.name,
        mime: checked.mime,
        size: file.size,
        hash: checked.hash,
      }
    }

    const { data, error } = await admin.rpc('save_job_submission', {
      p_user_id: userId,
      p_id: id,
      p_job_id: jobId,
      p_input:
        action === 'supplement'
          ? {}
          : {
              submittedOn: input.submittedOn ?? null,
              channel: input.channel ?? null,
              note: input.note ?? null,
            },
      p_material: material,
      p_supplement: action === 'supplement',
    })

    if (error) throw error

    if (uploadedPath) {
      const { data: saved, error: readError } = await admin
        .from('job_submissions')
        .select('file_path')
        .eq('id', id)
        .eq('user_id', userId)
        .single()

      if (readError) {
        // Unknown transaction outcome: do not delete a potentially committed file.
        uploadedPath = null

        throw readError
      }
      if (saved.file_path !== uploadedPath)
        await admin.storage.from(BUCKET).remove([uploadedPath])

      uploadedPath = null
    }

    return respond(data)
  } catch (error) {
    if (uploadedPath) {
      // PostgREST transport errors can hide a committed transaction. Check before cleanup.
      const { data: referenced, error: checkError } = await admin
        .from('job_submissions')
        .select('id')
        .eq('file_path', uploadedPath)
        .maybeSingle()

      if (!checkError && !referenced)
        await admin.storage.from(BUCKET).remove([uploadedPath])
    }

    if (error instanceof SupabaseAuthenticationError)
      return respond({ error: '请重新登录' }, 401)
    if (error instanceof SyntaxError)
      return respond({ error: '请求内容无效' }, 400)

    const message =
      error instanceof Error
        ? error.message
        : String((error as { message?: string })?.message ?? '')

    const conflict = /conflict|already_saved/.test(message)
    const denied = /not_found|unauthorized/.test(message)
    const invalid = /template_missing|invalid|文件|PDF|DOCX/.test(message)

    return respond(
      {
        error: conflict
          ? '记录已保存且内容不同，请刷新后查看'
          : denied
            ? '记录不存在或无权访问'
            : /template_missing/.test(message)
              ? '指定模板版本不可用，请保留表单并重试'
              : invalid
                ? message
                : '保存未能确认，请保留本次操作编号后重试',
      },
      conflict ? 409 : denied ? 403 : invalid ? 400 : 503,
    )
  }
})
