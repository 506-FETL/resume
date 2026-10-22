import type { CachedResource, TemplateResourceCache } from './cache'
import type { TemplateTransport } from './transport'
import type { CatalogQuery, ResourceOptions, TemplateSource } from './types'
import { z } from 'zod'
import { parseTemplateDefinition, templateRefSchema, TemplateResolutionError } from '../definition-schema'
import { catalogFacetsSchema, catalogItemSchema, catalogPageSchema, catalogQuerySchema, decodeResource, exampleRefSchema, exampleSchema, resourceEnvelopeSchema } from './resource-schema'
import { CATALOG_PAGE_SIZE, catalogQueryKey, exampleKey, templateKey } from './types'

export const CATALOG_TTL_MS = 5 * 60 * 1000
const OFFLINE_CATALOG_MAX_AGE = 24 * 60 * 60 * 1000
const MEMORY_LIMIT = 128

export function createRemoteTemplateSource({ transport, cache, now = Date.now }: {
  transport: TemplateTransport
  cache: TemplateResourceCache
  now?: () => number
}): TemplateSource {
  const memory = new Map<string, CachedResource>()
  const pending = new Map<string, Promise<unknown>>()
  function remember(record: CachedResource) {
    memory.delete(record.key)
    memory.set(record.key, record)
    if (memory.size > MEMORY_LIMIT)
      memory.delete(memory.keys().next().value!)
  }
  async function read<T>(key: string, fetchValue: () => Promise<unknown>, validate: (input: unknown) => T | Promise<T>, ttl = Infinity, force = false): Promise<T> {
    let job = pending.get(key) as Promise<T> | undefined
    if (!job) {
      job = (async () => {
        const saved = memory.get(key) ?? await cache.get(key)
        let fallback: T | undefined
        if (saved) {
          try {
            fallback = await validate(saved.value)
            if (!force && saved.expiresAt > now()) {
              remember(saved)
              return fallback
            }
          }
          catch {
            memory.delete(key)
            await cache.delete(key)
          }
        }
        let value: unknown
        try {
          value = await fetchValue()
        }
        catch (error) {
          // 仅网络失败可以复用有限期旧目录；非法资源／缺版本绝不回退。
          if (!force && fallback !== undefined && saved && now() - saved.savedAt < OFFLINE_CATALOG_MAX_AGE && error instanceof TemplateResolutionError && error.code === 'LOAD_FAILED')
            return fallback
          throw error
        }
        const result = await validate(value)
        const record = { key, value, savedAt: now(), expiresAt: now() + ttl }
        remember(record)
        await cache.set(record)
        return result
      })().finally(() => pending.delete(key))
      pending.set(key, job)
    }
    return structuredClone(await job)
  }
  const envelope = async (path: string, params: Record<string, string>) => {
    const rows = z.array(resourceEnvelopeSchema).max(1).parse(await transport(path, { select: 'content,content_hash', ...params, limit: '1' }))
    if (!rows.length)
      throw new TemplateResolutionError('VERSION_NOT_FOUND', '未找到已发布的指定资源版本，请联系维护者')
    return rows[0]
  }
  const page = (query: CatalogQuery = {}, options: ResourceOptions = {}) => {
    const normalized = catalogQuerySchema.parse(query)
    return read(`catalog:${catalogQueryKey(normalized)}`, async () => {
      const params: Record<string, string> = { select: 'metadata', listed: 'eq.true', order: 'sort_order.asc,template_id.asc', offset: String(normalized.offset), limit: String(CATALOG_PAGE_SIZE + 1) }
      if (normalized.style)
        params.style = `eq.${normalized.style}`
      if (normalized.layout)
        params.layout = `eq.${normalized.layout}`
      const rows = z.array(z.object({ metadata: catalogItemSchema })).max(CATALOG_PAGE_SIZE + 1).parse(await transport('official_resume_template_catalog', params))
      return { items: rows.slice(0, CATALOG_PAGE_SIZE).map(row => row.metadata), nextOffset: rows.length > CATALOG_PAGE_SIZE ? normalized.offset + CATALOG_PAGE_SIZE : null }
    }, input => catalogPageSchema.parse(input), CATALOG_TTL_MS, options.force)
  }
  return {
    listTemplatePage: page,
    async listTemplates() {
      // 兼容非 UI 消费者；页面和 AI 列表必须使用有界分页接口。
      const items = []
      let offset: number | null = 0
      do {
        const result = await page({ offset })
        items.push(...result.items)
        offset = result.nextOffset
      } while (offset !== null)
      return items
    },
    getCatalogFacets: options => read('facets', () => transport('rpc/official_resume_template_facets'), input => catalogFacetsSchema.parse(input), CATALOG_TTL_MS, options?.force),
    getTemplateVersion: (ref, options) => {
      const parsed = templateRefSchema.parse(ref)
      return read(`template:${templateKey(parsed)}`, () => envelope('official_resume_template_versions', { template_id: `eq.${parsed.templateId}`, version: `eq.${parsed.templateVersion}` }), async (input) => {
        const definition = parseTemplateDefinition(await decodeResource(input))
        if (definition.templateId !== parsed.templateId || definition.version !== parsed.templateVersion)
          throw new TemplateResolutionError('REFERENCE_MISMATCH', '模板版本与请求不一致')
        return definition
      }, Infinity, options?.force)
    },
    getExample: (ref, options) => {
      const parsed = exampleRefSchema.parse({ exampleId: ref.exampleId, version: ref.version })
      return read(`example:${exampleKey(parsed)}`, () => envelope('official_resume_example_versions', { example_id: `eq.${parsed.exampleId}`, version: `eq.${parsed.version}` }), async (input) => {
        const example = exampleSchema.parse(await decodeResource(input))
        if (example.exampleId !== parsed.exampleId || example.version !== parsed.version)
          throw new TemplateResolutionError('REFERENCE_MISMATCH', '示例版本与请求不一致')
        return example
      }, Infinity, options?.force)
    },
  }
}
