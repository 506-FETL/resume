import { create } from 'zustand'
import * as api from '@/lib/experience-sources/api'
import type {
  ExperienceSource,
  ExperienceSourceReadResult,
  ExperienceSourceMetadata,
} from '@/lib/experience-sources/types'
import useUserStore from '@/store/user'
import { ExperienceSourceError } from '@/lib/experience-sources/types'

type SourcePage = Awaited<ReturnType<typeof api.listExperienceSources>>

export type SourceMetadataState =
  | { status: 'loading' }
  | { status: 'ready'; source: ExperienceSourceMetadata }
  | { status: 'missing' }
  | { status: 'error'; error: string }

interface ExperienceStore {
  ownerId: string | null
  generation: number
  revision: number
  pages: Record<string, SourcePage>
  reads: Record<string, ExperienceSourceReadResult>
  stalePages: Record<string, true>
  staleReads: Record<string, true>
  metadata: Record<string, SourceMetadataState>
  resolveMetadata: (sourceIds: string[], refresh?: boolean) => void
  load: (
    query?: string,
    offset?: number,
    refresh?: boolean,
    kind?: 'files' | 'paste',
  ) => Promise<SourcePage>
  read: (
    sourceId: string,
    versionId?: string,
    offset?: number,
    refresh?: boolean,
    blockIds?: string[],
  ) => Promise<ExperienceSourceReadResult>
  originals: Record<string, Blob>
  original: (sourceId: string, versionId: string) => Promise<Blob>
  invalidate: (sourceId?: string) => void
  rename: (sourceId: string, name: string) => Promise<ExperienceSource>
  remove: (sourceId: string) => Promise<void>
}

export function getCachedSourcePage(
  state: Pick<ExperienceStore, 'pages' | 'stalePages'>,
  query: string,
  offset: number,
  kind?: 'files' | 'paste',
): SourcePage | undefined {
  const key = JSON.stringify([query, offset, kind])

  if (state.pages[key] && !state.stalePages[key]) return state.pages[key]
  if (!kind) return

  const firstKey = JSON.stringify([query, 0, undefined])
  const first = state.pages[firstKey]

  if (!first || state.stalePages[firstKey]) return

  const all: ExperienceSource[] = []

  for (let start = 0; start < first.total; start += 10) {
    const pageKey = JSON.stringify([query, start, undefined])
    const page = state.pages[pageKey]

    if (
      !page ||
      state.stalePages[pageKey] ||
      page.total !== first.total ||
      page.items.length !== Math.min(10, first.total - start)
    )
      return

    all.push(...page.items)
  }

  if (new Set(all.map((source) => source.id)).size !== first.total) return

  const filtered = all.filter((source) =>
    kind === 'paste' ? source.kind === 'paste' : source.kind !== 'paste',
  )

  return {
    items: filtered.slice(offset, offset + 10),
    total: filtered.length,
    hasMore: offset + 10 < filtered.length,
  }
}

const pending = new Map<string, Promise<unknown>>()
const unknownDeletions = new Set<string>()
const metadataQueue = new Set<string>()
let metadataScheduled = false

