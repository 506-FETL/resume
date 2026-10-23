import type { CachedResource, TemplateResourceCache } from './cache'
import type { TemplateTransport } from './transport'
import type { CatalogQuery, ResourceOptions, TemplateSource } from './types'
import { z } from 'zod'
import { parseTemplateDefinition, templateIdSchema, templateRefSchema, TemplateResolutionError } from '../definition-schema'
import { assetEnvelopeSchema, decodeAsset } from './assets'
import { MAX_CACHE_BYTES, resourceBytes } from './cache'
import { assetRefSchema, catalogFacetsSchema, catalogItemSchema, catalogPageSchema, catalogQuerySchema, decodeResource, exampleRefSchema, exampleSchema, resourceEnvelopeSchema } from './resource-schema'
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
  const pending = new Map<string, { id: number, promise: Promise<unknown> }>()
  const retained = new Map<string, number>()
  const writes = new Map<string, Promise<void>>()
  let sequence = 0

  function remember(record: CachedResource) {
    memory.delete(record.key)
    memory.set(record.key, record)

    let bytes = [...memory.values()].reduce((total, entry) => total + resourceBytes(entry.value), 0)
    for (const [key, entry] of memory) {
      if (memory.size <= MEMORY_LIMIT && bytes <= MAX_CACHE_BYTES)
        break
      if (retained.has(key))
        continue
      memory.delete(key)
      bytes -= resourceBytes(entry.value)
    }
    // 消费者持有正在使用的数据；拒绝缓存无法容纳的新资源。
    if (memory.size > MEMORY_LIMIT || bytes > MAX_CACHE_BYTES)
      memory.delete(record.key)
  }

  async function read<T>(key: string, fetchValue: () => Promise<unknown>, validate: (input: unknown) => T | Promise<T>, ttl = Infinity, force = false): Promise<T> {
    let request = pending.get(key)

    if (!request || force) {
      const id = ++sequence
      const job = (async () => {
        const saved = memory.get(key) ?? await cache.get(key)
        let fallback: T | undefined

        if (saved) {
          try {
            fallback = await validate(saved.value)

            if (!force && saved.expiresAt > now()) {
              if (pending.get(key)?.id === id)
                remember(saved)
              return fallback
            }
          }
          catch {
            if (pending.get(key)?.id === id) {
              memory.delete(key)
              await cache.delete(key)
            }
          }
        }

        let value: unknown

        try {
          value = await fetchValue()
        }
        catch (error) {
          // 仅网络失败可以复用有限期旧目录；非法资源／缺版本绝不回退。
          if (
            !force && fallback !== undefined
            && saved && now() - saved.savedAt < OFFLINE_CATALOG_MAX_AGE
            && error instanceof TemplateResolutionError
            && error.code === 'LOAD_FAILED'
          ) {
            return fallback
          }

          throw error
        }
        const result = await validate(value)
        const record = { key, value, savedAt: now(), expiresAt: now() + ttl }

        if (pending.get(key)?.id === id) {
          remember(record)
          const previous = writes.get(key) ?? Promise.resolve()
          const write = previous.catch(() => {}).then(async () => {
            if (pending.get(key)?.id === id)
              await cache.set(record)
          })
          writes.set(key, write)
          try {
            await write
          }
          finally {
            if (writes.get(key) === write)
              writes.delete(key)
          }
        }

        return result
      })().finally(() => {
        if (pending.get(key)?.id === id)
          pending.delete(key)
      })

      request = { id, promise: job }
      pending.set(key, request)
    }

    return structuredClone(await request.promise) as T
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
    getTemplateCatalogEntry(templateId, options) {
      const id = templateIdSchema.parse(templateId)
      const entrySchema = z.object({ item: catalogItemSchema, listed: z.boolean() }).nullable()
      return read(`catalog-entry:${id}`, async () => {
        // 当前简历的精确版本可继续使用，即使它已经从候选目录下架。
        const rows = z.array(z.object({ metadata: catalogItemSchema, listed: z.boolean() })).max(1).parse(await transport('official_resume_template_catalog', {
          select: 'metadata,listed',
          template_id: `eq.${id}`,
          limit: '1',
        }))
        return rows[0] ? { item: rows[0].metadata, listed: rows[0].listed } : null
      }, input => entrySchema.parse(input), CATALOG_TTL_MS, options?.force)
    },
    getTemplateName(templateId, options) {
      const id = templateIdSchema.parse(templateId)
      return read(`template-name:${id}`, async () => {
        const rows = z.array(z.object({ name: z.string().min(1).max(100) })).max(1).parse(await transport('official_resume_template_catalog', {
          select: 'name:metadata->>name',
          template_id: `eq.${id}`,
          limit: '1',
        }))
        return rows[0]?.name ?? null
      }, input => z.string().min(1).max(100).nullable().parse(input), CATALOG_TTL_MS, options?.force)
    },
    retainResource(key) {
      if (!retained.has(key) && retained.size >= 64)
        throw new TemplateResolutionError('LOAD_FAILED', '同时使用的模板资源过多，请关闭部分预览后重试')
      retained.set(key, (retained.get(key) ?? 0) + 1)
      const releaseCache = cache.retain?.(key)
      let released = false
      return () => {
        if (released)
          return
        released = true
        const count = (retained.get(key) ?? 1) - 1
        if (count > 0)
          retained.set(key, count)
        else retained.delete(key)
        releaseCache?.()
      }
    },
    getAsset(ref, options) {
      const parsed = assetRefSchema.parse(ref)
      return read(`asset:${parsed.hash}`, async () => {
        const rows = z.array(assetEnvelopeSchema).max(1).parse(await transport('official_resume_assets', {
          select: 'content_hash,mime_type,byte_size,width,height,content_base64',
          content_hash: `eq.${parsed.hash}`,
          limit: '1',
        }))
        if (!rows.length)
          throw new TemplateResolutionError('VERSION_NOT_FOUND', '未找到已发布的指定模板素材')
        return rows[0]
      }, input => decodeAsset(input, parsed), Infinity, options?.force)
    },
    listTemplatePage: page,
    async listTemplates() {
      // 维护调用也受目录预算保护，页面使用有界分页接口。
      const items = []
      let offset: number | null = 0
      do {
        const result = await page({ offset })
        items.push(...result.items)
        if (items.length > 1200)
          throw new TemplateResolutionError('LOAD_FAILED', '目录条目超出单次读取预算，请使用分页接口')
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
