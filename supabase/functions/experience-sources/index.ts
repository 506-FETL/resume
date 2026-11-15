/* global Deno */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import type {
  ExperienceSource,
  ExperienceSourceBlock,
} from '../shared/experience-source-contract.ts'
import {
  EXPERIENCE_MAX_BYTES,
  hashExperienceBytes,
  hashExperienceRequest,
} from '../shared/experience-source-contract.ts'
import {
  authenticateSupabaseUser,
  SupabaseAuthenticationError,
} from '../shared/supabase-auth.ts'
import { corsPreflightResponse, isOriginAllowed } from '../shared/cors.ts'
import { createRequestContext } from '../shared/request-context.ts'
import { parseExperienceInput, ExperienceRequestError } from './input.ts'
import type { ExperienceInput } from './input.ts'

const BUCKET = 'experience-source-originals'

const SOURCE_FIELDS =
  'id,name,kind,status,current_version_id,preview_text,created_at,updated_at'

const VERSION_FIELDS =
  'id,source_id,source_name,content_hash,file_name,file_mime,file_size,extractor_version,text_length,block_count,created_at'

const BLOCK_FIELDS = 'block_id,text,start_offset,end_offset,page'

type VersionRow = {
  id: string
  source_id: string
  source_name: string
  content_hash: string
  object_key: string | null
  file_name: string | null
  file_mime: string | null
  file_size: number | null
  extractor_version: number
  text_length: number
  block_count: number
  created_at: string
}

type SourceRow = {
  id: string
  name: string
  kind: ExperienceSource['kind']
  status: ExperienceSource['status']
  current_version_id: string | null
  preview_text: string
  created_at: string
  updated_at: string
}

function sourceResult(row: SourceRow): ExperienceSource {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    status: row.status,
    currentVersionId: row.current_version_id,
    previewText: row.preview_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function blockResult(row: {
  block_id: string
  text: string
  start_offset: number
  end_offset: number
  page: number | null
}): ExperienceSourceBlock {
  return {
    id: row.block_id,
    text: row.text,
    start: row.start_offset,
    end: row.end_offset,
    ...(row.page ? { page: row.page } : {}),
  }
}

function fail(code: string, message: string, status = 400): never {
  throw new ExperienceRequestError(code, message, status)
}

async function ownedSource(
  admin: SupabaseClient,
  owner: string,
  id: string,
  ready = true,
) {
  const { data, error } = await admin
    .from('experience_sources')
    .select(SOURCE_FIELDS)
    .eq('owner_id', owner)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) fail('source_not_found', '资料不存在或已删除。', 404)
  if (ready && data.status !== 'ready')
    fail(
      'source_unavailable',
      '这份资料暂时无法读取，请检查保存或删除状态。',
      409,
    )

  return data as SourceRow
}

async function ownedTarget(
  admin: SupabaseClient,
  owner: string,
  target: 'conversation' | 'resume',
  id: string,
) {
  const { data, error } = await admin
    .from(target === 'conversation' ? 'ai_conversations' : 'resume_config')
    .select(target === 'conversation' ? 'id' : 'resume_id')
    .eq('user_id', owner)
    .eq(target === 'conversation' ? 'id' : 'resume_id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) fail('target_not_found', '会话或简历不存在。', 404)
}

async function boundedForm(request: Request): Promise<FormData> {
  const reader = request.body?.getReader()

  if (!reader) fail('invalid_request', '请求为空。')

  const chunks: ArrayBuffer[] = []
  let size = 0

  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    size += value.byteLength

    if (size > EXPERIENCE_MAX_BYTES + 8 * 1024 * 1024) {
      await reader.cancel()
      fail('too_large', '文件或提取内容过大。', 413)
    }

    chunks.push(new Uint8Array(value).buffer)
  }

  try {
    return await new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: new Blob(chunks),
    }).formData()
  } catch {
    return fail('invalid_request', '请求格式无效。')
  }
}

