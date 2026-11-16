import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import type { ExperienceInput } from './input.ts'
import { fail } from './errors.ts'

export async function searchExperienceSources(
  admin: SupabaseClient,
  owner: string,
  input: Extract<ExperienceInput, { action: 'search' }>,
): Promise<unknown | Response> {
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
