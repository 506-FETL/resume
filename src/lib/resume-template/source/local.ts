import type { TemplateSource } from './types'
import { classicRibbonTemplateCatalogItem } from '../catalog/classic-ribbon'
import { defaultTemplateCatalogItem } from '../catalog/default'
import { parseTemplateDefinition, TemplateResolutionError } from '../definition-schema'
import { classicRibbonTemplateV1 } from '../definitions/classic-ribbon/v1'
import { defaultTemplateV1 } from '../definitions/default/v1'
import { frontendExampleV1 } from '../examples/frontend-v1'
import { graduateExampleV1 } from '../examples/graduate-v1'
import { exampleKey, templateKey } from './types'

const definitions = new Map([['default@1', defaultTemplateV1], ['classic-ribbon@1', classicRibbonTemplateV1]])
const examples = new Map([['graduate@1', graduateExampleV1], ['frontend@1', frontendExampleV1]])

export const localTemplateSource: TemplateSource = {
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
