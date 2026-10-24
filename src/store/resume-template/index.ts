import type {
  TemplateDefinition,
  TemplateRef,
  TemplateResolutionError,
} from '@/lib/resume-template/definition-schema'
import type {
  CatalogFacets,
  CatalogQuery,
  ExampleRef,
  ResumeExample,
  TemplateCatalogItem,
  TemplateSource,
} from '@/lib/resume-template/source/types'
import { create } from 'zustand'
import { toTemplateBinding } from '@/lib/resume-template/binding'
import {
  asTemplateError,
  TemplateResolutionError as ResourceError,
} from '@/lib/resume-template/definition-schema'
import { resolveTemplate } from '@/lib/resume-template/runtime/resolve-template'
import { resumeTemplateSource } from '@/lib/resume-template/source'
import {
  MAX_CACHE_BYTES,
  resourceBytes,
} from '@/lib/resume-template/source/cache'
import { exampleKey, templateKey } from '@/lib/resume-template/source/types'
import { createCatalogActions } from './catalog'

export type ResourceState<T> =
  | { status: 'idle' }
  | { status: 'loading'; requestId: number }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: TemplateResolutionError }

export const IDLE_RESOURCE = { status: 'idle' } as const

export interface TemplateResources {
  catalog: ResourceState<TemplateCatalogItem[]>
  catalogQuery: CatalogQuery
  nextOffset: number | null
  refreshingCatalog: boolean
  catalogRefreshError: string | null
  loadingMore: boolean
  loadMoreError: string | null
  facets: ResourceState<CatalogFacets>
  definitions: Record<string, ResourceState<TemplateDefinition>>
  examples: Record<string, ResourceState<ResumeExample>>
  loadCatalog: (query?: CatalogQuery, force?: boolean) => Promise<void>
  loadMore: () => Promise<void>
  loadFacets: (force?: boolean) => Promise<void>
  retainDefinition: (ref: TemplateRef) => () => void
  retainExample: (ref: ExampleRef) => () => void
  loadDefinition: (ref: TemplateRef, force?: boolean) => Promise<void>
  loadExample: (ref: ExampleRef, force?: boolean) => Promise<void>
}

export function createTemplateResourceStore(source: TemplateSource) {
  let sequence = 0
  const retained = new Map<string, number>()
  const sourceReleases = new Map<string, () => void>()
  const pending = new Map<string, { id: number; promise: Promise<void> }>()

  return create<TemplateResources>((set, get) => {
    function retain(key: string, sourceKey: string) {
      if (!retained.has(key) && retained.size >= 64)
        throw new ResourceError(
          'LOAD_FAILED',
          '同时使用的模板资源过多，请关闭部分预览后重试',
        )
      if (!sourceReleases.has(key))
        sourceReleases.set(key, source.retainResource(sourceKey))

      retained.set(key, (retained.get(key) ?? 0) + 1)

      let released = false

      return () => {
        if (released) return

        released = true

        const count = (retained.get(key) ?? 1) - 1

        if (count > 0) {
          retained.set(key, count)
        } else {
          retained.delete(key)
          sourceReleases.get(key)?.()
          sourceReleases.delete(key)
        }
      }
    }

    function update<T>(
      resources: Record<string, ResourceState<T>>,
      key: string,
      value: ResourceState<T>,
      kind: string,
    ) {
      const next = { ...resources }

      delete next[key]
      next[key] = value

      let bytes = resourceBytes(next)

      for (const candidate of Object.keys(next)) {
        if (Object.keys(next).length <= 96 && bytes <= MAX_CACHE_BYTES) break
        if (retained.has(`${kind}:${candidate}`)) continue

        bytes -= resourceBytes(next[candidate])
        delete next[candidate]
      }

      // 活动资源上限 64；加载与非活动资源在预算内按最近写入顺序回收。
      return next
    }

    function load<T>(
      key: string,
      current: ResourceState<T> | undefined,
      read: () => Promise<T>,
      write: (value: ResourceState<T>) => void,
      force = false,
    ): Promise<void> {
      if (!force && current?.status === 'ready') return Promise.resolve()

      const existing = pending.get(key)

      if (!force && existing) return existing.promise

      const id = ++sequence

      write({ status: 'loading', requestId: id })

      const promise = Promise.resolve()
        .then(read)
        .then(
          (data) => {
            if (pending.get(key)?.id === id) write({ status: 'ready', data })
          },
          (error: unknown) => {
            if (pending.get(key)?.id === id)
              write({ status: 'error', error: asTemplateError(error) })
          },
        )
        .finally(() => {
          if (pending.get(key)?.id === id) pending.delete(key)
        })

      pending.set(key, { id, promise })

      return promise
    }

    return {
      ...createCatalogActions(source, set, get),
      definitions: {},
      examples: {},
      retainDefinition: (ref) =>
        retain(
          `definition:${templateKey(ref)}`,
          `template:${templateKey(ref)}`,
        ),
      retainExample: (ref) =>
        retain(`example:${exampleKey(ref)}`, `example:${exampleKey(ref)}`),
      loadDefinition: (ref, force) => {
        const key = templateKey(ref)

        return load(
          `definition:${key}`,
          get().definitions[key],
          () => resolveTemplate(source, toTemplateBinding(ref), { force }),
          (value) =>
            set((state) => ({
              definitions: update(state.definitions, key, value, 'definition'),
            })),
          force,
        )
      },
      loadExample: (ref, force) => {
        const key = exampleKey(ref)

        return load(
          `example:${key}`,
          get().examples[key],
          () => source.getExample(ref, { force }),
          (value) =>
            set((state) => ({
              examples: update(state.examples, key, value, 'example'),
            })),
          force,
        )
      },
    }
  })
}

export const useResumeTemplateStore =
  createTemplateResourceStore(resumeTemplateSource)
