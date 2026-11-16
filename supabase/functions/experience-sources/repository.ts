import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import type { SourceRow } from './records.ts'
import { SOURCE_FIELDS } from './records.ts'
import { fail } from './errors.ts'
import { BUCKET } from './constants.ts'

export async function ownedSource(
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

export async function ownedTarget(
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

export async function deleteSource(
  admin: SupabaseClient,
  owner: string,
  sourceId: string,
) {
  const { data: paths, error } = await admin.rpc(
    'begin_delete_experience_source',
    { p_owner: owner, p_source: sourceId },
  )

  if (error) throw error

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
        .eq('id', sourceId)

      fail('delete_failed', '原文件未能全部删除，请重试删除。', 503)
    }
  }

  const { error: deleteError } = await admin
    .from('experience_sources')
    .delete()
    .eq('owner_id', owner)
    .eq('id', sourceId)
    .in('status', ['deleting', 'delete-failed'])

  if (deleteError) throw deleteError
}
