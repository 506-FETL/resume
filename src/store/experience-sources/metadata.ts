import { readExperienceSourceMetadata } from '@/lib/experience-sources/read-metadata'

import type { ExperienceSlice } from './types'
import { metadataQueue } from './runtime'

let metadataScheduled = false

export const createMetadataSlice: ExperienceSlice<'resolveMetadata'> = (
  set,
  get,
) => ({
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

        readExperienceSourceMetadata(batch).then(
          (result) => {
            if (get().generation !== generation || get().revision !== revision)
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
            if (get().generation !== generation || get().revision !== revision)
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
})
