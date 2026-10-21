import type { TemplateDefinition, TemplateRef } from '@/lib/resume-template/definition-schema'
import type { ResourceState } from '@/store/resume-template'
import { useEffect, useMemo } from 'react'
import { resolveTemplateReference } from '@/lib/resume-template/compatibility/binding'
import { parseSharedTemplateDefinition } from '@/lib/resume-template/compatibility/share-manifest'
import { asTemplateError, parseTemplateDefinition } from '@/lib/resume-template/definition-schema'
import { templateKey } from '@/lib/resume-template/source/types'
import { IDLE_RESOURCE, useResumeTemplateStore } from '@/store/resume-template'

export function useResolvedResumeTemplate({ binding, definition, manifest, enabled = true }: {
  binding?: unknown
  definition?: TemplateDefinition | null
  manifest?: unknown
  enabled?: boolean
}) {
  const bindingKey = JSON.stringify(binding)
  const request = useMemo<{ ref?: TemplateRef, immediate?: ResourceState<TemplateDefinition> }>(() => {
    try {
      if (definition != null)
        return { immediate: { status: 'ready', data: parseTemplateDefinition(definition) } }
      if (manifest !== undefined && manifest !== null)
        return { immediate: { status: 'ready', data: parseSharedTemplateDefinition(manifest) } }
      return { ref: resolveTemplateReference(bindingKey ? JSON.parse(bindingKey) : undefined) }
    }
    catch (error) {
      return { immediate: { status: 'error', error: asTemplateError(error) } }
    }
  }, [bindingKey, definition, manifest])
  const key = request.ref ? templateKey(request.ref) : ''
  const cached = useResumeTemplateStore(state => state.definitions[key] ?? IDLE_RESOURCE)
  const loadDefinition = useResumeTemplateStore(state => state.loadDefinition)
  useEffect(() => {
    if (enabled && request.ref)
      void loadDefinition(request.ref)
  }, [enabled, request, loadDefinition])
  return {
    resource: enabled ? request.immediate ?? cached : IDLE_RESOURCE,
    retry: request.ref ? () => loadDefinition(request.ref!, true) : undefined,
  }
}
