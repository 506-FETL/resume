import type { StoreApi } from 'zustand'
import type { TemplateResources } from './index'
import type { TemplateSource } from '@/lib/resume-template/source/types'
import { asTemplateError } from '@/lib/resume-template/definition-schema'
import { catalogQueryKey } from '@/lib/resume-template/source/types'

type CatalogState = Pick<TemplateResources, 'catalog' | 'catalogQuery' | 'nextOffset' | 'loadingMore' | 'loadMoreError' | 'facets' | 'loadCatalog' | 'loadMore' | 'loadFacets'>
export function createCatalogActions(source: TemplateSource, set: StoreApi<TemplateResources>['setState'], get: StoreApi<TemplateResources>['getState']): CatalogState {
  let revision = 0
  let facetRevision = 0
  let catalogPending: { key: string, promise: Promise<void> } | undefined
  let facetsPending: Promise<void> | undefined
  return {
    catalog: { status: 'idle' },
    catalogQuery: {},
    nextOffset: null,
    loadingMore: false,
    loadMoreError: null,
    facets: { status: 'idle' },
    loadCatalog(query = {}, force = false) {
      const normalized = { style: query.style || null, layout: query.layout || null, offset: 0 }
      const key = catalogQueryKey(normalized)
      if (!force && catalogPending?.key === key)
        return catalogPending.promise
      const id = ++revision
      const sameQuery = catalogQueryKey(get().catalogQuery) === key
      set({ catalogQuery: normalized, loadingMore: false, loadMoreError: null, ...(!sameQuery || get().catalog.status !== 'ready' ? { catalog: { status: 'loading', requestId: id } as const, nextOffset: null } : {}) })
      const promise = source.listTemplatePage(normalized, { force }).then((page) => {
        if (id === revision)
          set({ catalog: { status: 'ready', data: page.items }, nextOffset: page.nextOffset })
      }, (error: unknown) => {
        if (id === revision)
          set({ catalog: { status: 'error', error: asTemplateError(error) }, nextOffset: null })
      }).finally(() => {
        if (id === revision)
          catalogPending = undefined
      })
      catalogPending = { key, promise }
      return promise
    },
    async loadMore() {
      const state = get()
      if (state.loadingMore || state.nextOffset === null || state.catalog.status !== 'ready')
        return
      const id = revision
      set({ loadingMore: true, loadMoreError: null })
      try {
        const page = await source.listTemplatePage({ ...state.catalogQuery, offset: state.nextOffset })
        if (id === revision) {
          const items = new Map(state.catalog.data.map(item => [item.templateId, item]))
          page.items.forEach(item => items.set(item.templateId, item))
          set({ catalog: { status: 'ready', data: [...items.values()] }, nextOffset: page.nextOffset })
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
      if (facetsPending && !force)
        return facetsPending
      const id = ++facetRevision
      if (get().facets.status !== 'ready')
        set({ facets: { status: 'loading', requestId: id } })
      const promise = source.getCatalogFacets({ force }).then((data) => {
        if (id === facetRevision)
          set({ facets: { status: 'ready', data } })
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
