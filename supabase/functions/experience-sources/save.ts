import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import type { ExperienceInput } from './input.ts'
import {
  hashExperienceBytes,
  hashExperienceRequest,
} from '../shared/experience-source-contract.ts'
import { sourceResult } from './records.ts'
import { BUCKET } from './constants.ts'

export async function saveExperienceSource(
  admin: SupabaseClient,
  owner: string,
  input: Extract<ExperienceInput, { action: 'save' }>,
  file: File | null,
): Promise<unknown | Response> {
  const { validateExperienceFile } = await import('./files.ts')
  const extracted = input.extracted
  const fileMetadata = await validateExperienceFile(file, extracted)

  const bytes = file
    ? await file.arrayBuffer()
    : new TextEncoder().encode(extracted.text).buffer

  const contentHash = await hashExperienceBytes(bytes)

  const requestHash = await hashExperienceRequest({
    sourceId: input.sourceId,
    conversationId: input.conversationId,
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
      p_conversation: input.conversationId ?? null,
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
          !['409', 'Duplicate'].includes(String(error.statusCode ?? error.name))
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
