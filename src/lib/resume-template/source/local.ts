import type { TemplateSource } from './types'
import { classicRibbonTemplateCatalogItem } from '../catalog/classic-ribbon'
import { defaultTemplateCatalogItem } from '../catalog/default'
import { parseTemplateDefinition, TemplateResolutionError } from '../definition-schema'
import { classicRibbonTemplateV1 } from '../definitions/classic-ribbon/v1'
import { defaultTemplateV1 } from '../definitions/default/v1'
import { frontendExampleV1 } from '../examples/frontend-v1'
import { graduateExampleV1 } from '../examples/graduate-v1'
import { CATALOG_PAGE_SIZE, exampleKey, templateKey } from './types'

const definitions = new Map([['default@1', defaultTemplateV1], ['classic-ribbon@1', classicRibbonTemplateV1]])
const examples = new Map([['graduate@1', graduateExampleV1], ['frontend@1', frontendExampleV1]])

const catalog = [defaultTemplateCatalogItem, classicRibbonTemplateCatalogItem]

// 仅供迁移、固定样本验证；应用运行时由 remote Source 提供资源。
export const localTemplateSource: TemplateSource = {
  async listTemplatePage(query = {}) {
    const offset = query.offset ?? 0
    const items = catalog.filter(item => (!query.style || item.category.style === query.style) && (!query.layout || item.category.layout === query.layout))
    return structuredClone({ items: items.slice(offset, offset + CATALOG_PAGE_SIZE), nextOffset: items.length > offset + CATALOG_PAGE_SIZE ? offset + CATALOG_PAGE_SIZE : null })
  },
  async getCatalogFacets() {
    return { styles: [...new Set(catalog.map(item => item.category.style))], layouts: [...new Set(catalog.map(item => item.category.layout))] }
  },
  async listTemplates() {
    return structuredClone([defaultTemplateCatalogItem, classicRibbonTemplateCatalogItem])
  },
  async getTemplateVersion(ref) {
    const definition = definitions.get(templateKey(ref))
    if (!definition)
      throw new TemplateResolutionError('VERSION_NOT_FOUND', '未找到这份简历使用的模板版本')
    return parseTemplateDefinition(structuredClone(definition))
  },
  async getExample(ref) {
    const example = examples.get(exampleKey(ref))
    if (!example)
      throw new TemplateResolutionError('VERSION_NOT_FOUND', '未找到所选示例版本')
    return structuredClone(example)
  },
}
