import type {
  TemplateDefinition,
  TemplateRef,
} from '@/lib/resume-template/definition-schema'
import type { ResourceState } from '@/store/resume-template'
import { useCallback, useEffect, useMemo } from 'react'
import { useTemplateAssets } from '@/components/resume/runtime/use-template-assets'
import { resolveTemplateReference } from '@/lib/resume-template/binding'
import {
  asTemplateError,
  parseTemplateDefinition,
} from '@/lib/resume-template/definition-schema'
import { templateKey } from '@/lib/resume-template/source/types'
import { IDLE_RESOURCE, useResumeTemplateStore } from '@/store/resume-template'

export function useResolvedResumeTemplate({
  binding,
  definition,
  enabled = true,
  assetUrls: suppliedAssetUrls,
}: {
  binding?: unknown
  definition?: TemplateDefinition | null
  enabled?: boolean
  assetUrls?: ReadonlyMap<string, string>
}) {
  const bindingKey = JSON.stringify(binding)

  const request = useMemo<{
    ref?: TemplateRef
    immediate?: ResourceState<TemplateDefinition>
  }>(() => {
    try {
      if (definition != null)
        return {
          immediate: {
            status: 'ready',
            data: parseTemplateDefinition(definition),
          },
        }

      return {
        ref: resolveTemplateReference(
          bindingKey ? JSON.parse(bindingKey) : undefined,
        ),
      }
    } catch (error) {
      return { immediate: { status: 'error', error: asTemplateError(error) } }
    }
  }, [bindingKey, definition])

  const key = request.ref ? templateKey(request.ref) : ''

  const cached = useResumeTemplateStore(
    (state) => state.definitions[key] ?? IDLE_RESOURCE,
  )

  const loadDefinition = useResumeTemplateStore((state) => state.loadDefinition)

  const retainDefinition = useResumeTemplateStore(
    (state) => state.retainDefinition,
  )

  useEffect(() => {
    if (!enabled || !request.ref) return

    const release = retainDefinition(request.ref)

    loadDefinition(request.ref)

    return release
  }, [enabled, request, loadDefinition, retainDefinition])

  const definitionResource = enabled
    ? (request.immediate ?? cached)
    : IDLE_RESOURCE

  const readyDefinition =
    definitionResource.status === 'ready' ? definitionResource.data : null

  // 每份文档在进入分页之前加载一次；测量、展示与打印副本共用同一 URL 映射。
  const {
    status: assetStatus,
    error: assetError,
    retry: retryAssets,
    assetUrls: loadedAssetUrls,
  } = useTemplateAssets(suppliedAssetUrls ? null : readyDefinition)

  const resource = useMemo<ResourceState<TemplateDefinition>>(() => {
    if (definitionResource.status !== 'ready') return definitionResource
    if (assetStatus === 'error') return { status: 'error', error: assetError! }
    if (assetStatus !== 'ready') return { status: 'loading', requestId: 0 }

    return definitionResource
  }, [definitionResource, assetStatus, assetError])

  const retry = useCallback(async () => {
    if (readyDefinition && assetStatus === 'error') {
      retryAssets()

      return
    }
    if (request.ref) await loadDefinition(request.ref, true)
    else retryAssets()
  }, [readyDefinition, assetStatus, retryAssets, request, loadDefinition])

  return {
    resource,
    assetUrls: suppliedAssetUrls ?? loadedAssetUrls,
    retry: request.ref || readyDefinition ? retry : undefined,
  }
}
