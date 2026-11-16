import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import type { ExperienceInput } from './input.ts'
import { ownedTarget } from './repository.ts'

export async function handleExperienceRelations(
  admin: SupabaseClient,
  owner: string,
  input: Extract<ExperienceInput, { action: 'relations' | 'set-relations' }>,
): Promise<unknown | Response> {
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
