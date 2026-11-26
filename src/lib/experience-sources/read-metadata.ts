import { z } from 'zod'
import supabase from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/supabase/user'
import { ExperienceSourceError, type ExperienceSourceMetadata } from './types'

const sourceBatch = z.array(z.uuid()).max(100)

export async function readExperienceSourceMetadata(
  sourceIds: string[],
  signal?: AbortSignal,
): Promise<{ items: ExperienceSourceMetadata[]; missingIds: string[] }> {
  if (!sourceIds.length) return { items: [], missingIds: [] }

  const owner = await getCurrentUser()

  signal?.throwIfAborted()

  if (!owner)
    throw new ExperienceSourceError('请先登录后使用职业档案。', 'unauthorized')

  if (!sourceBatch.safeParse(sourceIds).success)
    throw new ExperienceSourceError('资料编号或数量无效。', 'invalid_request')

  const ids = [...new Set(sourceIds)]

  const request = supabase
    .from('experience_sources')
    .select('id,conversation_id,name,status,current_version_id,updated_at')
    .eq('owner_id', owner.id)
    .in('id', ids)
    .retry(false)

  if (signal) request.abortSignal(signal)

  const { data, error } = await request

  signal?.throwIfAborted()

  if (error)
    throw new ExperienceSourceError('资料状态读取失败，请重试。', 'unavailable')

  const items = data.map((row) => ({
    id: row.id,
    ...(row.conversation_id ? { conversationId: row.conversation_id } : {}),
    name: row.name,
    status: row.status,
    currentVersionId: row.current_version_id,
    updatedAt: row.updated_at,
  }))

  const found = new Set(items.map((source) => source.id))

  return { items, missingIds: ids.filter((id) => !found.has(id)) }
}
