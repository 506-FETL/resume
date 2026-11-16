import * as api from '@/lib/experience-sources/api'
import type { ExperienceSourceReadResult } from '@/lib/experience-sources/types'

import type { ExperienceSlice, SourcePage } from './types'
import { pending } from './runtime'
import { getCachedSourcePage } from './page-cache'

export const createReadsSlice: ExperienceSlice<'load' | 'read' | 'original'> = (
  set,
  get,
) => ({
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
    if (pending.has(requestKey)) return pending.get(requestKey) as Promise<Blob>

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
})
