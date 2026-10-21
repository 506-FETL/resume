import type { TemplateDefinition, TemplateRef, TemplateResolutionError } from '@/lib/resume-template/definition-schema'
import type { ExampleRef, ResumeExample, TemplateCatalogItem, TemplateSource } from '@/lib/resume-template/source/types'
import { create } from 'zustand'
import { toTemplateBinding } from '@/lib/resume-template/compatibility/binding'
import { asTemplateError } from '@/lib/resume-template/definition-schema'
import { resolveTemplate } from '@/lib/resume-template/runtime/resolve-template'
import { resumeTemplateSource } from '@/lib/resume-template/source'
import { exampleKey, templateKey } from '@/lib/resume-template/source/types'

export type ResourceState<T>
  = | { status: 'idle' }
    | { status: 'loading', requestId: number }
    | { status: 'ready', data: T }
    | { status: 'error', error: TemplateResolutionError }

export const IDLE_RESOURCE = { status: 'idle' } as const
interface TemplateResources {
  catalog: ResourceState<TemplateCatalogItem[]>
  definitions: Record<string, ResourceState<TemplateDefinition>>
  examples: Record<string, ResourceState<ResumeExample>>
  loadCatalog: (force?: boolean) => Promise<void>
  loadDefinition: (ref: TemplateRef, force?: boolean) => Promise<void>
  loadExample: (ref: ExampleRef, force?: boolean) => Promise<void>
}

export function createTemplateResourceStore(source: TemplateSource) {
  let sequence = 0
  const pending = new Map<string, { id: number, promise: Promise<void> }>()
  return create<TemplateResources>((set, get) => {
    function load<T>(key: string, current: ResourceState<T> | undefined, read: () => Promise<T>, write: (value: ResourceState<T>) => void, force = false): Promise<void> {
      if (!force && current?.status === 'ready')
        return Promise.resolve()
      const existing = pending.get(key)
      if (!force && existing)
        return existing.promise
      const id = ++sequence
      write({ status: 'loading', requestId: id })
      const promise = Promise.resolve().then(read).then(
        (data) => {
          if (pending.get(key)?.id === id)
            write({ status: 'ready', data })
        },
        (error: unknown) => {
          if (pending.get(key)?.id === id)
            write({ status: 'error', error: asTemplateError(error) })
        },
      ).finally(() => {
        if (pending.get(key)?.id === id)
          pending.delete(key)
      })
      pending.set(key, { id, promise })
      return promise
    }
    return {
      catalog: IDLE_RESOURCE,
      definitions: {},
      examples: {},
      loadCatalog: force => load('catalog', get().catalog, () => source.listTemplates(), catalog => set({ catalog }), force),
      loadDefinition: (ref, force) => {
        const key = templateKey(ref)
        return load(`definition:${key}`, get().definitions[key], () => resolveTemplate(source, toTemplateBinding(ref)), value => set(state => ({ definitions: { ...state.definitions, [key]: value } })), force)
      },
      loadExample: (ref, force) => {
        const key = exampleKey(ref)
        return load(`example:${key}`, get().examples[key], () => source.getExample(ref), value => set(state => ({ examples: { ...state.examples, [key]: value } })), force)
      },
    }
  })
}

export const useResumeTemplateStore = createTemplateResourceStore(resumeTemplateSource)
