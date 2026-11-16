import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import type { ExperienceInput } from './input.ts'
import { ownedSource } from './repository.ts'
import type { VersionRow } from './records.ts'
import {
  VERSION_FIELDS,
  BLOCK_FIELDS,
  sourceResult,
  blockResult,
} from './records.ts'
import { fail } from './errors.ts'
import { BUCKET } from './constants.ts'

export async function readExperienceSource(
  admin: SupabaseClient,
  owner: string,
  input: Extract<ExperienceInput, { action: 'read' | 'download' }>,
): Promise<unknown | Response> {
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
