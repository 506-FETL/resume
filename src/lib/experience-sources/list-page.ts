import supabase from '@/lib/supabase/client'
import type { ExperienceSource } from './types'

const ARCHIVE_FIELDS =
  'id,name,kind,status,currentVersionId:current_version_id,previewText:preview_text,createdAt:created_at,updatedAt:updated_at'

export async function listArchivePage(
  ownerId: string,
  offset: number,
  kind?: 'files' | 'paste',
) {
  let request = supabase
    .from('experience_sources')
    .select(ARCHIVE_FIELDS, { count: 'exact' })
    .eq('owner_id', ownerId)
    .is('conversation_id', null)

  if (kind === 'files') request = request.neq('kind', 'paste')
  if (kind === 'paste') request = request.eq('kind', 'paste')

  const { data, count, error } = await request
    .order('updated_at', { ascending: false })
    .order('id')
    .range(offset, offset + 9)
    .retry(false)
    .overrideTypes<ExperienceSource[], { merge: false }>()

  // 当前页被其他操作删空时，PostgREST 返回 416，SDK 不保留这次响应的总数。
  if (offset > 0 && error?.code === 'PGRST103') {
    const remaining = await request.range(0, 0).limit(0).retry(false)

    if (!remaining.error && remaining.count !== null)
      return { items: [], total: remaining.count, hasMore: false }
  }

  if (error || count === null) throw new Error('职业档案暂时无法读取，请重试。')

  return { items: data, total: count, hasMore: offset + data.length < count }
}
