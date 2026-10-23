import type { StoreApi } from 'zustand'
import type { TemplateResources } from './index'
import type { CatalogPage, CatalogQuery, TemplateSource } from '@/lib/resume-template/source/types'
import { asTemplateError } from '@/lib/resume-template/definition-schema'
import { MAX_CACHE_BYTES, resourceBytes } from '@/lib/resume-template/source/cache'
import { CATALOG_TTL_MS } from '@/lib/resume-template/source/remote'
import { CATALOG_PAGE_SIZE, catalogQueryKey } from '@/lib/resume-template/source/types'

type CatalogState = Pick<TemplateResources, 'catalog' | 'catalogQuery' | 'nextOffset' | 'refreshingCatalog' | 'catalogRefreshError' | 'loadingMore' | 'loadMoreError' | 'facets' | 'loadCatalog' | 'loadMore' | 'loadFacets'>
export function createCatalogActions(source: TemplateSource, set: StoreApi<TemplateResources>['setState'], get: StoreApi<TemplateResources>['getState']): CatalogState {
  // 缓存每个筛选已加载的页；返回筛选时保留图片、数量和分页位置。
  const snapshots = new Map<string, CatalogPage & { savedAt: number }>()
  function remember(key: string, page: CatalogPage, savedAt = Date.now()) {
    snapshots.delete(key)
    snapshots.set(key, { ...page, savedAt })
    let bytes = [...snapshots.values()].reduce((total, value) => total + resourceBytes(value), 0)
    for (const [candidate, value] of snapshots) {
      if (snapshots.size <= 16 && bytes <= MAX_CACHE_BYTES)
        break
      bytes -= resourceBytes(value)
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
    if (!all || all.nextOffset !== null)
      return undefined
    const matches = all.items.filter(item => (!query.style || item.category.style === query.style) && (!query.layout || item.category.layout === query.layout))
    const offset = query.offset ?? 0
    const end = offset + CATALOG_PAGE_SIZE
    return { items: matches.slice(offset, end), nextOffset: end < matches.length ? end : null, savedAt: all.savedAt }
  }
  let revision = 0
  let facetRevision = 0
  let facetsSavedAt = 0
  let catalogPending: { key: string, promise: Promise<void> } | undefined
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
      const normalized = { style: query.style || null, layout: query.layout || null, offset: 0 }
      const key = catalogQueryKey(normalized)
      if (!force && catalogPending?.key === key && catalogQueryKey(get().catalogQuery) === key)
        return catalogPending.promise
      const id = ++revision
      catalogPending = undefined
      if (force)
        snapshots.clear()
      const hit = !force && (cached(key) ?? localPage(normalized))
      if (hit) {
        remember(key, hit, hit.savedAt)
        set({ catalogQuery: normalized, catalog: { status: 'ready', data: hit.items }, nextOffset: hit.nextOffset, refreshingCatalog: false, catalogRefreshError: null, loadingMore: false, loadMoreError: null })
        return Promise.resolve()
      }
      const previous = get().catalog
      set({ catalogQuery: normalized, refreshingCatalog: true, catalogRefreshError: null, loadingMore: false, loadMoreError: null, catalog: previous.status === 'ready' ? previous : { status: 'loading', requestId: id }, nextOffset: null })
      const promise = source.listTemplatePage(normalized, { force }).then((page) => {
        if (id === revision) {
          remember(key, page)
          set({ catalog: { status: 'ready', data: page.items }, nextOffset: page.nextOffset, refreshingCatalog: false })
        }
      }, (error: unknown) => {
        if (id === revision) {
          const failure = asTemplateError(error)
          set({ catalog: previous.status === 'ready' ? previous : { status: 'error', error: failure }, catalogRefreshError: previous.status === 'ready' ? failure.message : null, nextOffset: null, refreshingCatalog: false })
        }
      }).finally(() => {
        if (id === revision)
          catalogPending = undefined
      })
      catalogPending = { key, promise }
      return promise
    },
    async loadMore() {
      const state = get()
      if (state.refreshingCatalog || state.catalogRefreshError || state.loadingMore || state.nextOffset === null || state.catalog.status !== 'ready')
        return
      const id = revision
      set({ loadingMore: true, loadMoreError: null })
      try {
        const query = { ...state.catalogQuery, offset: state.nextOffset }
        const page = localPage(query) ?? await source.listTemplatePage(query)
        if (id === revision) {
          const items = new Map(state.catalog.data.map(item => [item.templateId, item]))
          page.items.forEach(item => items.set(item.templateId, item))
          const data = [...items.values()]
          const key = catalogQueryKey(state.catalogQuery)
          remember(key, { items: data, nextOffset: page.nextOffset }, snapshots.get(key)?.savedAt)
          set({ catalog: { status: 'ready', data }, nextOffset: page.nextOffset })
        }
      }
      catch (error) {
        if (id === revision)
          set({ loadMoreError: asTemplateError(error).message })
      }
      finally {
        if (id === revision)
          set({ loadingMore: false })
      }
    },
    loadFacets(force = false) {
      if (!force && get().facets.status === 'ready' && Date.now() - facetsSavedAt < CATALOG_TTL_MS)
        return Promise.resolve()
      if (facetsPending && !force)
        return facetsPending
      const id = ++facetRevision
      if (get().facets.status !== 'ready')
        set({ facets: { status: 'loading', requestId: id } })
      const promise = source.getCatalogFacets({ force }).then((data) => {
        if (id === facetRevision) {
          facetsSavedAt = Date.now()
          set({ facets: { status: 'ready', data } })
        }
      }, (error: unknown) => {
        if (id === facetRevision)
          set({ facets: { status: 'error', error: asTemplateError(error) } })
      }).finally(() => {
        if (id === facetRevision)
          facetsPending = undefined
      })
      facetsPending = promise
      return promise
    },
  }
}
