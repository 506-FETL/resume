import type {
  CatalogPage,
  CatalogQuery,
  CatalogFacets,
  ResourceOptions,
  TemplateCatalogItem,
} from '@/lib/resume-template/source/types'
import type { ResourceState } from './index'
import { cachedResourceBytes } from './resource-bytes'
import { asTemplateError } from '@/lib/resume-template/errors'
import {
  MAX_CACHE_BYTES,
  resourceBytes,
} from '@/lib/resume-template/source/cache'
import {
  CATALOG_PAGE_SIZE,
  CATALOG_TTL_MS,
  catalogQueryKey,
} from '@/lib/resume-template/source/types'

type CatalogIdentity = Pick<TemplateCatalogItem, 'templateId' | 'category'>

export interface CatalogState<T extends CatalogIdentity> {
  catalog: ResourceState<T[]>
  catalogQuery: CatalogQuery
  nextOffset: number | null
  refreshingCatalog: boolean
  catalogRefreshError: string | null
  loadingMore: boolean
  loadMoreError: string | null
  facets: ResourceState<CatalogFacets>
  loadCatalog: (query?: CatalogQuery, force?: boolean) => Promise<void>
  loadMore: () => Promise<void>
  loadFacets: (force?: boolean) => Promise<void>
}

interface CatalogSource<T extends CatalogIdentity> {
  listTemplatePage: (
    query?: CatalogQuery,
    options?: ResourceOptions,
  ) => Promise<CatalogPage<T>>
  getCatalogFacets: (options?: ResourceOptions) => Promise<CatalogFacets>
}