async function handleExperienceInput(
  admin: SupabaseClient,
  owner: string,
  input: ExperienceInput,
  file: File | null,
): Promise<unknown | Response> {
  switch (input.action) {
    case 'metadata': {
      if (!input.sourceIds.length) return { items: [], missingIds: [] }

      const { data, error } = await admin
        .from('experience_sources')
        .select('id,name,status,current_version_id,updated_at')
        .eq('owner_id', owner)
        .in('id', input.sourceIds)

      if (error) throw error

      const items = (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        currentVersionId: row.current_version_id,
        updatedAt: row.updated_at,
      }))

      return {
        items,
        missingIds: input.sourceIds.filter(
          (id) => !items.some((item) => item.id === id),
        ),
      }
    }

    case 'list': {
      let query = admin
        .from('experience_sources')
        .select(SOURCE_FIELDS, { count: 'exact' })
        .eq('owner_id', owner)

      if (input.kind === 'paste') query = query.eq('kind', 'paste')
      else if (input.kind === 'files') query = query.neq('kind', 'paste')

      if (input.query)
        query = query.ilike(
          'name',
          `%${input.query.replace(/[\\%_]/g, '\\$&')}%`,
        )

      const { data, error, count } = await query
        .order('updated_at', { ascending: false })
        .order('id')
        .range(input.offset, input.offset + input.limit - 1)

      if (error) throw error

      return {
        items: (data ?? []).map(sourceResult),
        total: count ?? 0,
        hasMore: input.offset + (data?.length ?? 0) < (count ?? 0),
      }
    }

    case 'operation': {
      const { data, error } = await admin
        .from('experience_source_operations')
        .select('operation_id,source_id,version_id,status,reused,request_hash')
        .eq('owner_id', owner)
        .eq('operation_id', input.operationId)
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      const source = await ownedSource(admin, owner, data.source_id, false)

      return {
        operationId: data.operation_id,
        requestHash: data.request_hash,
        status: data.status,
        result:
          data.status === 'ready' && source.status === 'ready'
            ? {
                source: sourceResult(source),
                versionId: data.version_id,
                reused: data.reused,
              }
            : null,
      }
    }

    case 'save': {
      const { validateExperienceFile } = await import('./files.ts')
      const extracted = input.extracted
      const fileMetadata = await validateExperienceFile(file, extracted)

      const bytes = file
        ? await file.arrayBuffer()
        : new TextEncoder().encode(extracted.text).buffer

      const contentHash = await hashExperienceBytes(bytes)

      const requestHash = await hashExperienceRequest({
        sourceId: input.sourceId,
        name: input.name,
        contentHash,
        extracted,
      })

      const { data: reserved, error: reserveError } = await admin.rpc(
        'reserve_experience_source',
        {
          p_owner: owner,
          p_operation: input.operationId,
          p_source: input.sourceId ?? null,
          p_name: input.name,
          p_kind: extracted.kind,
          p_hash: contentHash,
          p_request_hash: requestHash,
          p_has_file: Boolean(file),
        },
      )

      if (reserveError) throw reserveError
      if (reserved.ready)
        return {
          source: sourceResult(reserved.source),
          versionId: reserved.versionId,
          reused: reserved.reused,
        }

      try {
        if (file && reserved.objectKey) {
          const { error } = await admin.storage
            .from(BUCKET)
            .upload(reserved.objectKey, bytes, {
              contentType: fileMetadata.fileMime ?? 'application/octet-stream',
              upsert: false,
            })

          if (error) {
            if (
              !['409', 'Duplicate'].includes(
                String(error.statusCode ?? error.name),
              )
            )
              throw error

            const { data: previous, error: previousError } = await admin.storage
              .from(BUCKET)
              .download(reserved.objectKey)

            if (
              previousError ||
              !previous ||
              (await hashExperienceBytes(await previous.arrayBuffer())) !==
                contentHash
            )
              throw error
          }
        }

        const { data, error } = await admin.rpc('finish_experience_source', {
          p_owner: owner,
          p_operation: input.operationId,
          p_input: {
            name: input.name,
            kind: extracted.kind,
            sourceName: extracted.sourceName,
            contentHash,
            text: extracted.text,
            textLength: extracted.text.length,
            blocks: extracted.blocks,
            extractorVersion: extracted.extractorVersion,
            ...fileMetadata,
          },
        })

        if (error) throw error
        if (data.unusedObjectKey) {
          const { error: cleanupError } = await admin.storage
            .from(BUCKET)
            .remove([data.unusedObjectKey])

          if (cleanupError) throw cleanupError
        }

        return {
          source: sourceResult(data.source),
          versionId: data.versionId,
          reused: data.reused,
        }
      } catch (error) {
        // 先核对事务结果；响应丢失不能把已经完成的入库改成失败。
        const { data: operation, error: checkError } = await admin
          .from('experience_source_operations')
          .select('status')
          .eq('owner_id', owner)
          .eq('operation_id', input.operationId)
          .maybeSingle()

        if (!checkError && operation?.status !== 'ready') {
          await admin
            .from('experience_source_operations')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('owner_id', owner)
            .eq('operation_id', input.operationId)
            .eq('status', 'pending')

          await admin
            .from('experience_sources')
            .update({
              status: 'upload-failed',
              updated_at: new Date().toISOString(),
            })
            .eq('owner_id', owner)
            .eq('id', reserved.source.id)
            .is('current_version_id', null)
            .eq('status', 'uploading')
        }

        throw error
      }
    }

    case 'read':
    case 'download': {
      const source = await ownedSource(admin, owner, input.sourceId)
      const versionId = input.versionId ?? source.current_version_id

      const versionFields: string =
        input.action === 'download'
          ? 'id,object_key,file_name,file_mime'
          : VERSION_FIELDS

      const { data: versionRow, error: versionError } = await admin
        .from('experience_source_versions')
        .select(versionFields)
        .eq('owner_id', owner)
        .eq('source_id', source.id)
        .eq('id', versionId)
        .maybeSingle()

      if (versionError) throw versionError
      if (!versionRow) fail('version_not_found', '这个资料版本不存在。', 404)

      const version = versionRow as unknown as VersionRow

      if (input.action === 'download') {
        if (!version.object_key)
          fail('no_original', '这份资料来自粘贴文字，没有原文件。', 404)

        const { data: original, error } = await admin.storage
          .from(BUCKET)
          .download(version.object_key)

        if (error || !original)
          fail('original_unavailable', '原文件暂时无法下载，请稍后重试。', 503)

        await ownedSource(admin, owner, source.id)

        return new Response(original, {
          headers: {
            'Content-Type': version.file_mime ?? 'application/octet-stream',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(version.file_name ?? '资料')}`,
            'Cache-Control': 'no-store',
          },
        })
      }

      let query = admin
        .from('experience_source_blocks')
        .select(BLOCK_FIELDS)
        .eq('version_id', versionId)
        .order('ordinal')

      if (input.blockIds) query = query.in('block_id', input.blockIds)

      const { data: blocks, error } = await query.range(
        input.offset,
        input.offset + input.limit,
      )

      if (error) throw error
      if (
        input.blockIds?.some(
          (id) => !(blocks ?? []).some((block) => block.block_id === id),
        )
      )
        fail('block_not_found', '引用的原文段落不存在。', 404)

      await ownedSource(admin, owner, source.id)

      return {
        source: sourceResult(source),
        version: {
          id: version.id,
          sourceId: version.source_id,
          sourceName: version.source_name,
          contentHash: version.content_hash,
          fileName: version.file_name,
          fileMime: version.file_mime,
          fileSize: version.file_size,
          extractorVersion: version.extractor_version,
          textLength: version.text_length,
          blockCount: version.block_count,
          createdAt: version.created_at,
        },
        blocks: (blocks ?? []).slice(0, input.limit).map(blockResult),
        hasMore: (blocks?.length ?? 0) > input.limit,
      }
    }

    case 'rename': {
      const { data, error } = await admin
        .from('experience_sources')
        .update({ name: input.name, updated_at: new Date().toISOString() })
        .eq('owner_id', owner)
        .eq('id', input.sourceId)
        .eq('status', 'ready')
        .select(SOURCE_FIELDS)
        .maybeSingle()

      if (error) throw error
      if (!data) fail('source_not_found', '资料不存在或暂时无法修改。', 404)

      return sourceResult(data)
    }

    case 'delete': {
      const { data: paths, error } = await admin.rpc(
        'begin_delete_experience_source',
        { p_owner: owner, p_source: input.sourceId },
      )

      if (error) throw error

      if (paths.length) {
        for (let offset = 0; offset < paths.length; offset += 100) {
          const { error: removeError } = await admin.storage
            .from(BUCKET)
            .remove(paths.slice(offset, offset + 100))

          if (removeError) {
            await admin
              .from('experience_sources')
              .update({
                status: 'delete-failed',
                updated_at: new Date().toISOString(),
              })
              .eq('owner_id', owner)
              .eq('id', input.sourceId)

            fail('delete_failed', '原文件未能全部删除，请重试删除。', 503)
          }
        }
      }

      const { error: deleteError } = await admin
        .from('experience_sources')
        .delete()
        .eq('owner_id', owner)
        .eq('id', input.sourceId)
        .in('status', ['deleting', 'delete-failed'])

      if (deleteError) throw deleteError

      return { deleted: true }
    }

    case 'search': {
      if (!input.sourceIds.length) return { matches: [] }

      const { data: sources, error: sourceError } = await admin
        .from('experience_sources')
        .select('id')
        .eq('owner_id', owner)
        .eq('status', 'ready')
        .in('id', input.sourceIds)

      if (sourceError) throw sourceError
      if (new Set(input.sourceIds).size !== sources?.length)
        fail('source_not_found', '选中的资料不存在或暂时无法读取。', 404)

      if (input.references) {
        const { data: versions, error } = await admin
          .from('experience_source_versions')
          .select('id,source_id')
          .eq('owner_id', owner)
          .in(
            'id',
            input.references.map((ref) => ref.versionId),
          )

        if (error) throw error
        if (
          input.references.some(
            (ref) =>
              !versions?.some(
                (version) =>
                  version.id === ref.versionId &&
                  version.source_id === ref.sourceId,
              ),
          )
        )
          fail('version_not_found', '选中的资料版本不存在。', 404)
      }

      const { data, error } = await admin.rpc('search_experience_sources', {
        p_owner: owner,
        p_source_ids: input.sourceIds,
        p_query: input.query,
        p_limit: input.limit,
        p_references: input.references ?? null,
      })

      if (error) throw error

      return { matches: data }
    }

    case 'relations':
    case 'set-relations': {
      await ownedTarget(admin, owner, input.target, input.targetId)

      if (input.action === 'set-relations') {
        const { error } = await admin.rpc('set_experience_source_relations', {
          p_owner: owner,
          p_target: input.target,
          p_target_id: input.targetId,
          p_references: input.references,
        })

        if (error) throw error
      }

      const { data, error } = await admin
        .from('experience_source_relations')
        .select(
          'source_id,version_id,source:experience_sources!experience_source_relations_source_id_owner_id_fkey(name,status,current_version_id,updated_at)',
        )
        .eq('owner_id', owner)
        .eq(
          input.target === 'conversation' ? 'conversation_id' : 'resume_id',
          input.targetId,
        )
        .order('created_at')

      if (error) throw error

      return (data ?? []).flatMap((row) => {
        const source = row.source as unknown as {
          name: string
          status: string
          current_version_id: string | null
          updated_at: string
        } | null

        return source?.status === 'ready'
          ? [
              {
                sourceId: row.source_id,
                versionId: row.version_id,
                name: source.name,
                currentVersionId: source.current_version_id,
                updatedAt: source.updated_at,
              },
            ]
          : []
      })
    }
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS')
    return corsPreflightResponse(request, 'allowlist')

  const headers = createRequestContext(
    request,
    'experience-sources',
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
    return respond({ code: 'invalid_request', error: '请求无效。' }, 400)

  try {
    const url = Deno.env.get('SUPABASE_URL') ?? ''

    const admin = createClient(
      url,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { userId } = await authenticateSupabaseUser({
      request,
      client: admin,
      supabaseUrl: url,
    })

    if (!userId)
      return respond({ code: 'unauthorized', error: '请先登录。' }, 401)

    const form = await boundedForm(request)
    let raw: unknown

    try {
      raw = JSON.parse(String(form.get('input') ?? '{}'))
    } catch {
      return respond({ code: 'invalid_request', error: '请求内容无效。' }, 400)
    }

    const input = parseExperienceInput(raw)
    const file = form.get('file')

    const result = await handleExperienceInput(
      admin,
      userId,
      input,
      file instanceof File ? file : null,
    )

    if (result instanceof Response) {
      for (const [key, value] of headers) result.headers.set(key, value)

      return result
    }

    return respond(result)
  } catch (error) {
    if (error instanceof SupabaseAuthenticationError)
      return respond(
        { code: 'unauthorized', error: '登录已失效，请重新登录。' },
        401,
      )
    if (error instanceof ExperienceRequestError)
      return respond({ code: error.code, error: error.message }, error.status)

    const code = (error as { message?: string })?.message

    const known: Record<string, [number, string]> = {
      operation_conflict: [409, '本次操作内容已改变，请重新发起保存。'],
      source_not_found: [404, '资料不存在或已删除。'],
      source_unavailable: [409, '资料正在删除，暂时无法读取或更新。'],
      target_not_found: [404, '会话或简历不存在。'],
      upload_in_progress: [409, '资料仍在保存，请稍后重试删除。'],
    }

    if (code && known[code])
      return respond({ code, error: known[code][1] }, known[code][0])

    return respond(
      { code: 'unavailable', error: '请求结果暂未确认，请稍后重试。' },
      503,
    )
  }
})
