import * as api from '@/lib/experience-sources/api'

import { ExperienceSourceError } from '@/lib/experience-sources/types'

import type { ExperienceSlice } from './types'
import { unknownDeletions } from './runtime'

export const createMutationsSlice: ExperienceSlice<
  'invalidate' | 'rename' | 'remove'
> = (set, get) => ({
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
  async remove(sourceId, signal) {
    const generation = get().generation

    const deletionKey = `${generation}:${sourceId}`

    try {
      const prior = unknownDeletions.has(deletionKey)
        ? await api.getExperienceSourceMetadata([sourceId], signal)
        : null

      if (!prior?.missingIds.includes(sourceId))
        await api.deleteExperienceSource(sourceId, signal)
    } catch (error) {
      if (
        !(error instanceof ExperienceSourceError) ||
        error.outcome !== 'unknown'
      )
        throw error

      unknownDeletions.add(deletionKey)

      const status = await api
        .getExperienceSourceMetadata([sourceId], signal)
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
})