export function createCatalogActions<T extends CatalogIdentity>(
  source: CatalogSource<T>,
  set: (state: Partial<CatalogState<T>>) => void,
  get: () => CatalogState<T>,
): CatalogState<T> {
  // 缓存每个筛选已加载的页；返回筛选时保留图片、数量和分页位置。
  const snapshots = new Map<
    string,
    CatalogPage<T> & { savedAt: number; byteLength: number }
  >()

  function remember(key: string, page: CatalogPage<T>, savedAt = Date.now()) {
    const { items, nextOffset } = page
    // 空数组已含括号；目录追加或本地筛选时只需计算新增条目的 UTF-8 大小。
    let byteLength = resourceBytes({ items: [], nextOffset, savedAt })

    byteLength += Math.max(0, items.length - 1)

    for (const item of items) byteLength += cachedResourceBytes(item)

    snapshots.delete(key)
    snapshots.set(key, { items, nextOffset, savedAt, byteLength })

    let bytes = 0

    for (const entry of snapshots.values()) bytes += entry.byteLength

    for (const [candidate, value] of snapshots) {
      if (snapshots.size <= 16 && bytes <= MAX_CACHE_BYTES) break

      bytes -= value.byteLength
      snapshots.delete(candidate)
    }
  }

  function cached(key: string) {
    const page = snapshots.get(key)

    if (!page || Date.now() - page.savedAt >= CATALOG_TTL_MS) {
      snapshots.delete(key)

      return undefined
    }

    snapshots.delete(key)
    snapshots.set(key, page)

    return page
  }

  function localPage(query: CatalogQuery) {
    // 只有已拿到完整目录才能在本地筛选，不能将第一页误当成全部结果。
    const all = cached(catalogQueryKey())

    if (!all || all.nextOffset !== null) return undefined

    const matches = all.items.filter(
      (item) =>
        (!query.style || item.category.style === query.style) &&
        (!query.layout || item.category.layout === query.layout),
    )

    const offset = query.offset ?? 0
    const end = offset + CATALOG_PAGE_SIZE

    return {
      items: matches.slice(offset, end),
      nextOffset: end < matches.length ? end : null,
      savedAt: all.savedAt,
    }
  }

  let revision = 0
  let facetRevision = 0
  let facetsSavedAt = 0
  let catalogPending: { key: string; promise: Promise<void> } | undefined
  let facetsPending: Promise<void> | undefined

  return {
    catalog: { status: 'idle' },
    catalogQuery: {},
    nextOffset: null,
    refreshingCatalog: false,
    catalogRefreshError: null,
    loadingMore: false,
    loadMoreError: null,
    facets: { status: 'idle' },
    loadCatalog(query = {}, force = false) {
      const normalized = {
        style: query.style || null,
        layout: query.layout || null,
        offset: 0,
      }

      const key = catalogQueryKey(normalized)

      if (
        !force &&
        catalogPending?.key === key &&
        catalogQueryKey(get().catalogQuery) === key
      )
        return catalogPending.promise

      if (force) snapshots.delete(key)

      const current = get()
      const sameQuery = catalogQueryKey(current.catalogQuery) === key

      const snapshot = !force && cached(key)
      const hit = snapshot || (!force && localPage(normalized))

      if (
        snapshot &&
        sameQuery &&
        current.catalog.status === 'ready' &&
        current.catalog.data === snapshot.items &&
        !current.catalogRefreshError
      )
        return Promise.resolve()

      const id = ++revision

      catalogPending = undefined

      if (hit) {
        if (!snapshot) remember(key, hit, hit.savedAt)

        set({
          catalogQuery: normalized,
          catalog: { status: 'ready', data: hit.items },
          nextOffset: hit.nextOffset,
          refreshingCatalog: false,
          catalogRefreshError: null,
          loadingMore: false,
          loadMoreError: null,
        })

        return Promise.resolve()
      }

      const previous = current.catalog

      set({
        catalogQuery: normalized,
        refreshingCatalog: true,
        catalogRefreshError: null,
        loadingMore: false,
        loadMoreError: null,
        catalog:
          previous.status === 'ready'
            ? previous
            : { status: 'loading', requestId: id },
        nextOffset: null,
      })

      const promise = source
        .listTemplatePage(normalized, { force })
        .then(
          (page) => {
            if (id === revision) {
              remember(key, page)

              set({
                catalog: { status: 'ready', data: page.items },
                nextOffset: page.nextOffset,
                refreshingCatalog: false,
              })
            }
          },
          (error: unknown) => {
            if (id === revision) {
              const failure = asTemplateError(error)

              set({
                catalog:
                  previous.status === 'ready'
                    ? previous
                    : { status: 'error', error: failure },
                catalogRefreshError:
                  previous.status === 'ready' ? failure.message : null,
                nextOffset: null,
                refreshingCatalog: false,
              })
            }
          },
        )
        .finally(() => {
          if (id === revision) catalogPending = undefined
        })

      catalogPending = { key, promise }

      return promise
    },
    async loadMore() {
      const state = get()

      if (
        state.refreshingCatalog ||
        state.catalogRefreshError ||
        state.loadingMore ||
        state.nextOffset === null ||
        state.catalog.status !== 'ready'
      )
        return

      const id = revision
      const key = catalogQueryKey(state.catalogQuery)
      const startingPage = snapshots.get(key)

      set({ loadingMore: true, loadMoreError: null })

      try {
        const query = { ...state.catalogQuery, offset: state.nextOffset }
        const page = localPage(query) ?? (await source.listTemplatePage(query))

        // 切走时仍保留成功追加的页；主动刷新或淘汰了这份旧列表后才丢弃结果。
        if (
          id !== revision &&
          (!startingPage || snapshots.get(key) !== startingPage)
        )
          return

        const items = new Map(
          state.catalog.data.map((item) => [item.templateId, item]),
        )

        page.items.forEach((item) => items.set(item.templateId, item))

        const data = [...items.values()]

        remember(
          key,
          { items: data, nextOffset: page.nextOffset },
          startingPage?.savedAt,
        )

        if (catalogQueryKey(get().catalogQuery) === key)
          set({
            catalog: { status: 'ready', data },
            nextOffset: page.nextOffset,
          })
      } catch (error) {
        if (id === revision)
          set({ loadMoreError: asTemplateError(error).message })
      } finally {
        if (id === revision) set({ loadingMore: false })
      }
    },
    loadFacets(force = false) {
      if (
        !force &&
        get().facets.status === 'ready' &&
        Date.now() - facetsSavedAt < CATALOG_TTL_MS
      )
        return Promise.resolve()
      if (facetsPending && !force) return facetsPending

      const id = ++facetRevision

      if (get().facets.status !== 'ready')
        set({ facets: { status: 'loading', requestId: id } })

      const promise = source
        .getCatalogFacets({ force })
        .then(
          (data) => {
            if (id === facetRevision) {
              facetsSavedAt = Date.now()
              set({ facets: { status: 'ready', data } })
            }
          },
          (error: unknown) => {
            if (id === facetRevision)
              set({
                facets: { status: 'error', error: asTemplateError(error) },
              })
          },
        )
        .finally(() => {
          if (id === facetRevision) facetsPending = undefined
        })

      facetsPending = promise

      return promise
    },
  }
}