export const useExperienceSourcesStore = create<ExperienceStore>(
  (set, get) => ({
    ownerId: useUserStore.getState().currentUser?.id ?? null,
    generation: 0,
    revision: 0,
    pages: {},
    originals: {},
    reads: {},
    stalePages: {},
    staleReads: {},
    metadata: {},
    resolveMetadata(sourceIds, refresh = false) {
      const state = get()

      const ids = [...new Set(sourceIds)].filter(
        (id) => refresh || !state.metadata[id],
      )

      if (!state.ownerId || !ids.length) return

      set((current) => ({
        metadata: {
          ...current.metadata,
          ...Object.fromEntries(
            ids.map((id) => [id, { status: 'loading' as const }]),
          ),
        },
      }))

      ids.forEach((id) => metadataQueue.add(id))

      if (metadataScheduled) return

      metadataScheduled = true

      queueMicrotask(() => {
        metadataScheduled = false

        const ids = [...metadataQueue]
        const { generation, revision } = get()

        metadataQueue.clear()

        for (let offset = 0; offset < ids.length; offset += 100) {
          const batch = ids.slice(offset, offset + 100)

          api.getExperienceSourceMetadata(batch).then(
            (result) => {
              if (
                get().generation !== generation ||
                get().revision !== revision
              )
                return

              set((current) => ({
                metadata: {
                  ...current.metadata,
                  ...Object.fromEntries(
                    batch.map((id) => {
                      const source = result.items.find((item) => item.id === id)

                      return [
                        id,
                        source
                          ? { status: 'ready' as const, source }
                          : result.missingIds.includes(id)
                            ? { status: 'missing' as const }
                            : {
                                status: 'error' as const,
                                error: '资料状态暂未确认',
                              },
                      ]
                    }),
                  ),
                },
              }))
            },
            (error: unknown) => {
              if (
                get().generation !== generation ||
                get().revision !== revision
              )
                return

              set((current) => ({
                metadata: {
                  ...current.metadata,
                  ...Object.fromEntries(
                    batch.map((id) => [
                      id,
                      {
                        status: 'error' as const,
                        error:
                          error instanceof Error
                            ? error.message
                            : '资料状态读取失败',
                      },
                    ]),
                  ),
                },
              }))
            },
          )
        }
      })
    },
    async load(query = '', offset = 0, refresh = false, kind) {
      const state = get()
      const key = JSON.stringify([query, offset, kind])
      const requestKey = `${state.generation}:${state.revision}:list:${key}`

      if (!state.ownerId) throw new Error('请先登录后使用职业档案。')

      const cached = !refresh
        ? getCachedSourcePage(state, query, offset, kind)
        : undefined

      if (cached) return cached
      if (pending.has(requestKey))
        return pending.get(requestKey) as Promise<SourcePage>

      const request = api
        .listExperienceSources({ query, offset, limit: 10, kind })
        .then((result) => {
          if (get().generation !== state.generation)
            throw new Error('账户已切换，请重新读取。')
          if (get().revision !== state.revision)
            throw new Error('资料已更新，请重新读取。')

          set((current) => {
            const stalePages = { ...current.stalePages }

            delete stalePages[key]

            return { pages: { ...current.pages, [key]: result }, stalePages }
          })

          return result
        })
        .finally(() => pending.delete(requestKey))

      pending.set(requestKey, request)

      return request
    },
    async read(sourceId, versionId, offset = 0, refresh = false, blockIds) {
      const state = get()

      const key = JSON.stringify(
        blockIds
          ? [sourceId, versionId, blockIds]
          : [sourceId, versionId, offset],
      )

      const requestKey = `${state.generation}:${state.revision}:read:${key}`

      if (!state.ownerId) throw new Error('请先登录后使用职业档案。')
      if (!refresh && state.reads[key] && !state.staleReads[key])
        return state.reads[key]
      if (pending.has(requestKey))
        return pending.get(requestKey) as Promise<ExperienceSourceReadResult>

      const request = api
        .readExperienceSource({ sourceId, versionId, offset, blockIds })
        .then((result) => {
          if (get().generation !== state.generation)
            throw new Error('账户已切换，请重新读取。')
          if (get().revision !== state.revision)
            throw new Error('资料已更新，请重新读取。')

          set((current) => {
            const staleReads = { ...current.staleReads }

            delete staleReads[key]

            return { reads: { ...current.reads, [key]: result }, staleReads }
          })

          return result
        })
        .finally(() => pending.delete(requestKey))

      pending.set(requestKey, request)

      return request
    },
    async original(sourceId, versionId) {
      const state = get()
      const key = JSON.stringify([sourceId, versionId])
      const requestKey = `${state.generation}:${state.revision}:original:${key}`

      if (!state.ownerId) throw new Error('请先登录后使用职业档案。')
      if (state.originals[key]) return state.originals[key]
      if (pending.has(requestKey))
        return pending.get(requestKey) as Promise<Blob>

      const request = api
        .downloadExperienceSource({ sourceId, versionId })
        .then((blob) => {
          if (
            get().generation !== state.generation ||
            get().revision !== state.revision
          )
            throw new Error('档案已更新，请重新读取。')

          set((current) => ({
            originals: { ...current.originals, [key]: blob },
          }))

          return blob
        })
        .finally(() => pending.delete(requestKey))

      pending.set(requestKey, request)

      return request
    },
    invalidate(sourceId) {
      set((state) => ({
        metadata: {},
        originals: Object.fromEntries(
          Object.entries(state.originals).filter(
            ([key]) => sourceId && JSON.parse(key)[0] !== sourceId,
          ),
        ),
        stalePages: Object.fromEntries(
          Object.keys(state.pages).map((key) => [key, true as const]),
        ),
        staleReads: {
          ...state.staleReads,
          ...Object.fromEntries(
            Object.entries(state.reads)
              .filter(([, value]) => !sourceId || value.source.id === sourceId)
              .map(([key]) => [key, true as const]),
          ),
        },
        revision: state.revision + 1,
      }))
    },
    async rename(sourceId, name) {
      const generation = get().generation
      const source = await api.renameExperienceSource(sourceId, name)

      if (get().generation === generation) {
        set((state) => ({
          pages: Object.fromEntries(
            Object.entries(state.pages).map(([key, page]) => [
              key,
              {
                ...page,
                items: page.items.map((item) =>
                  item.id === sourceId ? source : item,
                ),
              },
            ]),
          ),
          reads: Object.fromEntries(
            Object.entries(state.reads).map(([key, read]) => [
              key,
              read.source.id === sourceId ? { ...read, source } : read,
            ]),
          ),
        }))

        get().invalidate(sourceId)
      }

      return source
    },
    async remove(sourceId) {
      const generation = get().generation

      const deletionKey = `${generation}:${sourceId}`

      try {
        const prior = unknownDeletions.has(deletionKey)
          ? await api.getExperienceSourceMetadata([sourceId])
          : null

        if (!prior?.missingIds.includes(sourceId))
          await api.deleteExperienceSource(sourceId)
      } catch (error) {
        if (
          !(error instanceof ExperienceSourceError) ||
          error.outcome !== 'unknown'
        )
          throw error

        unknownDeletions.add(deletionKey)

        const status = await api
          .getExperienceSourceMetadata([sourceId])
          .catch(() => null)

        if (get().generation !== generation) throw error
        if (!status?.missingIds.includes(sourceId)) {
          get().invalidate(sourceId)

          if (status) {
            const source = status.items.find((item) => item.id === sourceId)

            if (source)
              set((state) => ({
                metadata: {
                  ...state.metadata,
                  [sourceId]: { status: 'ready', source },
                },
                reads: Object.fromEntries(
                  Object.entries(state.reads).filter(
                    ([, read]) => read.source.id !== sourceId,
                  ),
                ),
                pages: Object.fromEntries(
                  Object.entries(state.pages).map(([key, page]) => [
                    key,
                    {
                      ...page,
                      items: page.items.map((item) =>
                        item.id === sourceId ? { ...item, ...source } : item,
                      ),
                    },
                  ]),
                ),
              }))
          }

          throw error
        }
      }

      unknownDeletions.delete(deletionKey)

      if (get().generation === generation) {
        set((state) => ({
          pages: Object.fromEntries(
            Object.entries(state.pages).map(([key, page]) => [
              key,
              {
                ...page,
                items: page.items.filter((item) => item.id !== sourceId),
              },
            ]),
          ),
          reads: Object.fromEntries(
            Object.entries(state.reads).filter(
              ([, read]) => read.source.id !== sourceId,
            ),
          ),
        }))

        get().invalidate(sourceId)

        set((state) => ({
          metadata: { ...state.metadata, [sourceId]: { status: 'missing' } },
        }))
      }
    },
  }),
)

useUserStore.subscribe((state) => {
  const ownerId = state.currentUser?.id ?? null

  if (ownerId === useExperienceSourcesStore.getState().ownerId) return

  pending.clear()
  metadataQueue.clear()
  unknownDeletions.clear()

  useExperienceSourcesStore.setState((current) => ({
    ownerId,
    generation: current.generation + 1,
    revision: current.revision + 1,
    pages: {},
    originals: {},
    reads: {},
    stalePages: {},
    staleReads: {},
    metadata: {},
  }))
})
