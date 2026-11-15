import type { ExperienceSourceRelation } from '@/lib/experience-sources/types'
import type { AiUserReference } from '@/lib/ai/types'
import supabase from '@/lib/supabase/client'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import useUserStore from '@/store/user'

type SourceScopeTarget = {
  ownerId: string
  conversationId: string | null
  resumeId: string | null
  scopeRevision: number
}

const details = new Map<
  string,
  {
    conversation: ExperienceSourceRelation[]
    resume: ExperienceSourceRelation[]
  }
>()

const scopes = new Map<string, ExperienceSourceRelation[]>()
const pending = new Map<string, Promise<ExperienceSourceRelation[]>>()

export function sourceScopeKey(target: SourceScopeTarget) {
  const { generation, revision } = useExperienceSourcesStore.getState()

  return JSON.stringify([target, generation, revision])
}

export function peekSourceScopeDetails(target: SourceScopeTarget) {
  return details.get(sourceScopeKey(target)) ?? { conversation: [], resume: [] }
}

export function peekSourceScope(target: SourceScopeTarget) {
  return scopes.get(sourceScopeKey(target))
}

export function loadSourceScope(
  target: SourceScopeTarget,
): Promise<ExperienceSourceRelation[]> {
  const key = sourceScopeKey(target)
  const cached = scopes.get(key)

  if (cached) return Promise.resolve(cached)

  const pendingKey = `scope:${key}`
  const current = pending.get(pendingKey)

  if (current) return current

  const request = Promise.all([
    loadLibraryScope(target),
    target.conversationId
      ? loadSourceCatalog(target.ownerId, target.conversationId)
      : Promise.resolve([]),
  ])
    .then(([library, conversation]) => {
      if (
        sourceScopeKey(target) !== key ||
        useUserStore.getState().currentUser?.id !== target.ownerId
      )
        throw new Error('资料已变化，请重新读取。')

      const sources = [...library, ...conversation]

      scopes.set(key, sources)
      details.set(key, { conversation, resume: [] })

      return sources
    })
    .finally(() => {
      if (pending.get(pendingKey) === request) pending.delete(pendingKey)
    })

  pending.set(pendingKey, request)

  return request
}

export function loadLibraryScope(
  target?: SourceScopeTarget,
): Promise<ExperienceSourceRelation[]> {
  const ownerId =
    target?.ownerId ?? useUserStore.getState().currentUser?.id ?? ''

  return loadSourceCatalog(ownerId, null)
}

function loadSourceCatalog(
  ownerId: string,
  conversationId: string | null,
): Promise<ExperienceSourceRelation[]> {
  const target = { ownerId, conversationId, resumeId: null, scopeRevision: 0 }
  const key = `catalog:${sourceScopeKey(target)}`
  const cached = scopes.get(key)

  if (cached) return Promise.resolve(cached)

  const current = pending.get(key)

  if (current) return current

  const request = (async () => {
    const sources: ExperienceSourceRelation[] = []
    let after: string | undefined

    while (true) {
      let query = supabase
        .from('experience_sources')
        .select('id,name,current_version_id,updated_at')
        .eq('owner_id', ownerId)
        .eq('status', 'ready')
        .neq('kind', 'image')
        .order('id')
        .limit(200)

      query = conversationId
        ? query.eq('conversation_id', conversationId)
        : query.is('conversation_id', null)

      if (after) query = query.gt('id', after)

      const { data, error } = await query

      if (error) throw error
      if (
        useUserStore.getState().currentUser?.id !== ownerId ||
        `catalog:${sourceScopeKey(target)}` !== key
      )
        throw new Error('资料已变化，请重新读取。')

      for (const source of data) {
        if (source.current_version_id)
          sources.push({
            sourceId: source.id,
            name: source.name,
            versionId: source.current_version_id,
            currentVersionId: source.current_version_id,
            updatedAt: source.updated_at,
          })
      }

      if (data.length < 200) break

      after = data[data.length - 1].id
    }

    scopes.set(key, sources)

    return sources
  })().finally(() => {
    if (pending.get(key) === request) pending.delete(key)
  })

  pending.set(key, request)

  return request
}

export function freezeSourceScope(
  sources: ExperienceSourceRelation[],
  references: AiUserReference[],
): ExperienceSourceRelation[] {
  const selected = references.flatMap((reference) => {
    if (reference.type !== 'reference' || reference.kind !== 'experience')
      return []

    const source = sources.find((source) => source.sourceId === reference.id)

    return [
      {
        sourceId: reference.id,
        versionId: reference.versionId,
        currentVersionId: source?.currentVersionId ?? reference.versionId,
        name: reference.label,
        updatedAt: source?.updatedAt ?? '',
      },
    ]
  })

  return structuredClone([
    ...new Map(
      (selected.length ? selected : sources).map((source) => [
        source.sourceId,
        source,
      ]),
    ).values(),
  ])
}

useExperienceSourcesStore.subscribe((state, previous) => {
  if (
    state.generation !== previous.generation ||
    state.revision !== previous.revision
  ) {
    details.clear()
    scopes.clear()
    pending.clear()
  }
})
