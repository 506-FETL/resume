import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import type { ExperienceInput } from './input.ts'
import { SOURCE_FIELDS, sourceResult } from './records.ts'
import { fail } from './errors.ts'
import { deleteSource } from './repository.ts'

export async function renameExperienceSource(
  admin: SupabaseClient,
  owner: string,
  input: Extract<ExperienceInput, { action: 'rename' }>,
): Promise<unknown | Response> {
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

export async function deleteExperienceSource(
  admin: SupabaseClient,
  owner: string,
  input: Extract<ExperienceInput, { action: 'delete' }>,
): Promise<unknown | Response> {
  await deleteSource(admin, owner, input.sourceId)

  return { deleted: true }
}

export async function deleteExperienceConversation(
  admin: SupabaseClient,
  owner: string,
  input: Extract<ExperienceInput, { action: 'delete-conversation' }>,
): Promise<unknown | Response> {
  const { data: conversation, error: targetError } = await admin
    .from('ai_conversations')
    .select('id')
    .eq('user_id', owner)
    .eq('id', input.conversationId)
    .maybeSingle()

  if (targetError) throw targetError
  if (!conversation) return { deleted: true }

  while (true) {
    const { data: sources, error } = await admin
      .from('experience_sources')
      .select('id')
      .eq('owner_id', owner)
      .eq('conversation_id', input.conversationId)
      .order('id')
      .limit(100)

    if (error) throw error
    if (!sources.length) break

    for (const source of sources) await deleteSource(admin, owner, source.id)
  }

  const { error: deleteError } = await admin
    .from('ai_conversations')
    .delete()
    .eq('user_id', owner)
    .eq('id', input.conversationId)

  if (deleteError?.code === '23503')
    fail(
      'conversation_files_remaining',
      '对话仍有文件正在保存，请稍后重试删除。',
      409,
    )
  if (deleteError) throw deleteError

  return { deleted: true }
}
