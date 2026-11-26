import * as api from '@/lib/experience-sources/api'
import { listArchivePage } from '@/lib/experience-sources/list-page'
import type { ExperienceSourceReadResult } from '@/lib/experience-sources/types'

import type { ExperienceSlice, SourcePage } from './types'
import { pending, sourceReadKey, sourceRequestKey } from './runtime'
import { getCachedSourcePage } from './page-cache'
import { takeExperiencePreload } from './preload'

export const createReadsSlice: ExperienceSlice<'load' | 'read' | 'original'> = (
  set,
  get,
) => ({
  async load(query = '', offset = 0, refresh = false, kind) {
    const state = get()
    const key = JSON.stringify([query, offset, kind])
    const requestKey = sourceRequestKey(state, 'list', key)

    if (!state.ownerId) throw new Error('请先登录后使用职业档案。')

    const cached = !refresh
      ? getCachedSourcePage(state, query, offset, kind)
      : undefined

    const opening = takeExperiencePreload<SourcePage>(requestKey)

    if (cached) return cached
    if (!refresh && opening) return opening
    if (pending.has(requestKey))
      return pending.get(requestKey) as Promise<SourcePage>

    // 搜索词可能包含私有资料名称，继续放在 POST 正文中。
    const page = query
      ? api.listExperienceSources({ query, offset, limit: 10, kind })
      : listArchivePage(state.ownerId, offset, kind)

    const request = page
      .then((result) => {
        if (get().generation !== state.generation)
          throw new Error('账户已切换，请重新读取。')
        if (get().revision !== state.revision)
          throw new Error('资料已更新，请重新读取。')

        set((current) => {
          const stalePages = { ...current.stalePages }
          const firstKey = JSON.stringify([query, 0, kind])
          const first = current.pages[firstKey]

          if (first && !stalePages[firstKey] && first.total !== result.total) {
            // 外部增删改变了分页边界，回到已有页时需要重新确认其内容。
            for (const cachedKey of Object.keys(current.pages))
              stalePages[cachedKey] = true
          }

          delete stalePages[key]

          return { pages: { ...current.pages, [key]: result }, stalePages }
        })

        return result
      })
      .finally(() => pending.delete(requestKey))

    pending.set(requestKey, request)

    return request
  },
  async read(
    sourceId,
    versionId,
    offset = 0,
    refresh = false,
    blockIds,
    limit = 20,
  ) {
    const state = get()

    const key = sourceReadKey(sourceId, versionId, offset, blockIds, limit)
    const requestKey = sourceRequestKey(state, 'read', key)

    const opening =
      takeExperiencePreload<ExperienceSourceReadResult>(requestKey)

    if (!state.ownerId) throw new Error('请先登录后使用职业档案。')
    if (!refresh && state.reads[key] && !state.staleReads[key])
      return state.reads[key]
    if (!refresh && opening) return opening
    if (pending.has(requestKey))
      return pending.get(requestKey) as Promise<ExperienceSourceReadResult>

    const request = api
      .readExperienceSource({ sourceId, versionId, offset, blockIds, limit })
      .then((result) => {
        if (get().generation !== state.generation)
          throw new Error('账户已切换，请重新读取。')
        if (get().revision !== state.revision)
          throw new Error('资料已更新，请重新读取。')

        set((current) => {
          const staleReads = { ...current.staleReads }

          const versionKey = versionId
            ? key
            : sourceReadKey(
                sourceId,
                result.version.id,
                offset,
                blockIds,
                limit,
              )

          delete staleReads[key]
          delete staleReads[versionKey]

          return {
            reads: { ...current.reads, [key]: result, [versionKey]: result },
            staleReads,
          }
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
