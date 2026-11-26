import type { CatalogQuery, ResourceOptions } from './types'
import { z } from 'zod'
import { templateIdSchema } from '../identity'
import {
  assetRefSchema,
  catalogFacetsSchema,
  catalogQuerySchema,
  exampleRefSchema,
} from './catalog-schema'
import { publicTemplateResources } from './public-resources'
import { CATALOG_PAGE_SIZE, CATALOG_TTL_MS, catalogQueryKey } from './types'

const cardRows = z
  .array(
    z.object({
      template_id: templateIdSchema,
      current_version: z.number().int().positive(),
      name: z.string().min(1).max(100),
      description: z.string().max(500),
      style: z.string().min(1).max(60),
      layout: z.string().min(1).max(60),
      default_example: exampleRefSchema,
      default_asset: assetRefSchema,
      card_asset: assetRefSchema.nullable(),
    }),
  )
  .max(CATALOG_PAGE_SIZE + 1)

const { loader, transport } = publicTemplateResources

export const galleryCatalogSource = {
  listTemplatePage(query: CatalogQuery = {}, options: ResourceOptions = {}) {
    const { offset, style, layout } = catalogQuerySchema.parse(query)

    return loader.read(
      `catalog-cards:${catalogQueryKey({ offset, style, layout })}`,
      () =>
        transport('official_template_card_summaries', {
          select:
            'template_id,current_version,name,description,style,layout,default_example,default_asset,card_asset',
          order: 'sort_order.asc,template_id.asc',
          offset: String(offset),
          limit: String(CATALOG_PAGE_SIZE + 1),
          ...(style && { style: `eq.${style}` }),
          ...(layout && { layout: `eq.${layout}` }),
        }),
      (input) => {
        const rows = cardRows.parse(input)

        return {
          items: rows.slice(0, CATALOG_PAGE_SIZE).map((row) => ({
            templateId: row.template_id,
            currentVersion: row.current_version,
            name: row.name,
            description: row.description,
            category: { style: row.style, layout: row.layout },
            defaultExample: row.default_example,
            defaultPreview: { asset: row.default_asset },
            ...(row.card_asset && { cardPreview: { asset: row.card_asset } }),
          })),
          nextOffset:
            rows.length > CATALOG_PAGE_SIZE ? offset + CATALOG_PAGE_SIZE : null,
        }
      },
      CATALOG_TTL_MS,
      options.force,
    )
  },
  getCatalogFacets(options?: ResourceOptions) {
    return loader.read(
      'facets',
      () => transport('rpc/official_resume_template_facets'),
      (input) => catalogFacetsSchema.parse(input),
      CATALOG_TTL_MS,
      options?.force,
    )
  },
}
