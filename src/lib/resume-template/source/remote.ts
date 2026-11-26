import type { TemplateResourceCache } from './cache'
import type { TemplateTransport } from './transport'
import type { CatalogQuery, ResourceOptions, TemplateSource } from './types'
import { z } from 'zod'
import { templateIdSchema, templateRefSchema } from '../identity'
import { TemplateResolutionError } from '../errors'
import { resourceEnvelopeSchema, decodeResource } from './resource-envelope'
import { assetEnvelopeSchema, decodeAsset } from './assets'
import { createResourceLoader } from './resource-loader'
import {
  assetRefSchema,
  catalogFacetsSchema,
  catalogQuerySchema,
  exampleRefSchema,
} from './catalog-schema'
import {
  CATALOG_PAGE_SIZE,
  CATALOG_TTL_MS,
  catalogQueryKey,
  exampleKey,
  templateKey,
} from './types'

export { CATALOG_TTL_MS } from './types'

export function createRemoteTemplateSource({
  transport,
  cache,
  now = Date.now,
  loader = createResourceLoader({ cache, now }),
}: {
  transport: TemplateTransport
  cache: TemplateResourceCache
  now?: () => number
  loader?: ReturnType<typeof createResourceLoader>
}): TemplateSource {
  const { read, retainResource } = loader

  const envelope = async (path: string, params: Record<string, string>) => {
    const rows = z
      .array(resourceEnvelopeSchema)
      .max(1)
      .parse(
        await transport(path, {
          select: 'content,content_hash',
          ...params,
          limit: '1',
        }),
      )

    if (!rows.length)
      throw new TemplateResolutionError(
        'VERSION_NOT_FOUND',
        '未找到已发布的指定资源版本，请联系维护者',
      )

    return rows[0]
  }

  const page = (query: CatalogQuery = {}, options: ResourceOptions = {}) => {
    const normalized = catalogQuerySchema.parse(query)

    return read(
      `catalog:${catalogQueryKey(normalized)}`,
      async () => {
        const params: Record<string, string> = {
          select: 'metadata',
          listed: 'eq.true',
          order: 'sort_order.asc,template_id.asc',
          offset: String(normalized.offset),
          limit: String(CATALOG_PAGE_SIZE + 1),
        }

        if (normalized.style) params.style = `eq.${normalized.style}`
        if (normalized.layout) params.layout = `eq.${normalized.layout}`

        const [{ catalogItemSchema }, response] = await Promise.all([
          import('./resource-schema'),
          transport('official_resume_template_catalog', params),
        ])

        const rows = z
          .array(z.object({ metadata: catalogItemSchema }))
          .max(CATALOG_PAGE_SIZE + 1)
          .parse(response)

        return {
          items: rows.slice(0, CATALOG_PAGE_SIZE).map((row) => row.metadata),
          nextOffset:
            rows.length > CATALOG_PAGE_SIZE
              ? normalized.offset + CATALOG_PAGE_SIZE
              : null,
        }
      },
      async (input) =>
        (await import('./resource-schema')).catalogPageSchema.parse(input),
      CATALOG_TTL_MS,
      options.force,
    )
  }

  return {
    getTemplateCatalogEntry(templateId, options) {
      const id = templateIdSchema.parse(templateId)

      return read(
        `catalog-entry:${id}`,
        async () => {
          // 当前简历的精确版本可继续使用，即使它已经从候选目录下架。
          const [{ catalogItemSchema }, response] = await Promise.all([
            import('./resource-schema'),
            transport('official_resume_template_catalog', {
              select: 'metadata,listed',
              template_id: `eq.${id}`,
              limit: '1',
            }),
          ])

          const rows = z
            .array(
              z.object({ metadata: catalogItemSchema, listed: z.boolean() }),
            )
            .max(1)
            .parse(response)

          return rows[0]
            ? { item: rows[0].metadata, listed: rows[0].listed }
            : null
        },
        async (input) => {
          const { catalogItemSchema } = await import('./resource-schema')

          return z
            .object({ item: catalogItemSchema, listed: z.boolean() })
            .nullable()
            .parse(input)
        },
        CATALOG_TTL_MS,
        options?.force,
      )
    },
    getTemplateName(templateId, options) {
      const id = templateIdSchema.parse(templateId)

      return read(
        `template-name:${id}`,
        async () => {
          const rows = z
            .array(z.object({ name: z.string().min(1).max(100) }))
            .max(1)
            .parse(
              await transport('official_resume_template_catalog', {
                select: 'name:metadata->>name',
                template_id: `eq.${id}`,
                limit: '1',
              }),
            )

          return rows[0]?.name ?? null
        },
        (input) => z.string().min(1).max(100).nullable().parse(input),
        CATALOG_TTL_MS,
        options?.force,
      )
    },
    retainResource,
    getAsset(ref, options) {
      const parsed = assetRefSchema.parse(ref)

      return read(
        `asset:${parsed.hash}`,
        async () => {
          const rows = z
            .array(assetEnvelopeSchema)
            .max(1)
            .parse(
              await transport('official_resume_assets', {
                select:
                  'content_hash,mime_type,byte_size,width,height,content_base64',
                content_hash: `eq.${parsed.hash}`,
                limit: '1',
              }),
            )

          if (!rows.length)
            throw new TemplateResolutionError(
              'VERSION_NOT_FOUND',
              '未找到已发布的指定模板素材',
            )

          return rows[0]
        },
        (input) => decodeAsset(input, parsed),
        Infinity,
        options?.force,
      )
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
          throw new TemplateResolutionError(
            'LOAD_FAILED',
            '目录条目超出单次读取预算，请使用分页接口',
          )

        offset = result.nextOffset
      } while (offset !== null)

      return items
    },
    getCatalogFacets: (options) =>
      read(
        'facets',
        () => transport('rpc/official_resume_template_facets'),
        (input) => catalogFacetsSchema.parse(input),
        CATALOG_TTL_MS,
        options?.force,
      ),
    getTemplateVersion: (ref, options) => {
      const parsed = templateRefSchema.parse(ref)

      return read(
        `template:${templateKey(parsed)}`,
        () =>
          envelope('official_resume_template_versions', {
            template_id: `eq.${parsed.templateId}`,
            version: `eq.${parsed.templateVersion}`,
          }),
        async (input) => {
          const [{ parseTemplateDefinition }, content] = await Promise.all([
            import('../definition-schema'),
            decodeResource(input),
          ])

          const definition = parseTemplateDefinition(content)

          if (
            definition.templateId !== parsed.templateId ||
            definition.version !== parsed.templateVersion
          )
            throw new TemplateResolutionError(
              'REFERENCE_MISMATCH',
              '模板版本与请求不一致',
            )

          return definition
        },
        Infinity,
        options?.force,
      )
    },
    getExample: (ref, options) => {
      const parsed = exampleRefSchema.parse({
        exampleId: ref.exampleId,
        version: ref.version,
      })

      return read(
        `example:${exampleKey(parsed)}`,
        () =>
          envelope('official_resume_example_versions', {
            example_id: `eq.${parsed.exampleId}`,
            version: `eq.${parsed.version}`,
          }),
        async (input) => {
          const [{ exampleSchema }, content] = await Promise.all([
            import('./resource-schema'),
            decodeResource(input),
          ])

          const example = exampleSchema.parse(content)

          if (
            example.exampleId !== parsed.exampleId ||
            example.version !== parsed.version
          )
            throw new TemplateResolutionError(
              'REFERENCE_MISMATCH',
              '示例版本与请求不一致',
            )

          return example
        },
        Infinity,
        options?.force,
      )
    },
  }
}
