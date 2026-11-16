import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import type { ExperienceInput } from './input.ts'
import { SOURCE_FIELDS, sourceResult } from './records.ts'
import { ownedSource } from './repository.ts'

export async function loadExperienceMetadata(
  admin: SupabaseClient,
  owner: string,
  input: Extract<ExperienceInput, { action: 'metadata' }>,
): Promise<unknown | Response> {
  if (!input.sourceIds.length) return { items: [], missingIds: [] }

  const { data, error } = await admin
    .from('experience_sources')
    .select('id,conversation_id,name,status,current_version_id,updated_at')
    .eq('owner_id', owner)
    .in('id', input.sourceIds)

  if (error) throw error

  const items = (data ?? []).map((row) => ({
    id: row.id,
    ...(row.conversation_id ? { conversationId: row.conversation_id } : {}),
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

export async function listExperienceSources(
  admin: SupabaseClient,
  owner: string,
  input: Extract<ExperienceInput, { action: 'list' }>,
): Promise<unknown | Response> {
  let query = admin
    .from('experience_sources')
    .select(SOURCE_FIELDS, { count: 'exact' })
    .eq('owner_id', owner)
    .is('conversation_id', null)

  if (input.kind === 'paste') query = query.eq('kind', 'paste')
  else if (input.kind === 'files') query = query.neq('kind', 'paste')

  if (input.query)
    query = query.ilike('name', `%${input.query.replace(/[\\%_]/g, '\\$&')}%`)

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

export async function readExperienceOperation(
  admin: SupabaseClient,
  owner: string,
  input: Extract<ExperienceInput, { action: 'operation' }>,
): Promise<unknown | Response> {
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
